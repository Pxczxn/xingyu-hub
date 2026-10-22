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
    getCommentPreview: vi.fn(async () => []),
    createComment: vi.fn(),
  },
}));

/* The detail page now ends with 「继续阅读」, which asks the public series and
   topic endpoints for neighbours. Un-mocked, those calls escape to the network
   from jsdom (ECONNREFUSED :3000) — silent in the UI, but a real request from a
   unit test. Stub them here; the block's own behaviour is covered by
   `article-continue-reading.test.tsx`. */
vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    getPublicById: vi.fn(async () => {
      throw new Error("no series in this test");
    }),
  },
}));

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: { getTopicContent: vi.fn(async () => []) },
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
  seriesContexts: [],
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

  it("does not render an empty series context", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });
    expect(screen.queryByText("收录于")).not.toBeInTheDocument();
  });

  it("renders every active series context with its position", async () => {
    mocked.getArticle.mockResolvedValue({
      ...ARTICLE,
      seriesContexts: [
        { id: "series-b", slug: "backend", title: "后端工程入门", position: 1 },
        { id: "series-c", slug: "craft", title: "工程实践手记", position: 3 },
      ],
    });
    renderAt("a1");

    expect(await screen.findByText("收录于")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "后端工程入门 · 第 1 章" })).toHaveAttribute(
      "href",
      "/series/series-b",
    );
    expect(screen.getByRole("link", { name: "工程实践手记 · 第 3 章" })).toHaveAttribute(
      "href",
      "/series/series-c",
    );
    expect(screen.getByRole("heading", { name: "真实文章标题" })).toBeInTheDocument();
  });

  it("shows a not-found state on 404", async () => {
    mocked.getArticle.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
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
