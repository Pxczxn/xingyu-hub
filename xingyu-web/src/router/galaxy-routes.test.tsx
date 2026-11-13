import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const GALAXY = {
  id: "g-1",
  slug: "xingyu-official",
  name: "星语",
  official: true,
  memberCount: 12,
};

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
    expect(await screen.findByRole("link", { name: "内容" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not send guests to login from any galaxy route", async () => {
    renderAt("/galaxies/xingyu-official");
    await screen.findByRole("heading", { level: 1, name: "星语" });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/galaxies/xingyu-official");
  });

  it("exposes the three primary nav items and the md search field", async () => {
    renderAt("/galaxies");
    const nav = await screen.findByRole("navigation", { name: "主导航" });
    expect(within(nav).getByRole("link", { name: "首页" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "发现" })).toHaveAttribute("href", "/discover");
    expect(within(nav).getByRole("link", { name: "星系" })).toHaveAttribute("href", "/galaxies");
    expect(within(nav).queryByRole("link", { name: "话题" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "系列" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "动态" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "指南" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "星系" }).querySelector("svg")).toHaveClass(
      "lg:block",
    );
    const search = screen.getByRole("search");
    expect(search.className).toContain("md:block");
    expect(search.className).not.toContain("min-[1440px]:block");
    expect(await screen.findByRole("tablist", { name: "星系" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "探索星系" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "我的星系" })).toBeInTheDocument();
  });
});
