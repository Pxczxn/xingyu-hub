import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for 举报与申诉 (Phase 2J-2).
 *
 * The important things to pin:
 *  - all six routes are RequireAuth (every endpoint is session-scoped)
 *  - /reports/new and /appeals/new are NOT swallowed by the :id routes
 *  - the list pages render their own landmarks
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

// One row each, so the list branch renders (an empty array would show the empty
// state and the landmark assertions below would test the wrong branch).
vi.mock("@/api/moderation/moderation.api", () => ({
  reportsApi: {
    listMine: vi.fn(async () => [
      {
        id: "r1",
        status: "SUBMITTED",
        targetType: "ARTICLE",
        targetId: "a1",
        updatedAt: "2026-09-20T10:00:00Z",
      },
    ]),
    // `supplements` is required by the detail view — the page seeds its list
    // from this field. Omitting it would make the page throw while rendering.
    getById: vi.fn(async () => ({
      id: "r1",
      status: "SUBMITTED",
      targetType: "ARTICLE",
      targetId: "a1",
      targetTitle: "被举报的文章",
      targetSummary: null,
      reason: "SPAM",
      detail: "详情",
      createdAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-09-20T10:00:00Z",
      caseId: "case-1",
      caseStatus: "OPEN",
      measureId: null,
      supplements: [],
    })),
    addSupplement: vi.fn(),
    submit: vi.fn(),
    previewTarget: vi.fn(),
  },
  appealsApi: {
    listMine: vi.fn(async () => [
      {
        id: "ap1",
        caseId: "case-1",
        body: "申诉理由",
        status: "PENDING",
        createdAt: "2026-09-20T10:00:00Z",
      },
    ]),
    getById: vi.fn(async () => ({
      id: "ap1",
      caseId: "case-1",
      body: "申诉理由",
      status: "PENDING",
      outcome: null,
      decidedAt: null,
      decisionNote: null,
      targetType: "ARTICLE",
      targetId: "a1",
      targetTitle: "被处理的文章",
      targetSummary: null,
      measureType: "HIDE_CONTENT",
      createdAt: "2026-09-20T10:00:00Z",
    })),
    submit: vi.fn(),
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

describe("phase 2J-2 route resolution", () => {
  it("routes /reports to the report list", async () => {
    renderAt("/reports", true);
    expect(await screen.findByRole("heading", { name: /我的举报/ })).toBeInTheDocument();
    expect(screen.getByLabelText("我的举报列表")).toBeInTheDocument();
  });

  it("routes /reports/new to the create form, not to a report with id 'new'", async () => {
    renderAt("/reports/new", true);
    // The create page became context-driven: the target arrives via
    // ?objectType=&objectId=. Visited bare there is no target to report, so the
    // page shows the safe dead-end ("请从需要举报的内容页面发起举报") instead of
    // offering a raw id field to type into, and offers a way back home.
    expect(
      await screen.findByText(/请从需要举报的内容页面发起举报/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回首页/ })).toBeInTheDocument();
    // A user-facing id box belonged to the old contract; it must be gone.
    expect(screen.queryByLabelText("对象 ID")).not.toBeInTheDocument();
    // The detail page would show this; the create page must not.
    expect(screen.queryByText("举报原因与说明")).not.toBeInTheDocument();
  });

  it("routes /reports/:reportId to the detail page", async () => {
    renderAt("/reports/r1", true);
    expect(await screen.findByRole("heading", { name: /举报详情/ })).toBeInTheDocument();
    expect(screen.getByText("举报原因与说明")).toBeInTheDocument();
  });

  it("routes /appeals to the appeal list", async () => {
    renderAt("/appeals", true);
    expect(await screen.findByRole("heading", { name: /我的申诉/ })).toBeInTheDocument();
    expect(screen.getByLabelText("我的申诉列表")).toBeInTheDocument();
  });

  it("routes /appeals/new to the create form, not to an appeal with id 'new'", async () => {
    renderAt("/appeals/new?caseId=case-1&measureId=meas-1", true);
    expect(await screen.findByRole("heading", { name: /提交申诉/ })).toBeInTheDocument();
    expect(screen.getByLabelText("申诉说明")).toBeInTheDocument();
  });

  it("routes /appeals/:appealId to the detail page", async () => {
    renderAt("/appeals/ap1", true);
    expect(await screen.findByRole("heading", { name: /申诉详情/ })).toBeInTheDocument();
    expect(screen.getByText("我的申诉理由")).toBeInTheDocument();
  });
});

describe("phase 2J-2 route guards", () => {
  for (const path of [
    "/reports",
    "/reports/new",
    "/reports/r1",
    "/appeals",
    "/appeals/new",
    "/appeals/ap1",
  ]) {
    it(`bounces a guest from ${path} to login`, async () => {
      renderAt(path, false);
      expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    });
  }
});
