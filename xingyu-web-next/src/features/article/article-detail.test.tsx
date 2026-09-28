import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { articlesApi } from "@/api/articles/articles.api";
import { ApiError } from "@/api/client";
import { AuthProvider } from "@/features/auth/auth.store";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";

/* Article detail tests: success / 404 / error / legacy Markdown rendering. */

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: { getArticle: vi.fn() },
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

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true })),
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

const mocked = vi.mocked(articlesApi);

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/articles/${id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/articles/:articleId" element={<ArticleDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const ARTICLE = {
  id: "a1",
  title: "真实文章标题",
  summary: "摘要",
  body: "## 二级标题\n\n段落 **粗体** 与 [链接](https://example.com)\n\n```js\nconst a = 1;\n```",
  slug: null,
  visibility: "PUBLIC",
  spaceSlug: "default",
  ownerUsername: "pxczxn",
  ownerDisplayName: "pxczxn",
  publishedAt: "2026-09-09T16:29:00Z",
  owner: false,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("article detail", () => {
  it("renders the article with title, author and metadata", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    renderAt("a1");

    expect(await screen.findByRole("heading", { name: "真实文章标题" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pxczxn/ })).toHaveAttribute("href", "/u/pxczxn");
  });

  it("renders legacy Markdown body (headings, bold, links, code)", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    const { container } = renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });

    // Markdown → HTML via the migrated remark/rehype pipeline.
    // Scope to the rendered body so header links don't interfere.
    const body = container.querySelector(".article-body");
    expect(body).not.toBeNull();
    expect(body?.querySelector("h2")?.textContent).toBe("二级标题");
    expect(body?.querySelector("strong")?.textContent).toBe("粗体");
    expect(body?.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(body?.querySelector("pre code")?.textContent).toContain("const a = 1;");
  });

  it("shows a not-found state on 404", async () => {
    mocked.getArticle.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "资源不存在", status: 404, detail: "资源不存在", code: "NOT_FOUND" }),
    );
    renderAt("missing");

    await waitFor(() => expect(screen.getByText("文章不存在或未公开")).toBeInTheDocument());
  });

  it("shows an error state on a server failure", async () => {
    mocked.getArticle.mockRejectedValue(new Error("500"));
    renderAt("a1");

    await waitFor(() => expect(screen.getByTestId("page-state-error")).toBeInTheDocument());
  });
});
