import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { usersApi } from "@/api/users/users.api";
import { apiTokensApi } from "@/api/settings/api-tokens.api";
import { setStoredToken } from "@/lib/storage";

/*
 * Phase 2A-2b routing: /settings/api-tokens is a real, auth-guarded page inside
 * the existing SettingsLayout, and it appears in the settings navigation.
 * Guests are sent to the login flow carrying ?returnTo=.
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

vi.mock("@/api/settings/api-tokens.api", () => ({
  apiTokensApi: { list: vi.fn(async () => []), create: vi.fn(), revoke: vi.fn() },
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
const mockedListTokens = vi.mocked(apiTokensApi.list);

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
  mockedGetMe.mockReset();
  mockedGetMyProfile.mockReset();
  mockedListTokens.mockReset();
  mockedGetMyProfile.mockResolvedValue({
    username: "alice",
    displayName: "Alice",
    visibility: "PUBLIC",
    lockVersion: 1,
  });
  mockedListTokens.mockResolvedValue([]);
});

describe("api-tokens route — guest access", () => {
  it("sends a guest from /settings/api-tokens to login with returnTo", async () => {
    renderAt("/settings/api-tokens");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/api-tokens");
  });

  it("never fetches tokens for a guest", async () => {
    renderAt("/settings/api-tokens");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.queryByRole("heading", { name: "API Token" })).not.toBeInTheDocument();
    expect(mockedListTokens).not.toHaveBeenCalled();
  });
});

describe("api-tokens route — authenticated", () => {
  it("renders the token page inside the shared settings shell", async () => {
    signIn();

    renderAt("/settings/api-tokens");

    expect(await screen.findByRole("heading", { name: "API Token" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("shows the API Token entry in the settings navigation", async () => {
    signIn();

    renderAt("/settings/api-tokens");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    expect(nav).toHaveTextContent("API Token");
    expect(nav).toHaveTextContent("资料");
    expect(nav).toHaveTextContent("屏蔽");
  });

  it("marks the API Token entry as the active one", async () => {
    signIn();

    renderAt("/settings/api-tokens");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    await waitFor(() => {
      const active = nav.querySelector('[aria-current="page"]');
      expect(active).not.toBeNull();
      expect(active).toHaveTextContent("API Token");
    });
  });
});
