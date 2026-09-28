import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GrowthPage } from "./GrowthPage";

const mockedHistory = vi.fn();
const mockedComments = vi.fn();
const mockedBadges = vi.fn();
const mockedInsights = vi.fn();
const mockedMyHome = vi.fn();

vi.mock("@/api/reading-history/reading-history.api", () => ({
  readingHistoryApi: { list: () => mockedHistory() },
}));
vi.mock("@/api/me-activity/me-activity.api", () => ({
  myCommentsApi: { list: () => mockedComments() },
}));
vi.mock("@/api/badges/badges.api", () => ({
  badgesApi: { list: () => mockedBadges() },
}));
vi.mock("@/api/moments/moments.api", () => ({
  meInsightsApi: { get: () => mockedInsights() },
}));
vi.mock("@/api/home/home.api", () => ({
  homeApi: { getMyHome: () => mockedMyHome() },
}));

const INSIGHTS = {
  articleCount: 3,
  draftCount: 1,
  followerCount: 12,
  followingCount: 4,
  commentCount: 7,
  likeCount: 9,
};

const BADGES = [
  { id: "onboard", title: "入门完成", description: "完成入门引导", earned: true },
  { id: "first-post", title: "初次创作", description: "创建第一篇文章", earned: false },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <GrowthPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedHistory.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
  mockedComments.mockResolvedValue([]);
  mockedBadges.mockResolvedValue(BADGES);
  mockedInsights.mockResolvedValue(INSIGHTS);
  mockedMyHome.mockResolvedValue({
    continueReading: [],
    followUpdates: [],
    recommendations: [],
    draftArticles: [],
    pendingActions: [],
  });
});

describe("GrowthPage — aggregation", () => {
  it("renders all six insight counters", async () => {
    renderPage();
    const panel = await screen.findByLabelText("创作数据");
    for (const label of ["已发布文章", "草稿", "粉丝", "关注", "评论", "获得喜欢"]) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(within(panel).getByText("12")).toBeInTheDocument();
  });

  it("renders the reading history rows", async () => {
    mockedHistory.mockResolvedValue({
      items: [
        { id: "a1", objectType: "ARTICLE", title: "一篇文章", updatedAt: "2026-09-01T10:00:00Z" },
      ],
      nextCursor: null,
      total: 1,
    });
    renderPage();
    const panel = await screen.findByLabelText("最近阅读");
    expect(within(panel).getByText("一篇文章")).toBeInTheDocument();
  });

  it("renders recent comments", async () => {
    mockedComments.mockResolvedValue([
      { id: "c1", body: "写得好", objectType: "ARTICLE", objectId: "a1", objectTitle: "文", createdAt: "2026-09-01T10:00:00Z" },
    ]);
    renderPage();
    const panel = await screen.findByLabelText("最近评论");
    expect(within(panel).getByText("写得好")).toBeInTheDocument();
  });

  it("links the badge summary to the full badge page", async () => {
    renderPage();
    const panel = await screen.findByLabelText("徽章");
    expect(within(panel).getByRole("link", { name: "查看全部" })).toHaveAttribute("href", "/me/badges");
  });
});

describe("GrowthPage — per-section honesty on partial failure", () => {
  it("says the insight section failed instead of hiding it", async () => {
    mockedInsights.mockRejectedValue(new Error("boom"));
    renderPage();
    const panel = await screen.findByLabelText("创作数据");
    // The section STAYS, explains itself, and shows no numbers.
    expect(within(panel).getByRole("alert")).toHaveTextContent("这里不显示任何数字");
    expect(within(panel).queryByText("已发布文章")).not.toBeInTheDocument();
  });

  it("keeps the OTHER sections alive when one read fails", async () => {
    // The whole reason for five separate states instead of one Promise.all.
    mockedInsights.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await within(await screen.findByLabelText("徽章")).findByText(/当前已点亮/)).toBeInTheDocument();
    expect(within(await screen.findByLabelText("最近评论")).getByText(/还没有发表过评论/)).toBeInTheDocument();
  });

  it("explains a failed reading-history read rather than showing an empty state", async () => {
    mockedHistory.mockRejectedValue(new Error("boom"));
    renderPage();
    const panel = await screen.findByLabelText("最近阅读");
    expect(within(panel).getByRole("alert")).toHaveTextContent("不显示任何条目");
    // Must NOT be mistaken for "you have no reading history".
    expect(within(panel).queryByText(/没有阅读记录/)).not.toBeInTheDocument();
  });

  it("flags an expired session once, without blanking the page", async () => {
    const { ApiError } = await import("@/api/client");
    mockedInsights.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    expect(await screen.findByText(/登录状态过期/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toBeInTheDocument();
    // Other sections still rendered.
    expect(within(await screen.findByLabelText("徽章")).getByText(/当前已点亮/)).toBeInTheDocument();
  });
});

describe("GrowthPage — reading history empty is ambiguous", () => {
  it("states BOTH possible reasons for an empty history", async () => {
    // The backend returns the same empty list whether the setting is off or the
    // user simply has not read anything.
    renderPage();
    const panel = await screen.findByLabelText("最近阅读");
    expect(within(panel).getByText(/关闭了阅读历史记录/)).toBeInTheDocument();
  });
});

describe("GrowthPage — pending actions", () => {
  it("does NOT render the backend's non-existent /studio/reviewing as a link", async () => {
    mockedMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [{ type: "REVIEW", title: "文章审核中", href: "/studio/reviewing" }],
    });
    renderPage();
    const panel = await screen.findByLabelText("待处理");
    // The prompt is still shown...
    expect(within(panel).getByText("文章审核中")).toBeInTheDocument();
    // ...but not as a link to a route V2 does not have.
    expect(within(panel).queryByRole("link", { name: /文章审核中/ })).not.toBeInTheDocument();
    expect(panel.textContent).toContain("该入口在本站尚未开放");
  });

  it("DOES link when the href resolves to a shipped route", async () => {
    mockedMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [{ type: "REVIEW", title: "文章审核中", href: "/studio/submissions" }],
    });
    renderPage();
    const panel = await screen.findByLabelText("待处理");
    const link = within(panel).getByRole("link", { name: /文章审核中/ });
    expect(link).toHaveAttribute("href", "/studio/submissions");
  });

  it("collapses the server's per-article duplicates and shows a count", async () => {
    // HomeService emits one identical REVIEW row per under-review article.
    const row = { type: "REVIEW", title: "文章审核中", href: "/studio/reviewing" };
    mockedMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [row, row, row],
    });
    renderPage();
    const panel = await screen.findByLabelText("待处理");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
    expect(panel.textContent).toContain("3 项");
  });

  it("hides the whole section when there is nothing pending", async () => {
    renderPage();
    await screen.findByLabelText("徽章");
    expect(screen.queryByLabelText("待处理")).not.toBeInTheDocument();
  });
});
