import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";
import { momentsApi } from "@/api/moments/moments.api";

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
}));

const mockedGetMe = vi.mocked(authApi.getMe);
const mockedMoments = vi.mocked(momentsApi);

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
  mockedMoments.list.mockResolvedValue([]);
  mockedMoments.getById.mockResolvedValue(VIEW);
  mockedMoments.listMine.mockResolvedValue([]);
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

  it("does not host /me/moments as a page", async () => {
    renderAt("/me/moments");
    expect(await screen.findByText("页面不存在")).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/me/moments");
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
