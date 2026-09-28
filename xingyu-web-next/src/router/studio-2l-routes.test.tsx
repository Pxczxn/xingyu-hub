import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for 历史版本 + 数据分析 (Phase 2L).
 *
 * The assertion that matters most is ORDERING: `/studio/content/:articleId`
 * would swallow `/studio/content/:articleId/versions` if declared first, and the
 * failure is silent (you land on the editor with articleId="<id>/versions").
 * React Router v6 does rank static segments above dynamic ones, but the guard
 * costs nothing and documents the intent.
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

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listRevisions: vi.fn(async () => [
      {
        id: "r1",
        revisionNumber: 2,
        title: "一次发布",
        summary: "摘要",
        visibility: "PUBLIC",
        frozenAt: "2026-09-20T10:00:00Z",
      },
    ]),
    getMyArticleStatus: vi.fn(async () => "PUBLISHED"),
    restoreRevision: vi.fn(),
    listMine: vi.fn(async () => []),
  },
}));

vi.mock("@/api/moments/moments.api", () => ({
  meInsightsApi: {
    get: vi.fn(async () => ({
      articleCount: 1,
      draftCount: 0,
      followerCount: 2,
      followingCount: 3,
      commentCount: 4,
      likeCount: 5,
    })),
  },
  momentsApi: { listMine: vi.fn(async () => []) },
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

describe("phase 2L route resolution", () => {
  it("routes /studio/analytics to the analytics page", async () => {
    renderAt("/studio/analytics", true);
    expect(await screen.findByRole("heading", { name: "创作数据分析" })).toBeInTheDocument();
  });

  it("routes /studio/content/:id/versions to the version history page", async () => {
    renderAt("/studio/content/a1/versions", true);
    expect(await screen.findByRole("heading", { name: "历史版本" })).toBeInTheDocument();
  });

  it("does NOT let /studio/content/:articleId shadow the versions route", async () => {
    // If ordering were wrong, the editor would mount with articleId="a1/versions".
    renderAt("/studio/content/a1/versions", true);
    await screen.findByRole("heading", { name: "历史版本" });
    // The versions rail is the marker that the versions route won the match.
    expect(screen.getByLabelText("版本列表")).toBeInTheDocument();
  });

  // NOTE: deliberately no test that renders the bare editor path here. EditorPage
  // needs its own much larger mock surface (getDraft, topics, settings...), and
  // pulling all of that into a route-resolution file would obscure what this file
  // is actually asserting. The editor has its own suite (editor-page.test.tsx) and
  // the shadowing risk is already covered by the test above.

  it("sends a GUEST from analytics to the login screen", async () => {
    renderAt("/studio/analytics", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });

  it("sends a GUEST from versions to the login screen", async () => {
    renderAt("/studio/content/a1/versions", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
  });
});
