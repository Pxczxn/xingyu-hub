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
    // An announcement renders as an inline notice line between the masthead and the
    // tabs — not a rail module (the rail stacks below the feed on narrow screens)
    // and not a card.
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

  it("offers exactly one guest CTA — 加入星语 — and hides it for a member", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "X" }] }),
    );

    const { unmount } = renderHome();

    expect(await screen.findByRole("link", { name: /加入星语/ })).toHaveAttribute(
      "href",
      "/register",
    );
    /*
     * 登录 is deliberately NOT in the masthead. The shell header already carries a
     * 登录 entry on every route, so a second one here would offer the same action
     * twice within one first screen. The masthead keeps only the gold primary CTA.
     */
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
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

  it("shows a real last-read time for a series, and never the index time", async () => {
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [
        {
          id: "s1",
          objectType: "SERIES",
          title: "无章节的系列",
          updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "a1",
          objectType: "ARTICLE",
          title: "系列已消失的兜底条目",
          updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
      ],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();
    expect(await screen.findByText("无章节的系列")).toBeInTheDocument();

    const strip = screen.getByRole("heading", { name: "继续阅读" }).closest("section")!;
    /*
     * `ReadingService.toContinueReadingCard` fills `updatedAt` two ways: the SERIES
     * branch uses `series_reader_state.last_read_at` (a real last-read time), while
     * the ARTICLE fallback uses `search_document.indexed_at` (an index-write time).
     * Only the first is allowed to render, so exactly ONE card shows a time here.
     */
    expect((strip.textContent!.match(/小时前|天前|分钟前/g) ?? []).length).toBe(1);
    // And nothing else on the page invents a time either.
    expect((document.body.textContent!.match(/小时前|天前|分钟前/g) ?? []).length).toBe(1);
  });

  it("renders no strip at all when there is nothing to continue", async () => {
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [],
      followUpdates: [],
      recommendations: [{ id: "r1", title: "为我推荐" }],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();
    await screen.findByText("为我推荐");

    // No heading, no progressbar, no empty box left behind in the feed column.
    expect(screen.queryByRole("heading", { name: "继续阅读" })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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
    /*
     * NO TIME, even though the row carries `updatedAt`. On the home endpoint that
     * field is `search_document.indexed_at` — the moment the index row was last
     * written, not a publication time — so rendering it as 「3 小时前」 would assert
     * a fact the data does not hold. See the doc comment in HomeFeedItem.
     */
    expect(screen.queryByText("3 小时前")).not.toBeInTheDocument();
    expect(screen.queryByText(/小时前|天前/)).not.toBeInTheDocument();
    expect(screen.getByText("#设计系统")).toBeInTheDocument();
    expect(screen.getByLabelText("128 次点赞")).toBeInTheDocument();
    expect(screen.getByLabelText("12 条评论")).toBeInTheDocument();

    // The bare row must not borrow the rich row's data.
    expect(screen.queryByText("0 次点赞")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/次点赞/)).toHaveLength(1);
  });
});

describe("home feed byline", () => {
  it("is 作者 · 类型 — type as plain metadata, tags still pills", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        discoveries: [
          {
            id: "d1",
            objectType: "SERIES",
            title: "一个系列",
            authorName: "林深",
            updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            tags: ["设计系统"],
          },
        ],
      }),
    );

    renderHome();
    await screen.findByText("一个系列");

    const byline = screen.getByTestId("feed-byline");
    // Author, one separator, type. No time, because none of it is trustworthy.
    expect(byline.textContent).toBe("林深·系列");

    /*
     * The type left the pill. `rounded-full bg-muted` is the shape the TOPIC tags
     * use, so a type chip said "what kind of thing is this" and "what is this
     * about" in the same visual language. Asserted on the class contract rather
     * than on computed style, because tests run without the stylesheet.
     */
    const type = screen.getByText("系列");
    expect(type.className).not.toContain("rounded-full");
    expect(type.className).not.toContain("bg-muted");
    // The topic tag keeps it.
    expect(screen.getByText("#设计系统").className).toContain("rounded-full");
  });

  it("never leaves a dangling separator when the author is missing", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", objectType: "ARTICLE", title: "无作者条目" }] }),
    );

    renderHome();
    await screen.findByText("无作者条目");

    const byline = screen.getByTestId("feed-byline");
    expect(byline.textContent).toBe("文章");
    expect(byline.textContent).not.toContain("·");
  });

  it("drops the avatar in discovery and keeps it in the subscription feed", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({
        discoveries: [{ id: "d1", objectType: "ARTICLE", title: "推荐条目", authorName: "林深" }],
        followingUpdates: [
          { id: "f1", objectType: "ARTICLE", title: "关注条目", authorName: "林深" },
        ],
      }),
    );

    renderHome();
    await screen.findByText("推荐条目");
    // Discovery scans by content, so its rows carry no author avatar at all.
    expect(screen.queryByTestId("feed-avatar")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "关注" }));
    await screen.findByText("关注条目");
    // Subscription scans by who published, so the avatar stays.
    expect(screen.getByTestId("feed-avatar")).toBeInTheDocument();
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

describe("home masthead", () => {
  const ARTWORK = '[data-testid="home-hero-art"]';

  it("is the home's own masthead: no banner surface, and no decorative artwork", async () => {
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客条目" }] }),
    );

    const { container } = renderHome();
    await screen.findByText("游客条目");

    /*
     * A0 (2026-10-04): Home left PageHero.
     *
     * The ambient artwork carried no information — it did not illustrate the
     * sentence next to it — and the banner card made the masthead a second white
     * surface stacked above the feed panel. Both are gone, so the masthead is the
     * top of the SAME column the tabs and the feed sit in.
     */
    expect(container.querySelector(ARTWORK)).toBeNull();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("让灵感，在星语相遇");

    // A plain header, not a surface: no card fill, no border of its own.
    const masthead = heading.closest("header");
    expect(masthead).not.toBeNull();
    expect(masthead!.className).not.toContain("bg-card");
  });

  it("gives a returning reader a one-line greeting instead of the pitch", async () => {
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

    /*
     * 「登录：简洁欢迎语，不占太多空间」 is now expressed by CONTENT, not by a
     * `compact` flag: a returning reader gets a one-line greeting and no pitch, so
     * the block is shorter because there is less in it.
     */
    expect(container.querySelector(ARTWORK)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "欢迎回来，继续探索你的关注、阅读与创作。",
    );
    expect(screen.queryByRole("link", { name: /加入星语/ })).not.toBeInTheDocument();
  });
});

describe("home notice", () => {
  it("costs zero footprint when there is no announcement", async () => {
    homeMocked.getAnnouncements.mockResolvedValue([]);
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客条目" }] }),
    );

    renderHome();
    await screen.findByText("游客条目");

    // "no announcement" must cost zero height — not an empty box, not a label.
    expect(screen.queryByTestId("home-notice")).not.toBeInTheDocument();
  });

  it("renders between the masthead and the tab list when one exists", async () => {
    homeMocked.getAnnouncements.mockResolvedValue([
      { id: "n1", title: "社区公告一", body: "内容" },
    ]);
    homeMocked.getGuestHome.mockResolvedValue(
      guestHome({ discoveries: [{ id: "d1", title: "游客条目" }] }),
    );

    renderHome();
    await screen.findByText("游客条目");

    const notice = await screen.findByTestId("home-notice");
    const masthead = screen.getByRole("heading", { level: 1 }).closest("header");
    const tablist = screen.getByRole("tablist");

    expect(masthead).not.toBeNull();
    // Document order: masthead → notice → tabs. Not inside either of them.
    expect(
      masthead!.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(notice.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // It is a notice LINE, not a surface.
    expect(notice.className).not.toMatch(/bg-card|border(?!-)/);
  });
});
