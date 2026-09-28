import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Route resolution for /me/groups (Phase 3E).
 *
 * Guards + module-level import health. The interesting bit is that the GROUP
 * rows link to `/messages/:conversationId` — the SAME route the mailbox uses —
 * so this test also confirms the two routes coexist under the real router.
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

const listConversations = vi.fn();

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: (...args: unknown[]) => listConversations(...args),
    createGroup: vi.fn(async () => ({ id: "g-new", type: "GROUP", title: "新群", unreadCount: 0 })),
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
  listConversations.mockResolvedValue([
    {
      id: "g1",
      type: "GROUP",
      title: "前端交流",
      updatedAt: "2026-09-28T10:00:00Z",
      unreadCount: 0,
      myRole: "OWNER",
      joinMode: "OPEN",
    },
  ]);
});

describe("phase 3E route resolution", () => {
  it("routes /me/groups to the groups page", async () => {
    renderAt("/me/groups", true);
    expect(await screen.findByRole("heading", { name: "我的群聊" })).toBeInTheDocument();
    expect(await screen.findByText("前端交流")).toBeInTheDocument();
  });

  it("sends a GUEST to the login screen and does NOT read the mailbox", async () => {
    renderAt("/me/groups", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(listConversations).not.toHaveBeenCalled();
  });

  it("does not let the bare /me route swallow /me/groups", async () => {
    renderAt("/me/groups", true);
    expect(await screen.findByRole("heading", { name: "我的群聊" })).toBeInTheDocument();
  });

  it("does not let /me/groups shadow the mailbox's own /messages/:id route", async () => {
    // Both are separate top-level routes; the group row's href must resolve under
    // the real router rather than being captured by a /me/* wildcard.
    renderAt("/me/groups", true);
    const link = await screen.findByRole("link", { name: /前端交流/ });
    expect(link).toHaveAttribute("href", "/messages/g1");
  });
});
