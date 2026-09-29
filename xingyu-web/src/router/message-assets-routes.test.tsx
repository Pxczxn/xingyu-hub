import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Which component a URL reaches (Phase 2I-3b).
 *
 * `/messages/search` sits next to `/messages/:conversationId`, and the two are
 * different pages. react-router 7 ranks a static segment above a dynamic one, so
 * "search" must win — but that ranking is a library detail, not something this
 * app declares, and a later route inserted above it could change the outcome
 * silently. Rendering the real route table is the only way to see the decision
 * the router actually makes, so this file does exactly that.
 *
 * Everything the two pages touch on mount is mocked: the assertion is about
 * which page appeared, not about its contents (those have their own files).
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    // A resolved session is what makes RequireAuth render the protected page
    // instead of bouncing to /login — which is the thing under test here.
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

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: vi.fn(async () => []),
    getDirect: vi.fn(),
    openDirect: vi.fn(),
    getGroup: vi.fn(),
    sendDirect: vi.fn(),
    sendGroup: vi.fn(),
    listMessages: vi.fn(),
    markRead: vi.fn(),
    recallMessage: vi.fn(),
    listMedia: vi.fn(async () => []),
    listFiles: vi.fn(async () => []),
    search: vi.fn(async () => []),
  },
}));

/** A stored token, so the store has something to validate via the mocked getMe. */
function signIn() {
  localStorage.setItem("xingyu-satoken", "test-token");
}

function renderSignedInAt(path: string) {
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
  signIn();
});

describe("phase 2I-3b route resolution", () => {
  it("routes /messages/search to the search page, not to a conversation named 'search'", async () => {
    renderSignedInAt("/messages/search?q=a");

    // The search page's own heading and field — a conversation thread would
    // never render either.
    expect(await screen.findByRole("heading", { name: "搜索消息" })).toBeInTheDocument();
    expect(screen.getByLabelText("搜索消息")).toBeInTheDocument();
  });

  it("routes /messages/:id/media to the shared-media view", async () => {
    renderSignedInAt("/messages/c-1/media");

    expect(await screen.findByRole("heading", { name: "图片" })).toBeInTheDocument();
  });

  it("routes /messages/:id/files to the shared-files view", async () => {
    renderSignedInAt("/messages/c-1/files");

    expect(await screen.findByRole("heading", { name: "文件" })).toBeInTheDocument();
  });

  it("still routes a bare /messages/:id to the mailbox, not to search", async () => {
    // The regression this guards: if /messages/search were declared as
    // /messages/:conversationId, every conversation link would open search.
    renderSignedInAt("/messages/c-1");

    expect(await screen.findByRole("heading", { name: "私信" })).toBeInTheDocument();
  });
});
