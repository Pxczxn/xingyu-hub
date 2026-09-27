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
    getById: vi.fn(async () => ({
      id: "r1",
      status: "SUBMITTED",
      targetType: "ARTICLE",
      targetId: "a1",
      reason: "SPAM",
      detail: "详情",
      createdAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-09-20T10:00:00Z",
      caseId: "case-1",
      caseStatus: "OPEN",
      measureId: null,
    })),
    addSupplement: vi.fn(),
    submit: vi.fn(),
  },
  appealsApi: {
    listMine: vi.fn(async () => [
      {
        id: "ap1",
        caseId: "case-1",
        body: "申诉理由",
        status: "SUBMITTED",
        createdAt: "2026-09-20T10:00:00Z",
      },
    ]),
    getById: vi.fn(async () => ({
      id: "ap1",
      caseId: "case-1",
      body: "申诉理由",
      status: "SUBMITTED",
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
    expect(await screen.findByRole("heading", { name: /提交举报/ })).toBeInTheDocument();
    expect(screen.getByLabelText("对象 ID")).toBeInTheDocument();
    // The detail page would show this; the create page must not.
    expect(screen.queryByText("举报内容")).not.toBeInTheDocument();
  });

  it("routes /reports/:reportId to the detail page", async () => {
    renderAt("/reports/r1", true);
    expect(await screen.findByRole("heading", { name: /举报详情/ })).toBeInTheDocument();
    expect(screen.getByText("举报内容")).toBeInTheDocument();
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
    expect(screen.getByText("申诉内容")).toBeInTheDocument();
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
