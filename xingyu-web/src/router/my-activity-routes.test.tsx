import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Which component a URL reaches (Phase 2J-1).
 *
 * `/me/likes` and `/me/comments` are the two session-scoped trails that Legacy
 * had and V2 did not. Rendering the real route table is the only way to check
 * the decision the router actually makes, and the guard is half the contract.
 *
 * `/me/history` is deliberately absent from the table (no backend route), so
 * these tests also pin that it stays absent rather than silently growing a page.
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

// One row each, so the list container (the page's unique landmark) renders.
// An empty array would show the empty state instead and the assertions below
// would be testing the wrong branch.
vi.mock("@/api/me-activity/me-activity.api", () => ({
  myLikesApi: {
    list: vi.fn(async () => [
      {
        objectType: "ARTICLE",
        objectId: "a1",
        title: "一篇文章",
        createdAt: "2026-09-20T10:00:00Z",
      },
    ]),
  },
  myCommentsApi: {
    list: vi.fn(async () => [
      {
        id: "c1",
        body: "说得有道理",
        objectType: "ARTICLE",
        objectId: "a1",
        objectTitle: "一篇文章",
        createdAt: "2026-09-20T10:00:00Z",
      },
    ]),
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

describe("phase 2J-1 route resolution", () => {
  it("routes /me/likes to the likes page", async () => {
    renderAt("/me/likes", true);

    // Headings and the list landmark unique to this page: the header "我的喜欢",
    // the section "点赞记录", and the labelled list. None exist elsewhere.
    expect(await screen.findByRole("heading", { name: /我的喜欢/ })).toBeInTheDocument();
    expect(screen.getByText("点赞记录")).toBeInTheDocument();
    expect(screen.getByLabelText("我的点赞列表")).toBeInTheDocument();
  });

  it("routes /me/comments to the comments page", async () => {
    renderAt("/me/comments", true);

    expect(await screen.findByRole("heading", { name: /我的评论/ })).toBeInTheDocument();
    expect(screen.getByText("评论记录")).toBeInTheDocument();
    expect(screen.getByLabelText("我的评论列表")).toBeInTheDocument();
  });

  it("keeps the two pages distinct from each other", async () => {
    // One route tree per render: rendering twice in a single test would leave
    // the first tree mounted and make the second query ambiguous.
    const likes = renderAt("/me/likes", true);
    await screen.findByLabelText("我的点赞列表");
    expect(screen.queryByText("评论记录")).not.toBeInTheDocument();
    likes.unmount();

    renderAt("/me/comments", true);
    await screen.findByLabelText("我的评论列表");
    expect(screen.queryByText("点赞记录")).not.toBeInTheDocument();
  });

  it("does not route /me/history, because the backend has no such endpoint", async () => {
    renderAt("/me/history", true);

    // No page exists → it must not render a likes/comments heading pretending
    // to be history. (Whatever the catch-all does is out of scope here.)
    expect(screen.queryByText("点赞记录")).not.toBeInTheDocument();
    expect(screen.queryByText("评论记录")).not.toBeInTheDocument();
  });
});

describe("phase 2J-1 route guards", () => {
  it("bounces a guest from /me/likes to login", async () => {
    renderAt("/me/likes", false);

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByText("点赞记录")).not.toBeInTheDocument();
  });

  it("bounces a guest from /me/comments to login", async () => {
    renderAt("/me/comments", false);

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByText("评论记录")).not.toBeInTheDocument();
  });
});
