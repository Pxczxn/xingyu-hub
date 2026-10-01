import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { homeApi } from "@/api/home/home.api";
import { topicsApi } from "@/api/topics/topics.api";
import { eventsApi } from "@/api/events/events.api";
import { usersApi } from "@/api/users/users.api";
import { authApi } from "@/api/auth/auth.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import type { ContentSummary } from "@/api/common.types";
import { AuthProvider } from "@/features/auth/auth.store";
import { setStoredToken } from "@/lib/storage";
import { HomePage } from "./pages/HomePage";

/*
 * Home tests (Phase 1A, re-cut for the feed IA and the four-module rail):
 *  - guest renders from GET /api/v1/home, member from GET /api/v1/me/home
 *  - 推荐 / 关注 are a REAL feed switch (same payload, different fields)
 *  - the guest hero offers 加入星语 / 登录; a member gets no such CTA
 *  - 查看更多 appears on 推荐 only, and points at /discover
 *  - 继续阅读 is signed-in only, and reports progress in CHAPTERS, never percent
 *  - a feed row renders only the enrichment it was given
 *  - a failing non-critical rail module must NOT blank the page
 *  - an empty non-critical module renders nothing at all (no placeholder box)
 *  - a failing composition endpoint is fatal and shows the error state
 */

vi.mock("@/api/home/home.api", () => ({
  homeApi: {
    getGuestHome: vi.fn(),
    getMyHome: vi.fn(),
    getAnnouncements: vi.fn(),
  },
}));

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

vi.mock("@/api/events/events.api", () => ({
  eventsApi: {
    list: vi.fn(),
    get: vi.fn(),
    listAcceptedSubmissions: vi.fn(),
    listMySubmissions: vi.fn(),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
    submit: vi.fn(),
  },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
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

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    getBookmarkStatus: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    getLikeStatus: vi.fn(),
    getLikeCount: vi.fn(),
    getComments: vi.fn(),
    createComment: vi.fn(),
  },
}));

const homeMocked = vi.mocked(homeApi);
const interactionsMocked = vi.mocked(interactionsApi);
const topicsMocked = vi.mocked(topicsApi);
const eventsMocked = vi.mocked(eventsApi);
const usersMocked = vi.mocked(usersApi);
const authMocked = vi.mocked(authApi);

const ME = { email: "alice@example.com", emailVerified: true, username: "alice" };

function renderHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** A guest composition payload. Every rail is overridable per test. */
function guestHome(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    unreadNotifications: 0,
    continueReading: [],
    followingUpdates: [],
    discoveries: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Default: every rail is empty, so a test only sees the rails it sets up.
  topicsMocked.getTopics.mockResolvedValue([]);
  eventsMocked.list.mockResolvedValue([]);
  homeMocked.getAnnouncements.mockResolvedValue([{ id: "n1", title: "社区公告一", body: "内容" }]);
});

describe("home (guest)", () => {
  it("renders the recommendations feed from the guest endpoint", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        // Deliberately non-empty: a guest must never see a resume affordance.
        continueReading: [{ id: "c1", title: "游客继续阅读" }],
        followingUpdates: [{ id: "f1", title: "游客关注条目" }],
        discoveries: [{ id: "d1", title: "游客推荐条目" }],
      }),
    );

    renderHome();

    await waitFor(() => expect(homeMocked.getGuestHome).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: "推荐" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "关注" })).toBeInTheDocument();
    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    // The announcement is integrated into the hero when a real item exists.
    expect(await screen.findByRole("link", { name: "社区公告一" })).toBeInTheDocument();
    // 继续阅读 is signed-in only.
    expect(screen.queryByRole("heading", { name: "继续阅读" })).not.toBeInTheDocument();
  });

  it("switches the feed to 关注 without leaving the page", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        followingUpdates: [{ id: "f1", title: "游客关注条目" }],
        discoveries: [{ id: "d1", title: "游客推荐条目" }],
      }),
    );

    renderHome();

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));

    expect(await screen.findByText("游客关注条目")).toBeInTheDocument();
    expect(screen.queryByText("游客推荐条目")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "关注" })).toHaveAttribute("aria-selected", "true");
  });

  it("offers 加入星语 / 登录 to a guest and hides them for a member", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "X" }] }),
    );

    const { unmount } = renderHome();

    expect(await screen.findByRole("link", { name: /加入星语/ })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    unmount();

    // Same page, signed in: the CTA is gone because it has nothing to offer.
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [{ id: "r1", title: "为我推荐" }],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();
    expect(await screen.findByText("为我推荐")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /加入星语/ })).not.toBeInTheDocument();
  });

  it("shows 查看更多 on 推荐 only, and only to /discover", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        followingUpdates: [{ id: "f1", title: "关注条目" }],
        discoveries: [{ id: "d1", title: "推荐条目" }],
      }),
    );

    renderHome();

    const more = await screen.findByRole("link", { name: /查看更多/ });
    expect(more).toHaveAttribute("href", "/discover");

    // 关注 has no "more" page — /me/following is the follow graph, not a feed.
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));
    await screen.findByText("关注条目");
    expect(screen.queryByRole("link", { name: /查看更多/ })).not.toBeInTheDocument();
  });
});

describe("home (authenticated)", () => {
  beforeEach(() => {
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
  });

  it("uses the member endpoint when a session exists", async () => {
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [{ id: "c1", title: "我的继续阅读" }],
      followUpdates: [],
      recommendations: [{ id: "r1", title: "为我推荐" }],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();

    await waitFor(() => expect(homeMocked.getMyHome).toHaveBeenCalled());
    expect(homeMocked.getGuestHome).not.toHaveBeenCalled();
    expect(await screen.findByText("为我推荐")).toBeInTheDocument();
    // 继续阅读 shows as a compact strip for a signed-in session with rows.
    expect(screen.getByRole("heading", { name: "继续阅读" })).toBeInTheDocument();
    expect(screen.getByText("我的继续阅读")).toBeInTheDocument();
  });

  it("reports continue-reading progress in chapters and never in percent", async () => {
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [
        {
          id: "s1",
          objectType: "SERIES",
          title: "我的继续阅读",
          chapterIndex: 3,
          chapterCount: 8,
          chapterTitle: "第三章 · 边界",
        },
      ],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();

    expect(await screen.findByText("上次阅读 · 第 3 章")).toBeInTheDocument();
    expect(screen.getByText("3/8")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "已读到第 3 章，共 8 章" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    // `series_reader_state` has no percentage — nothing may render one.
    expect(document.body.textContent).not.toMatch(/\d+\s*%/);
  });

  it("renders a follow button that flips only after the request succeeds", async () => {
    topicsMocked.getTopics.mockResolvedValue([{ id: "t1", slug: "ai", name: "AI" }]);
    topicsMocked.getTopicCreators.mockResolvedValue([
      { username: "linshen", displayName: "林深", contentCount: 7 },
    ]);
    usersMocked.getProfile.mockResolvedValue({
      username: "linshen",
      displayName: "林深",
      following: false,
    });
    usersMocked.followUser.mockResolvedValue(undefined);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();

    const follow = await screen.findByRole("button", { name: "关注" });
    expect(screen.getByRole("heading", { name: "推荐创作者" })).toBeInTheDocument();

    fireEvent.click(follow);

    await waitFor(() => expect(usersMocked.followUser).toHaveBeenCalledWith("linshen"));
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
  });
});

describe("home feed rows", () => {
  it("uses real covers first and deterministic visuals for coverless content", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        discoveries: [
          {
            id: "article-cover",
            objectType: "ARTICLE",
            title: "真实封面",
            cover: "/article-cover.jpg",
          },
          { id: "article-fallback", objectType: "ARTICLE", title: "文章 fallback" },
          { id: "series-fallback", objectType: "SERIES", title: "系列 fallback" },
          { id: "moment-fallback", objectType: "MOMENT", title: "动态 fallback" },
          { id: "unknown-fallback", objectType: "UNKNOWN", title: "未知 fallback" },
        ],
      }),
    );

    renderHome();

    expect(await screen.findByText("真实封面")).toBeInTheDocument();
    expect(document.querySelector('img[src="/article-cover.jpg"]')).toBeInTheDocument();
    expect(screen.getAllByTestId("content-visual")).toHaveLength(3);
    expect(screen.getAllByTestId("generated-series-cover")).toHaveLength(1);
  });

  it("renders the enrichment it was given, and nothing it was not", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        // `getGuestHome` resolves to the MAPPED view, so these are ContentSummary
        // rows (`id`, not the wire's `objectId`) — same as the other tests here.
        discoveries: [
          {
            id: "d1",
            objectType: "ARTICLE",
            title: "带富化字段的条目",
            authorName: "林深",
            updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            likeCount: 128,
            commentCount: 12,
            tags: ["设计系统", "前端工程化"],
          },
          { id: "d2", objectType: "ARTICLE", title: "只有标题的条目" },
        ],
      }),
    );

    renderHome();

    expect(await screen.findByText("带富化字段的条目")).toBeInTheDocument();
    expect(screen.getByText("林深")).toBeInTheDocument();
    expect(screen.getByText("3 小时前")).toBeInTheDocument();
    expect(screen.getByText("#设计系统")).toBeInTheDocument();
    expect(screen.getByLabelText("128 次点赞")).toBeInTheDocument();
    expect(screen.getByLabelText("12 条评论")).toBeInTheDocument();

    // The bare row must not borrow the rich row's data.
    expect(screen.queryByText("0 次点赞")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/次点赞/)).toHaveLength(1);
  });
});

describe("home degradation", () => {
  it("keeps the page alive when a non-critical rail module fails", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客推荐条目" }] }),
    );
    // Announcements is non-critical: its failure is contained to its own module.
    homeMocked.getAnnouncements.mockRejectedValue(new Error("boom"));
    eventsMocked.list.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => expect(homeMocked.getAnnouncements).toHaveBeenCalled());

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("renders nothing for a non-critical module that is empty", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客推荐条目" }] }),
    );
    homeMocked.getAnnouncements.mockResolvedValue([]);

    renderHome();

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    // Empty non-critical modules are hidden outright, not replaced by a box.
    expect(screen.queryByRole("heading", { name: "热门话题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "推荐创作者" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "社区活动" })).not.toBeInTheDocument();
    // With every rail empty the whole column goes, so the feed takes full width.
    expect(screen.queryByLabelText("社区侧栏")).not.toBeInTheDocument();
  });

  it("shows a fatal error when the home composition endpoint fails", async () => {
    homeMocked.getGuestHome.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});

describe("home feed 收藏", () => {
  function signedInHome(item: ContentSummary) {
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [item],
      draftArticles: [],
      pendingActions: [],
    });
  }

  it("does not offer a save button to a guest — unknown is not 'not saved'", async () => {
    // The server serialises an unknown bookmark state as JSON null for guests, which arrives
    // as `null` rather than `undefined` — a truthiness check alone would render the button.
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        discoveries: [{ id: "d1", objectType: "ARTICLE", title: "游客条目", bookmarked: null }],
      }),
    );

    renderHome();

    expect(await screen.findByText("游客条目")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /收藏/ })).not.toBeInTheDocument();
  });

  it("flips the save button only after the request succeeds", async () => {
    signedInHome({ id: "r1", objectType: "ARTICLE", title: "推荐条目", bookmarked: false });
    interactionsMocked.addBookmark.mockResolvedValue(undefined);

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "收藏" }));

    await waitFor(() =>
      expect(interactionsMocked.addBookmark).toHaveBeenCalledWith("ARTICLE", "r1"),
    );
    expect(await screen.findByRole("button", { name: "已收藏" })).toBeInTheDocument();
  });

  it("leaves the button alone and explains itself when the request fails", async () => {
    signedInHome({ id: "r1", objectType: "ARTICLE", title: "推荐条目", bookmarked: false });
    interactionsMocked.addBookmark.mockRejectedValue(new Error("boom"));

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "收藏" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Still un-saved: flipping first and leaving it flipped is exactly what this avoids.
    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已收藏" })).not.toBeInTheDocument();
  });

  it("un-saves an already saved item", async () => {
    signedInHome({ id: "r1", objectType: "ARTICLE", title: "推荐条目", bookmarked: true });
    interactionsMocked.removeBookmark.mockResolvedValue(undefined);

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "已收藏" }));

    await waitFor(() =>
      expect(interactionsMocked.removeBookmark).toHaveBeenCalledWith("ARTICLE", "r1"),
    );
    expect(await screen.findByRole("button", { name: "收藏" })).toBeInTheDocument();
  });
});

describe("home feed 点赞", () => {
  function signedInHome(item: ContentSummary) {
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [item],
      draftArticles: [],
      pendingActions: [],
    });
  }

  it("keeps the count as plain text for a guest instead of a button", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        discoveries: [
          { id: "d1", objectType: "ARTICLE", title: "游客条目", likeCount: 7, liked: null },
        ],
      }),
    );

    renderHome();

    expect(await screen.findByText("游客条目")).toBeInTheDocument();
    // The COUNT is not viewer-scoped, so a guest still sees it — just not as a control.
    expect(screen.getByLabelText("7 次点赞")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /次点赞/ })).not.toBeInTheDocument();
  });

  it("likes an item and moves the count by one, only after the request succeeds", async () => {
    signedInHome({
      id: "r1",
      objectType: "ARTICLE",
      title: "推荐条目",
      likeCount: 128,
      liked: false,
    });
    interactionsMocked.like.mockResolvedValue(undefined);

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "128 次点赞" }));

    await waitFor(() => expect(interactionsMocked.like).toHaveBeenCalledWith("ARTICLE", "r1"));
    expect(await screen.findByRole("button", { name: "129 次点赞" })).toBeInTheDocument();
  });

  it("un-likes an already liked item", async () => {
    signedInHome({
      id: "r1",
      objectType: "ARTICLE",
      title: "推荐条目",
      likeCount: 129,
      liked: true,
    });
    interactionsMocked.unlike.mockResolvedValue(undefined);

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "129 次点赞" }));

    await waitFor(() => expect(interactionsMocked.unlike).toHaveBeenCalledWith("ARTICLE", "r1"));
    expect(await screen.findByRole("button", { name: "128 次点赞" })).toBeInTheDocument();
  });

  it("leaves the count untouched when the like fails", async () => {
    signedInHome({
      id: "r1",
      objectType: "ARTICLE",
      title: "推荐条目",
      likeCount: 128,
      liked: false,
    });
    interactionsMocked.like.mockRejectedValue(new Error("boom"));

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "128 次点赞" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "128 次点赞" })).toBeInTheDocument();
  });
});

describe("home hero", () => {
  /** HomeHeroArt is the only SVG in the app with this viewBox. */
  const ARTWORK = 'svg[viewBox="0 0 320 190"]';

  it("gives a guest the full banner, artwork and all", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客条目" }] }),
    );

    const { container } = renderHome();
    await screen.findByText("游客条目");

    const hero = container.querySelector("section");
    expect(hero).not.toBeNull();
    expect(hero).not.toHaveAttribute("data-compact");
    expect(hero!.querySelector(ARTWORK)).not.toBeNull();
  });

  it("gives a signed-in reader a compact greeting instead of the full banner", async () => {
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [{ id: "r1", title: "为我推荐" }],
      draftArticles: [],
      pendingActions: [],
    });

    const { container } = renderHome();
    await screen.findByText("为我推荐");

    // The prototype asks for 「登录：简洁欢迎语，不占太多空间」: no artwork, no corner
    // glow, smaller title — the feed starts higher up the page.
    const hero = container.querySelector("section");
    expect(hero).toHaveAttribute("data-compact", "true");
    expect(hero!.querySelector(ARTWORK)).toBeNull();
  });
});
