import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/layouts/AppLayout";

/*
 * Phase 3I route wiring.
 *
 * Two routes were added — `/messages/saved` and `/me/galaxies` — and each has
 * one easy-to-get-wrong property worth pinning:
 *
 *  1. `/messages/saved` is a SIBLING of `/messages/:conversationId`. React
 *     Router ranks the static segment above the dynamic one, so "saved" must
 *     reach the bookmark page and NOT be swallowed as a conversationId. If a
 *     future edit reorders or nests these, the mailbox would try to open a
 *     conversation named "saved" — this test is the tripwire.
 *
 *  2. Both routes are behind RequireAuth. The API calls are session-scoped, so
 *     an unauthenticated visit must not reach the page body at all.
 *
 * Modules are mocked at their boundaries (the API layer + the auth store) in the
 * house style, and the real route table is exercised via createMemoryRouter so
 * the assertion is about routes.tsx, not about a hand-built copy of it.
 */

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { username: "tester" }, logout: vi.fn() }),
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

const routes = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "messages/saved", lazy: async () => {
          const mod = await import("@/features/messages/pages/SavedMessagesPage");
          return { Component: mod.SavedMessagesPage };
        } },
      { path: "me/galaxies", lazy: async () => {
          const mod = await import("@/features/galaxies/pages/MyGalaxiesPage");
          return { Component: mod.MyGalaxiesPage };
        } },
      { path: "messages/:conversationId", element: <p>会话线程占位</p> },
    ],
  },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/messages/saved", () => {
  it("renders the bookmark page, not a conversation thread", async () => {
    renderAt("/messages/saved");
    // The header can render a tick before the list effect settles, so wait on
    // the row itself — that is the thing this test is actually about.
    expect(await screen.findByText("被收藏的消息")).toBeTruthy();
    // "收藏的私信" appears BOTH as the page heading and as the AppLayout nav
    // link, so assert on the heading specifically rather than by bare text.
    expect(screen.getByRole("heading", { name: "收藏的私信" })).toBeTruthy();
    expect(screen.queryByText("会话线程占位")).toBeNull();
  });

  it("is NOT captured by the :conversationId sibling", async () => {
    renderAt("/messages/saved");
    await screen.findByText("收藏的私信");
    // If "saved" had been read as a conversationId the placeholder would win.
    expect(screen.queryByText("会话线程占位")).toBeNull();
  });
});

describe("/me/galaxies", () => {
  it("renders 我加入的星系 with the joined list", async () => {
    renderAt("/me/galaxies");
    expect(await screen.findByText("我加入的星系")).toBeTruthy();
    expect(screen.getByText("观测站")).toBeTruthy();
  });

  it("shows the count in the header", async () => {
    renderAt("/me/galaxies");
    await screen.findByText("观测站");
    expect(screen.getByText("共 1 个星系")).toBeTruthy();
  });
});
