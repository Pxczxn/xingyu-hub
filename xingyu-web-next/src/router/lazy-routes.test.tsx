import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { TOKEN_KEY } from "@/lib/storage";

/*
 * Route-level code splitting (Phase 1C-1).
 *
 * /articles/:articleId and /studio/content/:articleId are the only two hosts of
 * the heavy Markdown / editor stacks and are `lazy()` in the routing table.
 * These tests assert the observable consequence of that: the route suspends on
 * first render (Suspense fallback visible) and only then paints the real page.
 * An eager import would paint the page in the very first commit, so the
 * fallback assertion is what actually pins the lazy behaviour down.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "tester@pxczxn.top", emailVerified: true })),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
    requestPasswordRecovery: vi.fn(),
    resetPassword: vi.fn(),
    forceChangePassword: vi.fn(),
    sendRegisterSms: vi.fn(),
  },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    getArticle: vi.fn(async () => ({
      id: "abc-123",
      title: "懒加载文章",
      summary: null,
      body: "## 小节\n\n正文段落。",
      slug: null,
      visibility: "PUBLIC",
      spaceSlug: "default",
      ownerUsername: "tester",
      publishedAt: null,
      owner: false,
    })),
  },
}));

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    getLikeStatus: vi.fn(async () => ({ liked: false })),
    getLikeCount: vi.fn(async () => ({ count: 0 })),
    like: vi.fn(),
    unlike: vi.fn(),
    getComments: vi.fn(async () => []),
    createComment: vi.fn(),
  },
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("lazy article route", () => {
  it("suspends before painting and then renders the real article page", async () => {
    renderAt("/articles/abc-123");

    // First commit: the lazy chunk has not resolved yet.
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "懒加载文章" })).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-loading")).toBeNull();
  });
});

describe("lazy editor route", () => {
  it("suspends, then renders the editor for an authenticated author", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    const { container } = renderAt("/studio/content/new");

    // The editor chunk carries Milkdown + Crepe + CodeMirror, so in the unbundled
    // test environment the dynamic import needs a generous budget (in the real
    // build it is a single pre-split chunk fetched once).
    await waitFor(
      () => expect(container.querySelector("[data-editor-root]")).not.toBeNull(),
      { timeout: 30000 },
    );
    expect(screen.getByRole("toolbar", { name: "正文编辑工具" })).toBeInTheDocument();
    expect(screen.getByLabelText("文章标题")).toHaveValue("");
    expect(container.querySelector("[data-editor-dev-notice]")).not.toBeNull();
  }, 60000);

  it("redirects guests to login instead of rendering the editor", async () => {
    const { container } = renderAt("/studio/content/new");

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(container.querySelector("[data-editor-root]")).toBeNull();
  });
});
