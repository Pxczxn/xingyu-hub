import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

const GALAXY = { id: "g-1", slug: "xingyu-official", name: "星语", official: true, memberCount: 12 };

vi.mock("@/api/galaxies/galaxies.api", () => ({
  galaxiesApi: {
    list: vi.fn(async () => [GALAXY]),
    getBySlug: vi.fn(async () => GALAXY),
    listMembers: vi.fn(async () => []),
    listContent: vi.fn(async () => []),
    listMine: vi.fn(async () => []),
    join: vi.fn(),
    apply: vi.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
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
 * Phase 2H regression: all four galaxy routes must be guest-reachable. The
 * galaxy routes are keyed by slug, so the param name in the URL is part of the
 * contract — /galaxies/{id} deliberately does NOT exist.
 */
describe("phase 2H galaxy routes", () => {
  it("renders the square for a guest", async () => {
    renderAt("/galaxies");
    expect(await screen.findByRole("heading", { level: 1, name: "星系" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/galaxies");
  });

  it("renders the detail page for a guest", async () => {
    renderAt("/galaxies/xingyu-official");
    expect(await screen.findByRole("heading", { level: 1, name: "星语" })).toBeInTheDocument();
  });

  it("renders the roster for a guest", async () => {
    renderAt("/galaxies/xingyu-official/members");
    expect(await screen.findByText("共 0 位公开成员")).toBeInTheDocument();
  });

  it("renders the content feed for a guest", async () => {
    renderAt("/galaxies/xingyu-official/content");
    expect(await screen.findByRole("link", { name: "内容" })).toHaveAttribute("aria-current", "page");
  });

  it("does not send guests to login from any galaxy route", async () => {
    renderAt("/galaxies/xingyu-official");
    await screen.findByRole("heading", { level: 1, name: "星语" });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/galaxies/xingyu-official");
  });

  it("exposes 星系 in the global nav", async () => {
    renderAt("/galaxies");
    const nav = await screen.findByRole("navigation", { name: "主导航" });
    expect(nav).toHaveTextContent("星系");
  });
});
