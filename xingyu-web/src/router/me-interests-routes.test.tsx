import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /me/interests (Phase 3D).
 *
 * Guards + module-level import health. The page fans out to TWO endpoints
 * (`/explore/map` public, `/explore/me` session) so the double-async path is
 * worth exercising through the real router.
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

const getMap = vi.fn();
const getMine = vi.fn();

vi.mock("@/api/exploration/exploration.api", () => ({
  explorationApi: {
    getMap: (...args: unknown[]) => getMap(...args),
    getMine: (...args: unknown[]) => getMine(...args),
    updateMine: vi.fn(async () => ({ domains: [], customLabels: [] })),
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
  vi.clearAllMocks();
  getMap.mockResolvedValue([
    {
      id: "root-tech",
      slug: "tech",
      name: "技术",
      children: [{ id: "c-java", slug: "java", name: "Java", description: "JVM" }],
    },
  ]);
  getMine.mockResolvedValue({ domains: [], customLabels: [] });
});

describe("phase 3D route resolution", () => {
  it("routes /me/interests to the exploration page", async () => {
    renderAt("/me/interests", true);
    expect(await screen.findByRole("heading", { name: "我的探索" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Java" })).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen and does NOT fire the reads", async () => {
    renderAt("/me/interests", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(getMine).not.toHaveBeenCalled();
    // /explore/map is public, but the guarded page never mounts for a guest.
    expect(getMap).not.toHaveBeenCalled();
  });

  it("does not let the bare /me route swallow /me/interests", async () => {
    renderAt("/me/interests", true);
    expect(await screen.findByRole("heading", { name: "我的探索" })).toBeInTheDocument();
  });
});
