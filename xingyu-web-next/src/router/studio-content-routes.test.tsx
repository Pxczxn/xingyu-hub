import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";
import { TOKEN_KEY } from "@/lib/storage";

/*
 * Route resolution for the Phase 3G content-management route.
 *
 * The regression this locks in: the article editor (`/studio/content/:articleId`)
 * shipped in Phase 1C, but no LIST route and no link existed, so a signed-in
 * author could not start an article without typing the URL. These tests assert:
 *   1. `/studio/content` resolves to the new list page.
 *   2. `/studio/content/new` still resolves to the EDITOR — i.e. adding the
 *      static `/studio/content` route did not shadow the parameterised one.
 *   3. A guest is sent to login.
 *
 * NOTE: a DATA router (`createMemoryRouter`) is required, not `<MemoryRouter>`:
 * the editor uses React Router's `useBlocker`, which throws inside a plain
 * router. This mirrors the app's real boot shape (Phase 1C-2).
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

const listMine = vi.fn();
const listTrash = vi.fn();

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listMine: (...args: unknown[]) => listMine(...args),
    listTrash: (...args: unknown[]) => listTrash(...args),
    getDraft: vi.fn(async () => ({
      articleId: "new",
      title: null,
      summary: null,
      coverUrl: null,
      bodyMode: "MARKDOWN",
      body: null,
      visibility: "PRIVATE",
      lockVersion: 0,
    })),
    saveDraft: vi.fn(),
    submitForReview: vi.fn(),
    createDraft: vi.fn(),
    trash: vi.fn(),
    restoreFromTrash: vi.fn(),
  },
}));

function renderAt(path: string, signedIn: boolean) {
  if (signedIn) localStorage.setItem(TOKEN_KEY, "test-token");
  else localStorage.clear();
  const router = createMemoryRouter(
    [{ path: "*", element: <AppProviders><AppRoutes /></AppProviders> }],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  listMine.mockResolvedValue([]);
  listTrash.mockResolvedValue([]);
});

describe("phase 3G content route resolution", () => {
  it("routes /studio/content to the content-management page", async () => {
    renderAt("/studio/content", true);
    expect(await screen.findByRole("heading", { name: "内容管理" })).toBeInTheDocument();
    // The heading is part of the synchronous shell, so `findByRole` above can
    // resolve BEFORE the load effect fires. Awaiting the list call itself keeps
    // this independent of scheduling — plain `expect(listMine).toHaveBeenCalled()`
    // raced under full-suite load (observed once: 2058/2059).
    await waitFor(() => expect(listMine).toHaveBeenCalled());
  });

  it("routes a GUEST to login and does NOT read the article list", async () => {
    renderAt("/studio/content", false);
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(listMine).not.toHaveBeenCalled();
  });

  it("does NOT shadow the editor route: /studio/content/new stays the editor", async () => {
    // If route ranking were wrong, `/studio/content` would swallow `/new` and
    // this would render the content list instead of the editor.
    const { container, router } = renderAt("/studio/content/new", true);
    await waitFor(
      () => expect(container.querySelector("[data-editor-root]")).not.toBeNull(),
      { timeout: 30000 },
    );
    expect(screen.queryByRole("heading", { name: "内容管理" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/studio/content/new");
  }, 60000);

  it("exposes a create link from the content page through the real router", async () => {
    renderAt("/studio/content", true);
    const link = await screen.findByRole("link", { name: "新建文章" });
    expect(link).toHaveAttribute("href", "/studio/content/new");
  });

  it("resolves the trash tab from the query string", async () => {
    listTrash.mockResolvedValue([
      {
        objectType: "ARTICLE",
        objectId: "art-9",
        title: "回收站里的稿子",
        trashedAt: "2026-09-27T02:00:00Z",
      },
    ]);
    renderAt("/studio/content?tab=trash", true);
    // The note only renders alongside rows — an empty trash shows its own empty
    // state instead, so a non-empty list is required here.
    expect(await screen.findByTestId("trash-note")).toBeInTheDocument();
    expect(screen.getByText("回收站里的稿子")).toBeInTheDocument();
    expect(listTrash).toHaveBeenCalled();
  });

  it("shows the empty-trash state (with no note) when the trash has no rows", async () => {
    listTrash.mockResolvedValue([]);
    renderAt("/studio/content?tab=trash", true);
    expect(await screen.findByText("回收站是空的")).toBeInTheDocument();
    // The "no permanent delete" note accompanies ROWS; with nothing in the trash
    // the empty state is the honest message instead.
    expect(screen.queryByTestId("trash-note")).not.toBeInTheDocument();
  });
});
