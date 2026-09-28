import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

vi.mock("@/api/auth/auth.api", () => ({
  authApi: { getMe: vi.fn(), login: vi.fn(), logout: vi.fn(), getPublicConfig: vi.fn() },
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

vi.mock("@/api/social/social.api", () => ({
  socialApi: {
    listMyFollowing: vi.fn(async () => []),
    listMyFollowers: vi.fn(async () => []),
    listUserFollowing: vi.fn(async () => []),
    listUserFollowers: vi.fn(async () => []),
  },
}));

function LocationProbe() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
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
});

/*
 * Phase 2I-1: both follow routes are RequireAuth and self-scoped, so a guest
 * must be bounced to /login carrying the exact path back.
 */
describe("phase 2I-1 follow routes", () => {
  it.each(["/me/following", "/me/followers"])(
    "sends a guest from %s to login with returnTo",
    async (path) => {
      renderAt(path);
      await waitFor(() => {
        expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
      });
      expect(screen.getByTestId("current-return-to")).toHaveTextContent(path);
    },
  );
});
