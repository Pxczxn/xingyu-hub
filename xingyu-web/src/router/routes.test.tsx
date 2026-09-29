import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { buildRedirectPath, LEGACY_REDIRECTS } from "@/router/redirects";

/*
 * Route smoke tests render the real pages, so the network layer is mocked.
 * This keeps assertions deterministic (no act() warnings from async fetches).
 */
vi.mock("@/api/home/home.api", () => ({
  homeApi: {
    getGuestHome: vi.fn(async () => ({
      unreadNotifications: 0,
      continueReading: [],
      followingUpdates: [],
      discoveries: [],
    })),
    getMyHome: vi.fn(async () => ({
      continueReading: [],
      followUpdates: [],
      recommendations: [],
      draftArticles: [],
      pendingActions: [],
    })),
    getAnnouncements: vi.fn(async () => []),
  },
}));

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(async () => []),
    getTopic: vi.fn(async () => ({ id: "1", slug: "demo", name: "演示话题" })),
    getTopicContent: vi.fn(async () => []),
    getTopicCreators: vi.fn(async () => []),
    followTopic: vi.fn(async () => undefined),
    unfollowTopic: vi.fn(async () => undefined),
  },
}));

vi.mock("@/api/discover/discover.api", () => ({
  discoverApi: {
    getDiscoverNav: vi.fn(async () => ({ mode: "official", domainTabs: [], sortTabs: [] })),
    getDiscover: vi.fn(async () => ({ items: [], total: 0 })),
    search: vi.fn(async () => ({ items: [], total: 0 })),
  },
}));

// Phase 1B: /articles/:id and /u/:username are now real pages.
vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    getArticle: vi.fn(async () => ({
      id: "abc-123",
      title: "路由测试文章",
      summary: null,
      body: "正文",
      slug: null,
      visibility: "PUBLIC",
      spaceSlug: "default",
      ownerUsername: "tester",
      publishedAt: null,
      owner: false,
    })),
    // Phase 1C-3: present so the editor route can never hit an undefined API if a
    // future test navigates there.
    createDraft: vi.fn(),
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    submitForReview: vi.fn(),
    getMyArticleStatus: vi.fn(async () => "DRAFT"),
  },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(async () => ({ username: "tester", displayName: "Tester", owner: false })),
    getUserWorks: vi.fn(async () => ({ username: "tester", spaceSlug: "default", owner: false, categories: [], works: [] })),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    getMyProfile: vi.fn(),
    // Phase 2A-1 write methods — present so the settings routes can never call
    // an undefined API if a future test navigates there.
    updateMyProfile: vi.fn(),
    updateMyPrivacy: vi.fn(),
    // Phase 2A-2a block methods — same reason.
    listBlockedUsers: vi.fn(async () => []),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

vi.mock("@/api/settings/sessions.api", () => ({
  sessionsApi: { list: vi.fn(async () => []), revoke: vi.fn(), revokeOthers: vi.fn() },
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

/**
 * Router smoke tests: every Phase 0 route resolves, the 404 fallback works,
 * and the approved Legacy redirects rewrite URLs correctly.
 */

function LocationProbe() {
  const location = useLocation();
  const [params] = useSearchParams();
  return (
    <>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="current-return-to">{params.get("returnTo") ?? ""}</div>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <LocationProbe />
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("router", () => {
  it("renders the Home skeleton at /", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "社区公告" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "为你推荐" })).toBeInTheDocument();
  });

  it("renders the login page at /login", () => {
    renderAt("/login");
    expect(screen.getByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.getByLabelText("账号")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
  });

  it("renders the real article page at /articles/:articleId", async () => {
    renderAt("/articles/abc-123");
    // Phase 1C-1 made this a route-level lazy chunk; the on-demand transform of
    // the Markdown reading pipeline needs a real budget in the test environment.
    expect(
      await screen.findByRole("heading", { name: "路由测试文章" }, { timeout: 15000 }),
    ).toBeInTheDocument();
  }, 30000);

  it("renders the real public profile at /u/:username", async () => {
    renderAt("/u/tester");
    expect(await screen.findByRole("heading", { name: "Tester" })).toBeInTheDocument();
  });

  it("sends guests from /me to login", async () => {
    renderAt("/me");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
  });

  it("renders the 404 fallback for unknown paths", () => {
    renderAt("/definitely-not-a-route");
    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });

  it("redirects /tags to /topics", async () => {
    renderAt("/tags");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/topics");
    });
  });

  it("redirects /users/:username to /u/:username preserving the param", async () => {
    renderAt("/users/alice");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/u/alice");
    });
  });

  it("redirects /settings and /me/profile to the auth-guarded settings profile", async () => {
    // Phase 2A-1 built /settings/profile, so the redirect now lands on a real
    // (auth-guarded) route instead of the 404 fallback. A guest is therefore
    // forwarded one hop further, to login — and `returnTo` is the evidence that
    // the legacy redirect resolved to /settings/profile and not somewhere else.
    renderAt("/settings");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/profile");
  });
});

describe("legacy redirect table", () => {
  it("contains exactly the five approved Phase 0 redirects", () => {
    expect(LEGACY_REDIRECTS.map((r) => r.from)).toEqual([
      "/users/:username",
      "/tags",
      "/articles",
      "/me/profile",
      "/settings",
    ]);
  });

  it("substitutes route params into the target path", () => {
    expect(buildRedirectPath("/u/:username", { username: "alice" })).toBe("/u/alice");
  });

  it("encodes param values", () => {
    expect(buildRedirectPath("/u/:username", { username: "a b" })).toBe("/u/a%20b");
  });
});

describe("phase 1A routes", () => {
  it("renders the discover page at /discover", async () => {
    renderAt("/discover");
    expect(screen.getByRole("heading", { name: "发现" })).toBeInTheDocument();
    // Wait for the (mocked, empty) feed so no state update lands after the test.
    await waitFor(() => expect(screen.getByTestId("page-state-empty")).toBeInTheDocument());
  });

  it("renders the search page at /search", () => {
    renderAt("/search");
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("renders the topics plaza at /topics", async () => {
    renderAt("/topics");
    expect(screen.getByRole("heading", { name: "话题广场" })).toBeInTheDocument();
    // Wait for the (mocked, empty) topics request so no state update lands after the test.
    await waitFor(() => expect(screen.getByTestId("page-state-empty")).toBeInTheDocument());
  });

  it("renders topic detail at /topics/:slug", async () => {
    renderAt("/topics/demo");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "演示话题" })).toBeInTheDocument();
    });
  });

  it("renders the register page at /register", () => {
    renderAt("/register");
    expect(screen.getByRole("heading", { name: "注册星语" })).toBeInTheDocument();
  });

  it("renders the forgot-password page", () => {
    renderAt("/forgot-password");
    expect(screen.getByRole("heading", { name: "找回密码" })).toBeInTheDocument();
  });

  it("renders the pending-audit page", () => {
    renderAt("/register/pending-audit?registered=1");
    expect(screen.getByRole("heading", { name: "注册已提交" })).toBeInTheDocument();
  });
});
