import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { TOKEN_KEY } from "@/lib/storage";

/*
 * Phase 3I route wiring — asserted against the REAL route table.
 *
 * `AppRoutes` is rendered as-is (the house pattern from lazy-routes.test.tsx),
 * deliberately NOT a hand-copied subset. That matters: a test carrying its own
 * copy of the routes would keep passing after someone deleted the real
 * declarations, so it would guard nothing. Rendering the real component means
 * these assertions fail if `routes.tsx` loses either route.
 *
 * AUTH BOOT — the trap that made the first version of this file fail entirely
 * (every test timed out on /login):
 *
 *   The pages sit behind `RequireAuth`, which reads the real auth store that
 *   `AppProviders` mounts. Mocking `useAuth` does NOT satisfy it — the provider
 *   boots from `apiRequest`/storage, so the guard still sees a guest and
 *   `<Navigate to="/login?returnTo=...">` wins. The routes are contributed by
 *   `AppProviders`, so the whole render lands on the login page and every
 *   `findBy*` times out on a screen that has no page in it.
 *
 *   The working pattern (copied from lazy-routes.test.tsx) is to seed
 *   `localStorage[TOKEN_KEY]` and let the real store restore the session.
 *
 * Two properties are worth pinning:
 *
 *  1. `/messages/saved` must NOT be captured by `/messages/:conversationId`.
 *     React Router 7 ranks a static segment above a dynamic one, so "saved"
 *     wins — but that ranking is a behaviour, not a guarantee, and a future
 *     reordering could flip it and silently route the bookmark page into the
 *     mailbox. This is the tripwire.
 *
 *  2. Both routes land on their own page. Asserted via each page's own heading,
 *     which is unique (the nav links use the same words, so a bare text query
 *     would match twice).
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "tester@pxczxn.top", emailVerified: true })),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(async () => ({})),
    getCaptcha: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
    requestPasswordRecovery: vi.fn(),
    resetPassword: vi.fn(),
    forceChangePassword: vi.fn(),
    sendRegisterSms: vi.fn(),
  },
}));

vi.mock("@/api/home/home.api", () => ({
  homeApi: { getGuestHome: vi.fn(async () => ({ unreadNotifications: 0 })) },
}));

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: { listConversations: vi.fn(async () => []) },
}));

vi.mock("@/lib/use-community-chat-socket", () => ({
  useCommunityChatSocket: vi.fn(),
}));

vi.mock("@/api/saved-messages/saved-messages.api", () => ({
  savedMessagesApi: {
    list: vi.fn(async () => [
      {
        id: "bookmark-1",
        messageId: "msg-1",
        conversationId: "conv-1",
        conversationType: "DIRECT",
        conversationTitle: null,
        senderId: "user-1",
        body: "被收藏的消息",
      },
    ]),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/api/galaxies/galaxies.api", () => ({
  galaxiesApi: {
    listMine: vi.fn(async () => [
      { id: "g1", slug: "observatory", name: "观测站", official: true, memberCount: 12 },
    ]),
    list: vi.fn(async () => []),
    getBySlug: vi.fn(),
    listMembers: vi.fn(),
    listContent: vi.fn(),
    join: vi.fn(),
    apply: vi.fn(),
  },
}));

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <AppProviders>
            <AppRoutes />
          </AppProviders>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Seed a session so RequireAuth admits the visit. See the header: mocking
  // useAuth does NOT work here, because AppProviders owns the real store.
  localStorage.setItem(TOKEN_KEY, "test-token");
});

describe("/messages/saved (real route table)", () => {
  it("resolves to the bookmark page, not a conversation thread", async () => {
    const { router } = renderAt("/messages/saved");
    // Wait on the row: the header paints a tick before the list effect settles.
    expect(await screen.findByText("被收藏的消息")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "收藏的私信" })).toBeTruthy();
    // The resolved path is the static /messages/saved, not the param route.
    expect(router.state.location.pathname).toBe("/messages/saved");
  });

  it("is NOT swallowed by :conversationId (the mailbox)", async () => {
    renderAt("/messages/saved");
    await screen.findByText("被收藏的消息");
    // MailboxPage's empty state would appear if the param route had won.
    expect(screen.queryByText("还没有会话")).toBeNull();
  });
});

describe("/me/galaxies (real route table)", () => {
  it("renders 我加入的星系 with the joined list", async () => {
    renderAt("/me/galaxies");
    expect(await screen.findByRole("heading", { name: "我加入的星系" })).toBeTruthy();
    expect(screen.getByText("观测站")).toBeTruthy();
  });

  it("shows the count in the header", async () => {
    renderAt("/me/galaxies");
    await screen.findByText("观测站");
    expect(screen.getByText("共 1 个星系")).toBeTruthy();
  });
});
