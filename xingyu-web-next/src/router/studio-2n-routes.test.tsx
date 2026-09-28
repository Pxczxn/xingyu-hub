import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /studio/categories (Phase 2N).
 *
 * A single new route, so the risk is small — but it IS the only /studio/*
 * sibling that could collide with a future `/studio/:something` param, and the
 * page has a distinctive marker (the 分类列表 rail) worth pinning.
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

vi.mock("@/api/creation-space/creation-space.api", () => ({
  creationSpaceApi: {
    listCategories: vi.fn(async () => [
      { id: "c1", name: "散文", slug: "essay", status: "ACTIVE", lockVersion: 0, sortOrder: 0 },
    ]),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
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

describe("phase 2N route resolution", () => {
  it("routes /studio/categories to the category manager", async () => {
    renderAt("/studio/categories", true);
    expect(
      await screen.findByRole("heading", { name: "创作空间分类" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("分类列表")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen", async () => {
    renderAt("/studio/categories", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("does not let /studio swallow /studio/categories", async () => {
    // If the bare /studio route ever gained a param segment, this would land on
    // the studio home instead.
    renderAt("/studio/categories", true);
    await screen.findByRole("heading", { name: "创作空间分类" });
    expect(screen.queryByRole("heading", { name: "创作中心" })).not.toBeInTheDocument();
  });
});
