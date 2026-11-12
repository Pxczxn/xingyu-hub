import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  /*
   * Batch 13 — one long-form type baseline for every reading surface.
   *
   * The article page ran 15px / 2.1333 while the series reader defaulted to
   * 18px / 1.85, so the same text read as two different products. The shared
   * scale now lives on `.article-body` in globals.css, which both surfaces
   * inherit; these two assertions pin the article side of the column contract.
   *
   * The column width is the part jsdom CAN pin. `ch` resolves against the
   * element's OWN font-size, so `max-w-[68ch]` measured 638px on the page's
   * 16px ancestor but 717.8px inside the reader's 18px column — "the same"
   * 68ch held 42 glyphs in one place and 39 in the other. Both surfaces now
   * read their width from `--reading-measure`, an absolute length equal to
   * 68ch at the shared 18px body.
   */
  it("caps the body and its column at the shared reading measure", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    const { container } = renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });

    // The column wrapper and the body it holds must agree on the measure; the
    // main track is what actually caps the body's width.
    const column = container.querySelector(".article-body")?.parentElement;
    expect(column?.className).toContain("max-w-[var(--reading-measure)]");
    /*
     * 有意改变的结构（C-reader 三轨 + 用户 2026-11-10 修正）：原来断言的是
     * `ArchetypeFrame` 的两栏栅格 `[...measure..._220px]`；现在正文列是三轨
     * `ReaderFrame` 的 main 轨，左右两轨只填原本的空白。改为按验收钩子
     * `data-reader-track` 断言三轨存在，且正文在 main 轨内 —— 栅格类别名会随
     * 骨架实现改名，验收钩子不会。
     */
    expect(container.querySelectorAll("[data-reader-track]")).toHaveLength(3);
    expect(
      container.querySelector('[data-reader-track="main"] .article-body'),
    ).not.toBeNull();
    // A literal `68ch` here would silently reintroduce the 16px-vs-18px split.
    expect(container.querySelector('[class*="68ch"]')).toBeNull();
  });

  /*
   * 用户 2026-11-10 修正：右栏必须永远有内容（工具 → 目录/本文信息 → 进度）。
   * 没有 h2/h3 时目录跳过，但工具与「本文信息」必须替换上来，不能出现空栏。
   */
  it("keeps the right track full when the article has no outline", async () => {
    mocked.getArticle.mockResolvedValue({
      ...ARTICLE,
      body: "只有一段正文。\n\n第二段。",
    });
    const { container } = renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });

    expect(screen.getByRole("group", { name: "阅读工具" })).toBeInTheDocument();
    expect(screen.getByText(/本文共 2 段/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "阅读进度" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-reader-track]")).toHaveLength(3);
  });

  it("applies the reading tools to the real body", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    const { container } = renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });

    fireEvent.click(screen.getByRole("button", { name: "增大字号" }));
    fireEvent.click(screen.getByRole("button", { name: "宽" }));

    const column = container.querySelector(".article-body")?.parentElement as HTMLElement | null;
    expect(column?.style.getPropertyValue("--reading-body-size")).toBe("20px");
    expect(column?.style.getPropertyValue("--reader-line-height")).toBe("2");
  });

  it("keeps the shared body size off the outline and the tail", async () => {
    mocked.getArticle.mockResolvedValue(ARTICLE);
    const { container } = renderAt("a1");

    await screen.findByRole("heading", { name: "真实文章标题" });

    /*
     * An earlier cut of this batch put `font-size: 18px` on the page root to
     * make `68ch` resolve the same way it does in the reader. Measured on the
     * live page, that inheritance escaped into 14 kinds of element — the
     * outline headings, the comment block, the continue-reading card — none of
     * which are long-form prose. The measure is a width token for that reason,
     * and this assertion keeps it that way.
     */
    const root = container.querySelector("article");
    expect(root?.className).not.toContain("reading-surface");
  });
});
