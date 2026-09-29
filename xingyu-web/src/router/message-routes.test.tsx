import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

vi.mock("@/api/auth/auth.api", () => ({
  authApi: { getMe: vi.fn(), login: vi.fn(), logout: vi.fn(), getPublicConfig: vi.fn() },
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

function LocationProbe() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return (
    <>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="current-return-to">{params.get("returnTo") ?? ""}</div>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <LocationProbe />
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

/*
 * Phase 2I-3: the message centre is session-scoped (every /api/v1/messages
 * endpoint reads the community session), so both hosts must send a guest to
 * /login carrying the path back.
 */
describe("phase 2I-3 message routes", () => {
  it("sends a guest from /messages to login with returnTo", async () => {
    renderAt("/messages");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/messages");
  });

  it("guards a direct thread link too — a bookmarked conversation is not public", async () => {
    renderAt("/messages/c-1");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/messages/c-1");
  });
});

/*
 * Phase 2I-3b: search plus the two shared-attachment views. All three are
 * session-scoped for the same reason as the thread.
 */
describe("phase 2I-3b message routes", () => {
  it("guards /messages/search", async () => {
    renderAt("/messages/search");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/messages/search");
  });

  it("guards the shared-media view", async () => {
    renderAt("/messages/c-1/media");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/messages/c-1/media");
  });

  it("guards the shared-files view", async () => {
    renderAt("/messages/c-1/files");
    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("current-return-to")).toHaveTextContent("/messages/c-1/files");
  });
});
