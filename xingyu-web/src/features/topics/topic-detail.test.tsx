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
