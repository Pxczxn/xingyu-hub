import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for the collaboration pages (Phase 2M).
 *
 * `/studio/collaboration` and `/studio/collaboration/accept` are SIBLINGS — the
 * accept page is a distinct route, not a child of the create page. If the accept
 * route were ever declared as a nested path or swallowed by a param, a user
 * following a real invite link would land somewhere that silently cannot read
 * the token. This file pins that the two resolve to different pages.
 *
 * Both are RequireAuth, so a guest must be bounced to login from each.
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

vi.mock("@/api/collaboration/collaboration.api", () => ({
  collaborationApi: {
    createInvite: vi.fn(),
    // The accept page resolves on mount; return a valid invite so the page
    // renders its ready state rather than the invalid one.
    resolveInvite: vi.fn(async () => ({
      valid: true,
      inviterUsername: "alice",
      inviterDisplayName: "爱丽丝",
      note: "",
      expiresAt: "2026-10-05T10:00:00Z",
    })),
    acceptInvite: vi.fn(),
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

describe("phase 2M route resolution", () => {
  it("routes /studio/collaboration to the invite page", async () => {
    renderAt("/studio/collaboration", true);
    expect(await screen.findByRole("heading", { name: "邀请协作" })).toBeInTheDocument();
  });

  it("routes /studio/collaboration/accept to the accept page, not the invite page", async () => {
    renderAt("/studio/collaboration/accept?token=tok", true);
    expect(await screen.findByRole("heading", { name: "确认协作邀请" })).toBeInTheDocument();
    // The create page's heading must NOT win — that would mean the sibling route
    // lost the match and the token was never read.
    expect(screen.queryByTestId("collaboration-create")).not.toBeInTheDocument();
  });

  it("keeps the two collaboration routes distinct", async () => {
    renderAt("/studio/collaboration/accept?token=tok", true);
    await screen.findByRole("heading", { name: "确认协作邀请" });
    // The accept page shows the inviter; the create page does not.
    expect(screen.getByTestId("accept-inviter")).toBeInTheDocument();
  });

  it("sends a GUEST from the invite page to the login screen", async () => {
    renderAt("/studio/collaboration", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("sends a GUEST from the accept page to the login screen", async () => {
    // resolveInvite is public, but the ROUTE is gated: the accept action needs a
    // session, so bouncing a guest to login is the coherent flow.
    renderAt("/studio/collaboration/accept?token=tok", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });
});
