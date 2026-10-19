import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicsPage } from "./pages/TopicsPage";

/*
 * Topics plaza tests.
 *
 * 2026-10-13 (批次 04) — the "does NOT expose a follow control" test is gone.
 *
 * It asserted that no 关注 button may exist, on the stated grounds that the
 * backend had no working follow endpoint (404). That premise was fixed
 * backend-side on 2026-10-10 — SocialService hard-coded status=ENABLED while
 * topics are ACTIVE, so every follow 404'd — and `TopicFollowIntegrationTest`
 * now pins the whole follow / unfollow / idempotency / disabled-topic loop.
 * `CommunityAuthInterceptor` also runs optional auth across `/api/v1/topics`, so
 * the list endpoint carries the viewer's `following` flag.
 *
 * The control is therefore back, and it is asserted in both directions below: a
 * guest gets no button (their list has no state to show), a signed-in reader gets
 * one that follows, flips, and rolls back when the request fails.
 *
 * The follow contract itself is still verified at the API layer in
 * topics.api.ts.
 */

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(),
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: false })),
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

const mocked = vi.mocked(topicsApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TopicsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * 搜索框常态收成一个放大镜按钮，点击才展开 —— 这里把「展开并拿到输入框」这一步
 * 封装起来，避免每个测试重复点一次。
 */
/**
 * 搜索框现在常驻在「全部话题」标题行，不再收起 —— 直接取输入框即可。
 */
function searchField() {
  return screen.getByRole("textbox", { name: "搜索话题" });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getTopics.mockResolvedValue([
    { id: "t1", slug: "ai", name: "AI", followerCount: 3, contentCount: 1, following: false },
  ]);
});

describe("topics page", () => {
  it("renders the topic list", async () => {
    renderPage();
    const list = await screen.findByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /AI/ })).toBeInTheDocument();
  });

  it("ranks hot topics by real contentCount and excludes zero-count topics", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 2 },
      { id: "t2", slug: "design", name: "设计", contentCount: 8 },
      { id: "t3", slug: "empty", name: "空话题", contentCount: 0 },
    ]);

    renderPage();

    const hot = await screen.findByRole("region", { name: "热门话题" });
    const links = within(hot).getAllByRole("link");
    expect(links[0]).toHaveTextContent("设计");
    expect(links[1]).toHaveTextContent("AI");
    // 内容数为 0 的话题没有热度可言，不进热门。
    expect(within(hot).queryByText("空话题")).not.toBeInTheDocument();
  });

  it("ranks recent topics by the real publication time the API reports", async () => {
    const now = Date.now();
    mocked.getTopics.mockResolvedValue([
      {
        id: "t1",
        slug: "ai",
        name: "AI",
        contentCount: 1,
        lastPublishedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "t2",
        slug: "design",
        name: "设计",
        contentCount: 3,
        // 内容数更少，但发布更近 —— 最近活跃按时间排，不按内容数排。
        lastPublishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
    ]);

    renderPage();

    const recent = await screen.findByRole("region", { name: "最近活跃" });
    const links = within(recent).getAllByRole("link");
    expect(links[0]).toHaveTextContent("设计");
    expect(links[1]).toHaveTextContent("AI");
    // 展示的是真实相对时间，不是「刚刚更新」这类无依据文案。
    expect(within(recent).getByText("2 小时前")).toBeInTheDocument();
  });

  it("dedupes before truncating, so hot topics do not eat the recent slots", async () => {
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "tech", name: "技术", contentCount: 5, lastPublishedAt: hoursAgo(1) },
      { id: "t2", slug: "ai", name: "AI", contentCount: 4, lastPublishedAt: hoursAgo(2) },
      { id: "t3", slug: "design", name: "设计", contentCount: 3, lastPublishedAt: hoursAgo(3) },
      { id: "t4", slug: "life", name: "生活", contentCount: 2, lastPublishedAt: hoursAgo(4) },
      { id: "t5", slug: "startup", name: "创业", contentCount: 1, lastPublishedAt: hoursAgo(5) },
      { id: "t6", slug: "oss", name: "开源", contentCount: 1, lastPublishedAt: hoursAgo(6) },
    ]);

    renderPage();

    const hot = await screen.findByRole("region", { name: "热门话题" });
    expect(within(hot).getAllByRole("link")).toHaveLength(4);

    /*
     * 前 4 条时间候选全都同时在热门里。若「先截 4 再去重」，这一栏会只剩 0 条；
     * 正确顺序是「先去重再截 4」，于是剩下的 创业 / 开源 都能进来，且仍按时间排序。
     */
    const recent = await screen.findByRole("region", { name: "最近活跃" });
    const links = within(recent).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("创业");
    expect(links[1]).toHaveTextContent("开源");
  });

  it("fills the recent module to four with older hot topics, keeping time order", async () => {
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
    mocked.getTopics.mockResolvedValue([
      // 热门（按内容数）：A / B / C，再加 D 一起占满四个名额。
      { id: "a", slug: "a", name: "甲", contentCount: 5, lastPublishedAt: hoursAgo(1) },
      { id: "b", slug: "b", name: "乙", contentCount: 4, lastPublishedAt: hoursAgo(2) },
      { id: "c", slug: "c", name: "丙", contentCount: 3, lastPublishedAt: hoursAgo(3) },
      { id: "d", slug: "d", name: "丁", contentCount: 2, lastPublishedAt: hoursAgo(7) },
      // 不在热门里的三条。
      { id: "e", slug: "e", name: "戊", contentCount: 1, lastPublishedAt: hoursAgo(4) },
      { id: "f", slug: "f", name: "己", contentCount: 1, lastPublishedAt: hoursAgo(5) },
      { id: "g", slug: "g", name: "庚", contentCount: 1, lastPublishedAt: hoursAgo(6) },
    ]);

    renderPage();

    const recent = await screen.findByRole("region", { name: "最近活跃" });
    const names = within(recent)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim().split(/\d/)[0]);

    /*
     * 三条去重候选（戊 4h / 己 5h / 庚 6h）之后，用「比庚更旧」的丁（7h）补第 4 条。
     * 补进来的那条本来就更旧，所以严格时间倒序保持不变 —— 不是为了凑数而乱序。
     */
    expect(names).toEqual(["戊", "己", "庚", "丁"]);
  });

  it("keeps the recent module empty when the API does not report a publication time", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 4 },
      { id: "t2", slug: "design", name: "设计", contentCount: 2 },
    ]);

    renderPage();
    await screen.findByTestId("topic-list");

    // 没有可靠时间就不启用这一栏：不推断、不补位、不显示空壳。
    expect(screen.queryByRole("region", { name: "最近活跃" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "热门话题" })).toBeInTheDocument();
  });

  it("hides the discovery area when there is nothing to rank", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "empty", name: "空话题", contentCount: 0 },
    ]);

    renderPage();

    await screen.findByTestId("topic-list");
    expect(screen.queryByTestId("topic-discovery")).not.toBeInTheDocument();
  });

  it("links each topic to its real slug", async () => {
    renderPage();

    const list = await screen.findByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /AI/ })).toHaveAttribute("href", "/topics/ai");
  });

  it("filters by keyword and hides the discovery area while searching", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 4 },
      { id: "t2", slug: "design", name: "设计", description: "产品体验", contentCount: 1 },
    ]);

    renderPage();
    await screen.findByTestId("topic-discovery");
    fireEvent.change(searchField(), { target: { value: "设计" } });

    const list = screen.getByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /设计/ })).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: /AI/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("topic-discovery")).not.toBeInTheDocument();
  });

  it("puts the search field in the all-topics header, next to the count", async () => {
    renderPage();
    await screen.findByTestId("topic-list");

    const list = screen.getByTestId("topic-list");
    const section = list.closest("section")!;
    const heading = within(section).getByRole("heading", { name: /全部话题/ });
    const field = within(section).getByRole("textbox", { name: "搜索话题" });

    // 搜索属于这一节，和标题同处一个 header，而不是页面顶部的一条独立筛选带。
    expect(section).toContainElement(field);
    expect(heading.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 计数是这一节的事实，和标题同一行（默认数据里只有 1 个话题）。
    expect(within(section).getByText("1")).toBeInTheDocument();
  });

  it("reports the real filtered count while searching", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 4 },
      { id: "t2", slug: "design", name: "设计", contentCount: 1 },
      { id: "t3", slug: "life", name: "生活", description: "设计与日常", contentCount: 1 },
    ]);

    renderPage();
    await screen.findByTestId("topic-list");

    fireEvent.change(searchField(), { target: { value: "设计" } });

    const section = screen.getByTestId("topic-list").closest("section")!;
    expect(within(section).getByRole("heading", { name: "搜索结果" })).toBeInTheDocument();
    // 「设计」命中 design 的名称与 life 的简介，共 2 条。
    expect(within(section).getByText("2")).toBeInTheDocument();
    expect(within(section).getAllByTestId("topic-list")[0].children).toHaveLength(2);
  });

  it("shows a lightweight empty result for an unmatched search", async () => {
    renderPage();
    await screen.findByTestId("topic-list");

    fireEvent.change(searchField(), { target: { value: "不存在" } });

    expect(screen.getByRole("status")).toHaveTextContent("没有找到匹配的话题");
  });

  it("shows no follow control to a guest, who has no follow state to show", async () => {
    renderPage();
    await screen.findByTestId("topic-list");

    /*
     * Not "the feature is missing" — a guest's list carries no `following` value,
     * and a button whose first click had to guess the current state would be a
     * lie the server then corrects. Guests get the plain card and can sign in
     * from the topic page itself.
     */
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
    expect(mocked.followTopic).not.toHaveBeenCalled();
    expect(mocked.unfollowTopic).not.toHaveBeenCalled();
  });

  it("follows a topic from its plaza card, with the count moving too", async () => {
    setStoredToken("tok");
    mocked.followTopic.mockResolvedValue(undefined);

    renderPage();

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
    // The count is the card's own fact line (设计方案 §3.3: 名称与内容数是重点),
    // so an optimistic update that moves the button but not the number is a bug.
    expect(screen.getByText("4 关注")).toBeInTheDocument();
  });

  it("rolls the plaza follow state back when the request fails", async () => {
    setStoredToken("tok");
    mocked.followTopic.mockRejectedValue(new Error("500"));

    renderPage();

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
    expect(screen.getByText("3 关注")).toBeInTheDocument();
  });

  it("keeps loading, error and empty states", async () => {
    mocked.getTopics.mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    unmount();

    mocked.getTopics.mockRejectedValueOnce(new Error("boom"));
    const errorView = renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    errorView.unmount();

    mocked.getTopics.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });
});
