import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /feedback/recommendations (Phase 3F).
 *
 * Guards + module-level import health. Both verbs of the endpoint are session-
 * scoped, so the whole route is RequireAuth.
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

const list = vi.fn();

vi.mock("@/api/recommendation-feedback/recommendation-feedback.api", () => ({
  recommendationFeedbackApi: {
    list: (...args: unknown[]) => list(...args),
    submit: vi.fn(async () => ({ id: "new", body: "x", createdAt: "2026-09-28T10:00:00Z" })),
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
  list.mockResolvedValue([]);
});

describe("phase 3F route resolution", () => {
  it("routes /feedback/recommendations to the feedback page", async () => {
    renderAt("/feedback/recommendations", true);
    expect(await screen.findByRole("heading", { name: "推荐反馈" })).toBeInTheDocument();
    expect(await screen.findByText("还没有提交过反馈")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen and does NOT read the list", async () => {
    renderAt("/feedback/recommendations", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("renders the scope note through the real router", async () => {
    // The misunderstanding guard must survive the full render path.
    renderAt("/feedback/recommendations", true);
    expect(await screen.findByText(/整个推荐系统/)).toBeInTheDocument();
  });
});
