import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Which component a URL reaches (Phase 2I-5).
 *
 * `/me/moments` and `/moments` are different pages reading different endpoints:
 * `/moments` is the public guest-readable feed, `/me/moments` is the session
 * user's own history. Rendering the real route table is the only way to see the
 * decision the router actually makes, and the guard is half the contract.
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

vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: {
    list: vi.fn(async () => []),
    listMine: vi.fn(async () => []),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
  },
  meInsightsApi: {
    get: vi.fn(async () => ({
      articleCount: 0,
      draftCount: 0,
      followerCount: 0,
      followingCount: 0,
      commentCount: 0,
      likeCount: 0,
    })),
  },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(async () => ({ username: "tester", displayName: "测试用户" })),
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

describe("phase 2I-5 route resolution", () => {
  it("routes /me/moments to the owner history, not to the public feed", async () => {
    renderAt("/me/moments", true);

    // The owner page's own section heading; the public feed does not render it.
    expect(await screen.findByText("全部动态")).toBeInTheDocument();
    expect(screen.getByText("还没有动态")).toBeInTheDocument();
    // The feed's compose form must not appear here — publishing lives on /moments.
    expect(screen.queryByRole("heading", { name: "动态概览" })).toBeInTheDocument();
    expect(screen.queryByLabelText("动态正文")).not.toBeInTheDocument();
  });

  it("still routes /moments to the public feed", async () => {
    renderAt("/moments", false);

    expect(await screen.findByRole("heading", { name: "动态" })).toBeInTheDocument();
    expect(screen.queryByText("动态概览")).not.toBeInTheDocument();
  });
});

describe("phase 2I-5 route guards", () => {
  it("bounces a guest from /me/moments to login", async () => {
    renderAt("/me/moments", false);

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByText("还没有动态")).not.toBeInTheDocument();
  });

  it("lets a signed-in user into /me/moments", async () => {
    renderAt("/me/moments", true);

    expect(await screen.findByText("全部动态")).toBeInTheDocument();
  });
});
