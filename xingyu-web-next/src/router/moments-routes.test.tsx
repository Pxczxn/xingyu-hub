import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { meInsightsApi, momentsApi } from "@/api/moments/moments.api";
import { usersApi } from "@/api/users/users.api";

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

vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: {
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    listMine: vi.fn(),
  },
  // Phase 2I-5: /me/moments renders the counters panel, so this module must
  // expose the insights client too or the import resolves to undefined.
  meInsightsApi: { get: vi.fn() },
}));

// Phase 2I-5: the owner page also reads the profile for its header.
vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getMyProfile: vi.fn(async () => ({ username: "tester", displayName: "测试用户" })),
  },
}));

const mockedGetMe = vi.mocked(authApi.getMe);
const mockedMoments = vi.mocked(momentsApi);
const mockedInsights = vi.mocked(meInsightsApi);
const mockedUsers = vi.mocked(usersApi);

const VIEW = {
  id: "m-1",
  body: "今晚看见流星",
  authorId: "user-a",
  createdAt: "2026-09-24T16:43:08Z",
};

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

function renderAt(path: string, { signedIn = false }: { signedIn?: boolean } = {}) {
  if (signedIn) {
    localStorage.setItem("xingyu-satoken", "test-token");
    // A stored token makes the auth store validate it, so getMe must resolve or
    // RequireAuth bounces to /login.
    mockedGetMe.mockResolvedValue({
      email: "tester@pxczxn.top",
      emailVerified: true,
      mustChangePassword: false,
    } as Awaited<ReturnType<typeof authApi.getMe>>);
  }
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
  mockedMoments.list.mockResolvedValue([]);
  mockedMoments.getById.mockResolvedValue(VIEW);
  mockedMoments.listMine.mockResolvedValue([]);
  // The owner page's decoration reads: resolving them keeps its effects from
  // touching undefined promises (a vi.fn() with no return value).
  mockedInsights.get.mockResolvedValue({
    articleCount: 0,
    draftCount: 0,
    followerCount: 0,
    followingCount: 0,
    commentCount: 0,
    likeCount: 0,
  });
  mockedUsers.getMyProfile.mockResolvedValue({
    username: "tester",
    displayName: "测试用户",
  } as Awaited<ReturnType<typeof usersApi.getMyProfile>>);
});

describe("phase 2D moment routes", () => {
  it("lets a guest open /moments without a login redirect", async () => {
    renderAt("/moments");
    expect(await screen.findByRole("heading", { name: "动态" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/moments");
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("lets a guest open /moments/:id without a login redirect", async () => {
    renderAt("/moments/m-1");
    expect(await screen.findByText("今晚看见流星")).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/moments/m-1");
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  // Phase 2D pinned /me/moments as NOT hosted. Phase 2I-5 deliberately changed
  // that: the owner's own history is now a real page. A guest still cannot reach
  // it (RequireAuth), so the meaningful assertion is the redirect, not a 404.
  it("hosts /me/moments as a signed-in page, gated for guests", async () => {
    renderAt("/me/moments", { signedIn: true });
    expect(await screen.findByText("全部动态")).toBeInTheDocument();
    expect(screen.queryByText("页面不存在")).not.toBeInTheDocument();
  });

  it("sends a guest from /me/moments to login", async () => {
    renderAt("/me/moments");
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByText("页面不存在")).not.toBeInTheDocument();
  });

  it("does not host /moments/:id/edit as a page", async () => {
    renderAt("/moments/m-1/edit");
    expect(await screen.findByText("页面不存在")).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/moments/m-1/edit");
  });

  it("sends a guest from the publish CTA to login with returnTo=/moments", async () => {
    renderAt("/moments");
    const link = await screen.findByRole("link", { name: "发布动态" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fmoments");
  });

  it("exposes 动态 in the app shell", async () => {
    renderAt("/moments");
    expect(await screen.findByRole("heading", { name: "动态" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toHaveTextContent("动态");
  });
});
