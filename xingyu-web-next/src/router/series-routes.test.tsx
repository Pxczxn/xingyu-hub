import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
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

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(async () => []),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

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
});

describe("phase 2F series routes", () => {
  it.each([
    ["/studio/series", "/studio/series"],
    ["/studio/series/new", "/studio/series/new"],
    ["/studio/series/ser-1/edit", "/studio/series/ser-1/edit"],
    ["/studio/series/ser-1/articles", "/studio/series/ser-1/articles"],
  ])("sends a guest from %s to login with returnTo", async (path, returnTo) => {
    renderAt(path);
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent(returnTo);
  });
});
