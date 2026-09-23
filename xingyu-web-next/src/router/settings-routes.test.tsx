import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { usersApi } from "@/api/users/users.api";
import { sessionsApi } from "@/api/settings/sessions.api";
import { setStoredToken } from "@/lib/storage";

/*
 * Phase 2A-1 routing:
 *   - /settings/profile | /settings/privacy | /settings/sessions are real,
 *     auth-guarded pages sharing one SettingsLayout
 *   - /settings and /me/profile now resolve to a route that EXISTS
 *     (before 2A-1 both pointed at an unbuilt /settings/profile -> 404)
 *   - guests are sent to the existing login flow carrying ?returnTo=
 *
 * Only the network layer is mocked; the real router, guard and pages render.
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
  },
}));

vi.mock("@/api/settings/sessions.api", () => ({
  sessionsApi: { list: vi.fn(), revoke: vi.fn(), revokeOthers: vi.fn() },
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
  mockedGetMe.mockReset();
  mockedGetMyProfile.mockReset();
  mockedListSessions.mockReset();
  mockedGetMyProfile.mockResolvedValue({
    username: "alice",
    displayName: "Alice",
    bio: "简介",
    websiteUrl: "https://example.com",
    visibility: "PUBLIC",
    followersVisibility: "PRIVATE",
    lockVersion: 1,
  });
  mockedListSessions.mockResolvedValue([]);
});

describe("settings routes — guest access", () => {
  it("sends a guest from /settings/profile to login with returnTo", async () => {
    renderAt("/settings/profile");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/profile");
  });

  it("carries returnTo for /settings/privacy", async () => {
    renderAt("/settings/privacy");

    await waitFor(() => {
      expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/privacy");
    });
  });

  it("carries returnTo for /settings/sessions", async () => {
    renderAt("/settings/sessions");

    await waitFor(() => {
      expect(screen.getByTestId("current-return-to")).toHaveTextContent("/settings/sessions");
    });
  });

  it("never renders settings content to a guest", async () => {
    renderAt("/settings/profile");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.queryByRole("heading", { name: "设置" })).not.toBeInTheDocument();
  });
});

describe("settings routes — the two former dead redirects", () => {
  it("resolves /settings onto the real settings profile page", async () => {
    signIn();
    renderAt("/settings");

    expect(await screen.findByRole("heading", { name: "资料" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/settings/profile");
  });

  it("resolves /me/profile onto the real settings profile page", async () => {
    signIn();
    renderAt("/me/profile");

    expect(await screen.findByRole("heading", { name: "资料" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/settings/profile");
  });
});

describe("settings routes — authenticated", () => {
  it("renders the shared settings shell at /settings/profile", async () => {
    signIn();
    renderAt("/settings/profile");

    // Await the async part first: the shell heading paints immediately, but the
    // form only exists once the profile request resolves. Asserting the sync
    // element first and then reading the async one synchronously is a race.
    expect(await screen.findByLabelText("昵称")).toHaveValue("Alice");
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("renders privacy at /settings/privacy", async () => {
    signIn();
    renderAt("/settings/privacy");

    expect(await screen.findByRole("heading", { name: "隐私" })).toBeInTheDocument();
    expect(screen.getByLabelText("仅自己")).toBeChecked();
  });

  it("renders sessions at /settings/sessions", async () => {
    signIn();
    renderAt("/settings/sessions");

    expect(await screen.findByRole("heading", { name: "登录会话" })).toBeInTheDocument();
  });

  it("shows settings navigation for exactly the implemented pages", async () => {
    signIn();
    renderAt("/settings/profile");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    expect(nav).toHaveTextContent("资料");
    expect(nav).toHaveTextContent("隐私");
    expect(nav).toHaveTextContent("登录会话");

    // Unimplemented capabilities must not appear as nav entries, not even disabled.
    expect(nav).not.toHaveTextContent("通知");
    expect(nav).not.toHaveTextContent("密码");
    expect(nav).not.toHaveTextContent("邮箱");
    expect(nav).not.toHaveTextContent("头像");
    expect(nav).not.toHaveTextContent("敬请期待");
  });

  it("marks the active navigation entry", async () => {
    signIn();
    renderAt("/settings/privacy");

    const nav = await screen.findByRole("navigation", { name: "设置导航" });
    const active = nav.querySelector('[aria-current="page"]');
    expect(active).not.toBeNull();
    expect(active).toHaveTextContent("隐私");
  });
});
