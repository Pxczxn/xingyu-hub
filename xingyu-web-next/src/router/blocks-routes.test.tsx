import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { usersApi } from "@/api/users/users.api";
import { sessionsApi } from "@/api/settings/sessions.api";
import { setStoredToken } from "@/lib/storage";
import { __resetBlockedUsersForTests } from "@/features/blocks/blocked-users.store";

/*
 * Phase 2A-2a routing: /settings/blocks is a real, auth-guarded page inside the
 * existing SettingsLayout, and it appears in the settings navigation. Guests are
 * sent to the login flow carrying ?returnTo=.
 *
 * Only the network layer is mocked; the real router, guard, shell and page render.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: { getMe: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
    updateMyPrivacy: vi.fn(),
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    listBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

vi.mock("@/api/settings/sessions.api", () => ({
  sessionsApi: { list: vi.fn(async () => []), revoke: vi.fn(), revokeOthers: vi.fn() },
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

const mockedGetMe = vi.mocked(authApi.getMe);
const mockedGetMyProfile = vi.mocked(usersApi.getMyProfile);
const mockedListBlocked = vi.mocked(usersApi.listBlockedUsers);
const mockedListSessions = vi.mocked(sessionsApi.list);

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

function signIn() {
  setStoredToken("valid-token");
  mockedGetMe.mockResolvedValue({
    email: "alice@example.com",
    emailVerified: true,
    username: "alice",
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetBlockedUsersForTests();
  mockedGetMe.mockReset();
  mockedGetMyProfile.mockReset();
  mockedListBlocked.mockReset();
  mockedListSessions.mockReset();
  mockedGetMyProfile.mockResolvedValue({
    username: "alice",
    displayName: "Alice",
    visibility: "PUBLIC",
    lockVersion: 1,
  });
  mockedListBlocked.mockResolvedValue([]);
});

describe("blocks route — guest access", () => {
  it("sends a guest from /settings/blocks to login with returnTo", async () => {
    renderAt("/settings/blocks");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/blocks");
  });

  it("never renders the blocked-user list to a guest", async () => {
    renderAt("/settings/blocks");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.queryByRole("heading", { name: "屏蔽管理" })).not.toBeInTheDocument();
    expect(mockedListBlocked).not.toHaveBeenCalled();
  });
});

describe("blocks route — authenticated", () => {
  it("renders the blocked-user list inside the shared settings shell", async () => {
    signIn();
    mockedListBlocked.mockResolvedValue([
      { userId: "u-1", username: "bob", displayName: "Bob", blockedAt: "2026-09-23T10:00:00Z" },
    ]);

    renderAt("/settings/blocks");

    expect(await screen.findByRole("heading", { name: "屏蔽管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("shows the blocks entry in the settings navigation", async () => {
    signIn();

    renderAt("/settings/blocks");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    expect(nav).toHaveTextContent("屏蔽");
    expect(nav).toHaveTextContent("资料");
    expect(nav).toHaveTextContent("隐私");
    expect(nav).toHaveTextContent("登录会话");
  });

  it("marks the blocks entry as the active one", async () => {
    signIn();

    renderAt("/settings/blocks");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    await waitFor(() => {
      const active = nav.querySelector('[aria-current="page"]');
      expect(active).not.toBeNull();
      expect(active).toHaveTextContent("屏蔽");
    });
  });
});
