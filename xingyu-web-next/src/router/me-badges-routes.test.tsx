import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /me/badges (Phase 3A).
 *
 * `/me/badges` sits beside `/me/likes` and `/me/comments`, so the main risk is
 * that a bare `/me` route (MeRedirectPage) swallows it — that page redirects to
 * /u/{username} and would make the badge page unreachable.
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

vi.mock("@/api/badges/badges.api", () => ({
  badgesApi: {
    list: vi.fn(async () => [
      { id: "onboard", title: "入门完成", description: "完成入门引导", earned: true },
      { id: "first-post", title: "初次创作", description: "创建第一篇文章", earned: false },
      { id: "prolific", title: "勤耕不辍", description: "拥有 5 篇以上文章", earned: false },
      { id: "social", title: "社区之星", description: "粉丝达到 10", earned: false },
      { id: "profile", title: "名片完善", description: "填写个人简介", earned: false },
    ]),
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

describe("phase 3A route resolution", () => {
  it("routes /me/badges to the badge page", async () => {
    renderAt("/me/badges", true);
    expect(await screen.findByRole("heading", { name: "徽章成就" })).toBeInTheDocument();
    expect(screen.getByLabelText("徽章列表")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen", async () => {
    renderAt("/me/badges", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("does not let the bare /me route swallow /me/badges", async () => {
    // /me redirects to /u/{username}; if it matched first the badge page would
    // never render.
    renderAt("/me/badges", true);
    await screen.findByRole("heading", { name: "徽章成就" });
    expect(screen.queryByLabelText("徽章列表")).toBeInTheDocument();
  });
});
