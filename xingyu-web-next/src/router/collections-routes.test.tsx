import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { authApi } from "@/api/auth/auth.api";

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

vi.mock("@/api/collections/collections.api", () => ({
  collectionsApi: {
    listMine: vi.fn(async () => []),
    getById: vi.fn(async () => ({
      id: "col-1",
      title: "公开读物",
      description: null,
      visibility: "PUBLIC",
      items: [],
    })),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/api/bookshelf/bookshelf.api", () => ({
  bookshelfApi: {
    list: vi.fn(async () => ({ items: [], nextCursor: null, total: 0 })),
  },
}));

const mockedGetMe = vi.mocked(authApi.getMe);

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
});

describe("phase 2C collection and bookshelf routes", () => {
  it("lets a guest open /collections/:id without a login redirect", async () => {
    renderAt("/collections/col-1");
    expect(await screen.findByRole("heading", { name: "公开读物" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/collections/col-1");
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("sends a guest from /me/collections to login with returnTo", async () => {
    renderAt("/me/collections");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/me/collections");
  });

  it("sends a guest from /me/collections/:id to login with returnTo", async () => {
    renderAt("/me/collections/col-1");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/me/collections/col-1");
  });

  it("sends a guest from /me/bookshelf to login with returnTo", async () => {
    renderAt("/me/bookshelf");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/me/bookshelf");
  });
});
