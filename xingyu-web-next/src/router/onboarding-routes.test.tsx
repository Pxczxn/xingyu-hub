import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { onboardingApi } from "@/api/onboarding/onboarding.api";
import { setStoredToken } from "@/lib/storage";

vi.mock("@/api/auth/auth.api", () => ({
  authApi: { getMe: vi.fn(), login: vi.fn(), logout: vi.fn(), getPublicConfig: vi.fn() },
}));

vi.mock("@/api/onboarding/onboarding.api", () => ({
  onboardingApi: { get: vi.fn(), update: vi.fn() },
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

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(async () => ({ username: "alice", displayName: "Alice", lockVersion: 1 })),
    updateMyProfile: vi.fn(),
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    listBlockedUsers: vi.fn(async () => []),
  },
}));

const mockedGetMe = vi.mocked(authApi.getMe);
const mockedOnboardingGet = vi.mocked(onboardingApi.get);

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

beforeEach(() => {
  localStorage.clear();
  mockedGetMe.mockReset();
  mockedOnboardingGet.mockReset();
  mockedOnboardingGet.mockResolvedValue({
    step: "WELCOME",
    interestsJson: null,
    completed: false,
  });
});

describe("onboarding routes", () => {
  it("sends a guest from /onboarding to login with returnTo", async () => {
    renderAt("/onboarding");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/onboarding");
  });

  it("renders the onboarding page for a signed-in user", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "alice@pxczxn.top",
      emailVerified: true,
      username: "alice",
    });

    renderAt("/onboarding");

    expect(await screen.findByRole("heading", { name: "欢迎来到星语" })).toBeInTheDocument();
  });

  it("aliases Legacy onboarding subpaths onto /onboarding", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "alice@pxczxn.top",
      emailVerified: true,
      username: "alice",
    });

    renderAt("/onboarding/interests?returnTo=%2Fstudio");

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/onboarding");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/studio");
  });
});
