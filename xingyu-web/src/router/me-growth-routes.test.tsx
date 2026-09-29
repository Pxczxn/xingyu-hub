import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /me/growth (Phase 3B).
 *
 * Two things worth pinning: the bare `/me` route (MeRedirectPage) must not
 * swallow it, and the page fans out to FIVE domains — so the route test doubles
 * as a smoke test that none of those imports is broken at module level.
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

vi.mock("@/api/reading-history/reading-history.api", () => ({
  readingHistoryApi: {
    list: vi.fn(async () => ({ items: [], nextCursor: null, total: 0 })),
  },
}));

vi.mock("@/api/me-activity/me-activity.api", () => ({
  myCommentsApi: { list: vi.fn(async () => []) },
  myLikesApi: { list: vi.fn(async () => []) },
}));

vi.mock("@/api/badges/badges.api", () => ({
  badgesApi: {
    list: vi.fn(async () => [
      { id: "onboard", title: "入门完成", description: "完成入门引导", earned: true },
    ]),
  },
}));

vi.mock("@/api/moments/moments.api", () => ({
  meInsightsApi: {
    get: vi.fn(async () => ({
      articleCount: 1,
      draftCount: 0,
      followerCount: 2,
      followingCount: 3,
      commentCount: 4,
      likeCount: 5,
    })),
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

describe("phase 3B route resolution", () => {
  it("routes /me/growth to the growth page", async () => {
    renderAt("/me/growth", true);
    expect(await screen.findByRole("heading", { name: "成长记录" })).toBeInTheDocument();
    expect(screen.getByLabelText("创作数据")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen", async () => {
    renderAt("/me/growth", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("does not let the bare /me route swallow /me/growth", async () => {
    renderAt("/me/growth", true);
    await screen.findByRole("heading", { name: "成长记录" });
    expect(screen.queryByRole("heading", { name: "成长记录" })).toBeInTheDocument();
  });
});
