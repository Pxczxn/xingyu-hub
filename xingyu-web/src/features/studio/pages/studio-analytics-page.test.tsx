import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { meInsightsApi } from "@/api/moments/moments.api";
import { articlesApi } from "@/api/articles/articles.api";
import type { InsightsView } from "@/api/moments/moments.types";
import { StudioAnalyticsPage } from "./StudioAnalyticsPage";

/*
 * /studio/analytics (Phase 2L).
 *
 * The behaviour worth pinning is the honest handling of failure. Legacy's stub
 * rendered "—" for a failed load, which is indistinguishable from a real zero
 * and from a slow load. This page must instead SAY it could not read the data.
 */

vi.mock("@/api/moments/moments.api", () => ({
  meInsightsApi: { get: vi.fn() },
  momentsApi: { listMine: vi.fn() },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: { listMine: vi.fn() },
}));

const mockedInsights = vi.mocked(meInsightsApi);
const mockedArticles = vi.mocked(articlesApi);

function insights(overrides: Partial<InsightsView> = {}): InsightsView {
  return {
    articleCount: 7,
    draftCount: 2,
    followerCount: 31,
    followingCount: 12,
    commentCount: 19,
    likeCount: 88,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/studio/analytics"]}>
      <Routes>
        <Route path="/studio/analytics" element={<StudioAnalyticsPage />} />
        <Route path="/studio" element={<p>创作中心</p>} />
        <Route path="/studio/submissions" element={<p>投稿列表</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedArticles.listMine.mockResolvedValue([]);
});

describe("studio analytics page", () => {
  it("renders all six counters the API returns", async () => {
    mockedInsights.get.mockResolvedValue(insights());
    renderPage();

    const list = await screen.findByLabelText("创作数据");
    // Legacy showed only three of the six; dropping the rest would lose data
    // the API already hands us.
    expect(list).toHaveTextContent("已发布文章");
    expect(list).toHaveTextContent("草稿");
    expect(list).toHaveTextContent("获得喜欢");
    expect(list).toHaveTextContent("收到评论");
    expect(list).toHaveTextContent("粉丝");
    expect(list).toHaveTextContent("关注");
  });

  it("shows the real numbers", async () => {
    mockedInsights.get.mockResolvedValue(insights({ likeCount: 88, followerCount: 31 }));
    renderPage();

    const list = await screen.findByLabelText("创作数据");
    expect(list).toHaveTextContent("88");
    expect(list).toHaveTextContent("31");
  });

  it("says the data could not be read on failure — no misleading dashes", async () => {
    mockedInsights.get.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.getByTestId("page-state-error")).toHaveTextContent("无法读取");
    // The counters must not be rendered at all, so nothing reads as "0".
    expect(screen.queryByLabelText("创作数据")).not.toBeInTheDocument();
  });

  it("shows a loading state before the data arrives", () => {
    mockedInsights.get.mockReturnValue(new Promise(() => {}) as never);
    renderPage();

    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("renders a genuine zero as zero, not as a dash", async () => {
    mockedInsights.get.mockResolvedValue(insights({ likeCount: 0 }));
    renderPage();

    const list = await screen.findByLabelText("创作数据");
    expect(list).toHaveTextContent("0");
  });

  describe("draft summary", () => {
    it("counts drafts from the owner list", async () => {
      mockedInsights.get.mockResolvedValue(insights());
      mockedArticles.listMine.mockResolvedValue([
        { id: "a1", status: "DRAFT", title: "一", categoryId: null, updatedAt: "x" },
        { id: "a2", status: "DRAFT", title: "二", categoryId: null, updatedAt: "x" },
        { id: "a3", status: "PUBLISHED", title: "三", categoryId: null, updatedAt: "x" },
      ]);
      renderPage();

      expect(await screen.findByText(/共有 3 篇稿件/)).toBeInTheDocument();
      expect(screen.getByText(/2 篇是尚未提交审核的草稿/)).toBeInTheDocument();
    });

    it("does not blank the counters when the article list fails", async () => {
      mockedInsights.get.mockResolvedValue(insights({ likeCount: 5 }));
      mockedArticles.listMine.mockRejectedValue(new Error("boom"));
      renderPage();

      // Counters survive...
      const list = await screen.findByLabelText("创作数据");
      expect(list).toHaveTextContent("5");
      // ...and the draft block admits it does not know.
      expect(await screen.findByTestId("drafts-unavailable")).toBeInTheDocument();
    });
  });

  it("links to my submissions", async () => {
    mockedInsights.get.mockResolvedValue(insights());
    renderPage();

    const link = await screen.findByRole("link", { name: "我的投稿" });
    expect(link).toHaveAttribute("href", "/studio/submissions");
  });

  /*
   * UPDATED 2026-10-03 — this assertion was inverted, not relaxed.
   *
   * It used to require that NO link pointed at `/studio/content`, on the stated
   * grounds that "only /studio/content/:articleId is routed; a bare list link
   * would 404". That was true when written. It is not true now: the bare route is
   * registered and renders ContentListPage, and the studio hub links to it.
   *
   * So the old assertion was pinning a stale premise, and the page it protected
   * had a dead end — the 稿件状态 card reports how many drafts you have and
   * offered no way to reach them. The test now checks the link is present and
   * points somewhere real, which is what the page actually needs.
   */
  it("offers the content list, which now exists", async () => {
    mockedInsights.get.mockResolvedValue(insights());
    renderPage();
    await screen.findByLabelText("创作数据");

    const link = await screen.findByRole("link", { name: "查看全部内容" });
    expect(link).toHaveAttribute("href", "/studio/content");
  });
});
