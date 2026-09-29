import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for 我的投稿 / 投稿详情 (Phase 2K-2).
 *
 * Two things matter here and nowhere else:
 *
 *  1. BOTH routes are session-scoped (`/me/submissions*` on the API side), so a
 *     guest must be bounced to the login screen — not shown an empty list that
 *     would read as "you have no submissions".
 *  2. The FRONT-END path is `/studio/submissions*`, the API path is
 *     `/me/submissions*`. That split is deliberate (Legacy hosted it under the
 *     studio) and easy to break by "fixing" the route to match the API, so it
 *     gets its own guard.
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

vi.mock("@/api/submissions/submissions.api", () => ({
  submissionsApi: {
    listMine: vi.fn(async () => [
      {
        id: "s1",
        articleId: "a1",
        title: "一篇投稿",
        coverUrl: null,
        status: "PENDING",
        submittedAt: "2026-09-01T10:00:00Z",
        decision: null,
        decisionComment: null,
      },
    ]),
    getById: vi.fn(async () => ({
      id: "s1",
      articleId: "a1",
      title: "一篇投稿",
      coverUrl: null,
      status: "PENDING",
      submittedAt: "2026-09-01T10:00:00Z",
      decision: null,
      decisionComment: null,
    })),
    withdraw: vi.fn(async () => ({ id: "s1", status: "WITHDRAWN" })),
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

describe("phase 2K-2 route resolution", () => {
  it("routes /studio/submissions to the submissions list", async () => {
    renderAt("/studio/submissions", true);
    expect(await screen.findByRole("heading", { name: /我的投稿/ })).toBeInTheDocument();
    expect(screen.getByLabelText("我的投稿列表")).toBeInTheDocument();
  });

  it("routes /studio/submissions/:submissionId to the detail page", async () => {
    renderAt("/studio/submissions/s1", true);
    expect(await screen.findByRole("heading", { name: "投稿详情" })).toBeInTheDocument();
  });

  it("keeps the list and the detail as distinct routes (no shadowing)", async () => {
    // If the param route were declared first, /studio/submissions would match it
    // with submissionId === "submissions".
    renderAt("/studio/submissions", true);
    await screen.findByRole("heading", { name: /我的投稿/ });
    expect(screen.queryByRole("heading", { name: "投稿详情" })).not.toBeInTheDocument();
  });

  it("sends a GUEST from the list route to the login screen", async () => {
    renderAt("/studio/submissions", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("sends a GUEST from the detail route to the login screen", async () => {
    renderAt("/studio/submissions/s1", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("preserves the studio path (not the /me API path) in the URL contract", async () => {
    // Guard against someone renaming the route to mirror the API path.
    const { unmount } = renderAt("/studio/submissions", true);
    await screen.findByRole("heading", { name: /我的投稿/ });
    unmount();

    // A /me/submissions URL is NOT a V2 route — it must fall through to the
    // catch-all NotFound, proving the two paths are genuinely distinct.
    renderAt("/me/submissions", true);
    expect(await screen.findByRole("heading", { name: "页面不存在" })).toBeInTheDocument();
  });
});
