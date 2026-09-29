import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /me/requests (Phase 3C).
 *
 * The page reads `messagesApi.listMyGroupJoinRequests`, which hits
 * `/api/v1/me/group-join-requests`. We mock the messages API so the test pins
 * ROUTE wiring (guarding + module-level import health), not network behaviour —
 * the API method itself is covered by `messages.api.test.ts`.
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

const listMyGroupJoinRequests = vi.fn();

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: vi.fn(async () => []),
    listMessages: vi.fn(async () => ({ items: [], nextCursor: null })),
    listMyGroupJoinRequests: (...args: unknown[]) => listMyGroupJoinRequests(...args),
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
  listMyGroupJoinRequests.mockReset();
  listMyGroupJoinRequests.mockResolvedValue([]);
});

describe("phase 3C route resolution", () => {
  it("routes /me/requests to the relationship-requests page", async () => {
    renderAt("/me/requests", true);
    expect(await screen.findByRole("heading", { name: "关系请求" })).toBeInTheDocument();
    expect(await screen.findByText("暂无入群申请")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen", async () => {
    renderAt("/me/requests", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    // The guarded page must not have fired its read for a guest.
    expect(listMyGroupJoinRequests).not.toHaveBeenCalled();
  });

  it("does not let the bare /me route swallow /me/requests", async () => {
    renderAt("/me/requests", true);
    expect(await screen.findByRole("heading", { name: "关系请求" })).toBeInTheDocument();
  });

  it("renders a submitted request with its status", async () => {
    listMyGroupJoinRequests.mockResolvedValue([
      {
        id: 7,
        conversationId: "c-77",
        conversationTitle: "前端交流群",
        joinMode: "APPROVAL",
        message: "想加入学习",
        status: "PENDING",
        createdAt: "2026-09-01T10:00:00Z",
        resolvedAt: null,
      },
    ]);
    renderAt("/me/requests", true);
    expect(await screen.findByText("前端交流群")).toBeInTheDocument();
    expect(screen.getByTestId("request-status-7")).toHaveTextContent("待处理");
  });
});
