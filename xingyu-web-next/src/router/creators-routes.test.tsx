import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for 推荐作者 (Phase 2K-1).
 *
 * /creators is a PUBLIC aggregation page — no auth gate — so the assertions
 * here are about (a) it being reachable at all, (b) it NOT being RequireAuth,
 * and (c) the lookup being driven by the already-migrated topics/users APIs.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({
      email: "tester@pxczxn.top",
      emailVerified: true,
      mustChangePassword: false,
    })),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
  },
}));

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

// One topic + one creator, so the populated branch renders (an empty topics
// array would show the empty state and the landmark assertion would be testing
// the wrong branch).
vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(async () => [{ id: "t1", name: "星语", slug: "xingyu" }]),
    getTopicCreators: vi.fn(async () => [
      { username: "alice", displayName: "爱丽丝", contentCount: 3 },
    ]),
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(async () => ({
      username: "alice",
      displayName: "爱丽丝",
      avatar: null,
      following: false,
    })),
    getUserWorks: vi.fn(async () => ({
      username: "alice",
      spaceSlug: "alice",
      owner: false,
      categories: [],
      works: [],
    })),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    updateMyPrivacy: vi.fn(),
    listBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

function renderAt(path: string, signedIn: boolean) {
  if (signedIn) localStorage.setItem("xingyu-satoken", "test-token");
  else localStorage.clear();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("phase 2K-1 route resolution", () => {
  it("routes /creators to the aggregated creators page", async () => {
    renderAt("/creators", true);
    expect(await screen.findByRole("heading", { name: /推荐作者/ })).toBeInTheDocument();
    expect(screen.getByLabelText("推荐作者列表")).toBeInTheDocument();
  });

  it("renders the creator aggregated from the topic API", async () => {
    renderAt("/creators", true);
    expect(await screen.findByText("爱丽丝")).toBeInTheDocument();
  });

  it("shows the scope note so the client-side filter is not mistaken for a search", async () => {
    renderAt("/creators", true);
    expect(await screen.findByTestId("creators-scope-note")).toBeInTheDocument();
  });

  it("is reachable by a GUEST — /creators is not behind RequireAuth", async () => {
    // Every underlying call (topics / creators / profile / works) is public.
    renderAt("/creators", false);
    expect(await screen.findByRole("heading", { name: /推荐作者/ })).toBeInTheDocument();
    // A guest still gets the aggregation, not the login screen.
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("keeps /topics and /topics/:slug working alongside it", async () => {
    // Regression guard: inserting /creators next to the topics routes must not
    // shadow them.
    renderAt("/topics", true);
    expect(await screen.findByRole("heading", { name: /话题广场/ })).toBeInTheDocument();
  });
});

describe("phase 2K-1 navigation", () => {
  it("exposes a footer entry point to /creators", async () => {
    renderAt("/creators", true);
    const link = await screen.findByRole("link", { name: "推荐作者" });
    expect(link).toHaveAttribute("href", "/creators");
  });
});
