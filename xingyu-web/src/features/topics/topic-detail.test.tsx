import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicDetailPage } from "./pages/TopicDetailPage";

/*
 * Topic detail tests (Phase 1A): the :slug param drives loading, and
 * success / empty / error states are all covered.
 *
 * Follow tests (2026-10-10 P0-A): the follow endpoints were fixed backend-side
 * (SocialService required status=ENABLED while topics are ACTIVE, so every
 * follow 404'd) and GET /topics/{slug} now reports `following` for signed-in
 * viewers. Guests get a login CTA instead of a toggle.
 *
 * 2026-10-13 (批次 04) — two tests were added for the layout pass, and both pin
 * decisions rather than pixels:
 *
 *   - the sort control reports which tab is active (`aria-pressed`), so the
 *     state is not carried by a gold underline alone;
 *   - the content list is NOT on a card surface, and its rows arrive staggered.
 *     That second assertion exists because the list used to sit inside a
 *     `bg-card/70` panel, which is exactly the kind of thing a later pass
 *     "helpfully" puts back.
 */

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    getTopics: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
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

const mocked = vi.mocked(topicsApi);

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/topics/${slug}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/topics/:slug" element={<TopicDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getTopicContent.mockResolvedValue([]);
  mocked.getTopicCreators.mockResolvedValue([]);
});

describe("topic detail", () => {
  it("loads the topic identified by the :slug param", async () => {
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      description: "关于 Spring 的讨论",
      followerCount: 12,
      contentCount: 3,
    });

    renderAt("spring");

    await waitFor(() => {
      expect(mocked.getTopic).toHaveBeenCalledWith("spring");
    });
    expect(await screen.findByRole("heading", { name: "Spring 话题" })).toBeInTheDocument();
  });

  it("shows an empty state when the topic has no content", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "empty", name: "空话题" });
    mocked.getTopicContent.mockResolvedValue([]);

    renderAt("empty");

    await waitFor(() => {
      expect(screen.getByTestId("page-state-empty")).toBeInTheDocument();
    });
  });

  it("renders topic identity metadata and offers guests a login CTA instead of a follow toggle", async () => {
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      description: "关于 Spring 的讨论",
      contentCount: 3,
      followerCount: 0,
    });

    renderAt("spring");

    expect(await screen.findByRole("heading", { name: "Spring 话题" })).toBeInTheDocument();
    expect(screen.getByText("关于 Spring 的讨论")).toBeInTheDocument();
    // Says 「篇内容」, matching TopicCard — the header used to read 「3 内容」.
    expect(screen.getByText("3 篇内容")).toBeInTheDocument();
    // Guest: a login CTA is rendered, but there is no follow toggle to click.
    expect(screen.getByRole("link", { name: /登录后关注/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^关注$|^已关注$/ })).not.toBeInTheDocument();
  });

  it("follows a topic with an optimistic count update", async () => {
    setStoredToken("tok");
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      followerCount: 12,
      following: false,
    });
    mocked.followTopic.mockResolvedValue(undefined);

    renderAt("spring");

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
    expect(screen.getByText("13 关注")).toBeInTheDocument();
  });

  it("unfollows a followed topic", async () => {
    setStoredToken("tok");
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      followerCount: 12,
      following: true,
    });
    mocked.unfollowTopic.mockResolvedValue(undefined);

    renderAt("spring");

    const button = await screen.findByRole("button", { name: "已关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.unfollowTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
    expect(screen.getByText("11 关注")).toBeInTheDocument();
  });

  it("rolls back the optimistic follow state when the request fails", async () => {
    setStoredToken("tok");
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      followerCount: 12,
      following: false,
    });
    mocked.followTopic.mockRejectedValue(new Error("500"));

    renderAt("spring");

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
    expect(screen.getByText("12 关注")).toBeInTheDocument();
  });

  it("renders content returned by the topic content endpoint", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([
      { id: "c1", title: "一篇文章", objectType: "ARTICLE" },
    ]);

    renderAt("spring");

    await waitFor(() => {
      expect(screen.getByTestId("topic-content")).toBeInTheDocument();
    });
    expect(screen.getByText("一篇文章")).toBeInTheDocument();
  });

  it("defaults to latest and requests hot content after tab selection", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([{ id: "c1", title: "内容", objectType: "ARTICLE" }]);

    renderAt("spring");
    await screen.findByText("内容");
    expect(mocked.getTopicContent).toHaveBeenCalledWith("spring", "latest", 12);

    fireEvent.click(screen.getByRole("button", { name: "热门" }));
    await waitFor(() => expect(mocked.getTopicContent).toHaveBeenCalledWith("spring", "hot", 12));
  });

  it("marks the active sort tab for assistive tech and flips it on selection", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([{ id: "c1", title: "内容", objectType: "ARTICLE" }]);

    renderAt("spring");

    /*
     * 「最近更新」, not 「最新」: the underlying sort is `indexed_at DESC`, an
     * index-write time that moves whenever an article is re-indexed. A tab
     * labelled 「最新」 would assert a publication order the data does not carry.
     */
    const latest = await screen.findByRole("button", { name: "最近更新" });
    expect(latest).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "热门" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "热门" }));

    await waitFor(() => expect(latest).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("button", { name: "热门" })).toHaveAttribute("aria-pressed", "true");
  });

  it("pages the content list instead of capping a topic at one page", async () => {
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      contentCount: 20,
    });
    /*
     * The endpoint takes `limit` and nothing else — there is no offset — so every
     * page is a re-fetch at a larger limit. Serving by limit keeps the mock honest
     * about that shape, and keeps the assertion independent of how many times the
     * effect re-runs while the topic header resolves.
     */
    mocked.getTopicContent.mockImplementation(async (_slug, _sort, limit = 12) =>
      Array.from({ length: Math.min(limit, 20) }, (_, index) => ({
        id: `c${index}`,
        title: `第 ${index + 1} 篇`,
        objectType: "ARTICLE",
      })),
    );

    renderAt("spring");

    await screen.findByText("第 1 篇");
    expect(mocked.getTopicContent).toHaveBeenCalledWith("spring", "latest", 12);
    // 20 篇里有 8 篇还没到手，按钮把差额说清楚。
    expect(screen.getByRole("button", { name: "加载更多（还有 8 篇）" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /加载更多/ }));

    await waitFor(() =>
      expect(mocked.getTopicContent).toHaveBeenCalledWith("spring", "latest", 24),
    );
    expect(await screen.findByText("第 20 篇")).toBeInTheDocument();
    // 全部到齐，出口消失 —— 不能留一个点了没有新内容的按钮。
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /加载更多/ })).not.toBeInTheDocument(),
    );
  });

  it("offers no load-more control when the first page holds the whole topic", async () => {
    mocked.getTopic.mockResolvedValue({
      id: "t1",
      slug: "spring",
      name: "Spring 话题",
      contentCount: 3,
    });
    mocked.getTopicContent.mockResolvedValue([
      { id: "c1", title: "第一篇", objectType: "ARTICLE" },
      { id: "c2", title: "第二篇", objectType: "ARTICLE" },
      { id: "c3", title: "第三篇", objectType: "ARTICLE" },
    ]);

    renderAt("spring");

    await screen.findByText("第一篇");
    // contentCount 就是总数，所以这里不必猜「取满了可能还有」。
    expect(screen.queryByRole("button", { name: /加载更多/ })).not.toBeInTheDocument();
  });

  it("stages the content rows in and keeps the list off a card surface", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([
      { id: "c1", title: "第一行", objectType: "ARTICLE" },
      { id: "c2", title: "第二行", objectType: "ARTICLE" },
    ]);

    renderAt("spring");

    const feed = await screen.findByTestId("topic-content");

    /*
     * P0 discipline (设计方案 §3.3). The list IS this page's core, so it must not
     * sit on a `bg-card/70` panel: a translucent surface reads as a secondary
     * block, and its border implies the whole thing is one operable object.
     */
    expect(feed.className).not.toContain("bg-card");

    const rows = within(feed).getAllByRole("article");
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain("animate-rise-in");
    expect(rows[1].className).toContain("animate-rise-in");
    // Inline, because `animate-rise-in` resets `animation-delay` (lib/stagger.ts).
    expect(rows[0].style.animationDelay).toBe("0ms");
    expect(rows[1].style.animationDelay).toBe("40ms");
  });

  it("keeps a local loading state while content is pending", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockReturnValue(new Promise(() => {}));

    renderAt("spring");

    await screen.findByRole("heading", { name: "Spring 话题" });
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("renders real cover and object type, while omitting an image slot without cover", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicContent.mockResolvedValue([
      // Carries `readMinutes` on purpose — nothing produces it, see the assertion below.
      { id: "c1", title: "带封面", objectType: "ARTICLE", cover: "/cover.jpg", readMinutes: 4 },
      { id: "c2", title: "无封面", objectType: "SERIES", summary: "摘要" },
    ]);

    renderAt("spring");

    const feed = await screen.findByTestId("topic-content");
    expect(within(feed).getByText("文章")).toBeInTheDocument();
    expect(within(feed).getByText("系列")).toBeInTheDocument();
    expect(feed.querySelector('img[src="/cover.jpg"]')).not.toBeNull();
    expect(feed.querySelectorAll("article")[1]?.querySelector("img")).toBeNull();
    /*
     * The reading-time line is GONE, and this fixture still supplies `readMinutes` to prove
     * it: the field has no producer at all — no Java source mentions it and the database has
     * no column — so its reader could never fire against a real payload.
     */
    expect(within(feed).queryByText(/分钟阅读/)).toBeNull();
  });

  it("renders active creators and links to their public profiles", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicCreators.mockResolvedValue([
      { username: "alice", displayName: "Alice", contentCount: 5 },
    ]);

    renderAt("spring");

    const sidebar = await screen.findByRole("complementary");
    expect(within(sidebar).getByText("活跃创作者")).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Alice/ })).toHaveAttribute(
      "href",
      "/u/alice",
    );
    expect(within(sidebar).getByText("5 篇内容")).toBeInTheDocument();
  });

  it("hides creator sidebar errors without affecting content", async () => {
    mocked.getTopic.mockResolvedValue({ id: "t1", slug: "spring", name: "Spring 话题" });
    mocked.getTopicCreators.mockRejectedValue(new Error("boom"));
    mocked.getTopicContent.mockResolvedValue([
      { id: "c1", title: "仍然可读", objectType: "ARTICLE" },
    ]);

    renderAt("spring");

    expect(await screen.findByText("仍然可读")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("shows an error state when the topic request fails", async () => {
    mocked.getTopic.mockRejectedValue(new Error("boom"));

    renderAt("broken");

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});
