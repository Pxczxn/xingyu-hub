import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

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

vi.mock("@/api/announcements/announcements.api", () => ({
  announcementsApi: {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => ({
      id: "ann-1",
      title: "路由测试公告",
      body: "正文",
      publishedAt: "2026-09-18T20:33:57Z",
    })),
  },
}));

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: {
    list: vi.fn(async () => [
      {
        id: "g1",
        slug: "getting-started",
        title: "快速上手",
        body: "目录正文",
        publishedAt: "2026-09-18T20:33:57Z",
      },
    ]),
    getBySlug: vi.fn(async () => ({
      id: "g1",
      slug: "getting-started",
      title: "快速上手",
      body: "指南正文",
      publishedAt: "2026-09-18T20:33:57Z",
    })),
    getCommunityRules: vi.fn(async () => ({
      id: "g2",
      slug: "community-rules",
      title: "社区公约",
      body: "公约正文",
      publishedAt: "2026-09-18T20:33:57Z",
    })),
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

describe("phase 2B public static-info routes", () => {
  it("lets a guest open /announcements without a login redirect", async () => {
    renderAt("/announcements");
    expect(await screen.findByRole("heading", { name: "公告中心" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/announcements");
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("lets a guest open /announcements/:id without a login redirect", async () => {
    renderAt("/announcements/ann-1");
    expect(await screen.findByRole("heading", { name: "路由测试公告" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/announcements/ann-1");
  });

  it("lets a guest open /guide without a login redirect", async () => {
    renderAt("/guide");
    expect(await screen.findByRole("heading", { name: "使用指南" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/guide");
  });

  it("lets a guest open /guide/:slug without a login redirect", async () => {
    renderAt("/guide/getting-started");
    expect(await screen.findByRole("heading", { name: "快速上手" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/guide/getting-started");
  });

  it("lets a guest open /rules without a login redirect", async () => {
    renderAt("/rules");
    expect(await screen.findByRole("heading", { name: "社区公约" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/rules");
    });
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });
});
