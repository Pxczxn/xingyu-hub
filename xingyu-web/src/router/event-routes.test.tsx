import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/router/routes";
import { AppProviders } from "@/app/providers/AppProviders";

/*
 * Which component a URL reaches (Phase 2I-4).
 *
 * `/events/:eventId/submit` sits next to `/events/:eventId`, and the two are
 * different pages — one submits, one reads. react-router 7 ranks the longer
 * literal segment above the shorter dynamic one, so "submit" must win; but that
 * ranking is a library detail, not something this app declares, and a future
 * sibling route inserted above it could change the outcome silently. Rendering
 * the real table is the only way to see the decision the router actually makes.
 *
 * The other half of the contract is the guard: the square and the detail page are
 * guest-readable (the backend serves them without a session), while the submit
 * flow and 我的活动 write under /me/* and therefore require one.
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

const EVENT = {
  id: "e1",
  slug: "starry",
  title: "星语创作赛",
  body: "用文字记录你的星空",
  startsAt: "2026-09-29T02:00:00Z",
  endsAt: "2099-10-05T02:00:00Z",
  submissionOpen: true,
};

vi.mock("@/api/events/events.api", () => ({
  eventsApi: {
    list: vi.fn(async () => []),
    get: vi.fn(async () => EVENT),
    listAcceptedSubmissions: vi.fn(async () => []),
    listMySubmissions: vi.fn(async () => []),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
    submit: vi.fn(),
  },
}));

// The submit page reads all three content sources (it fetches only the active
// tab, but any of them can be the one it asks for).
vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: { listMine: vi.fn(async () => []) },
  normalizeLifecycleStatus: (value: string | null | undefined) => {
    const upper = (value ?? "").toUpperCase();
    return ["DRAFT", "IN_REVIEW", "PUBLISHED"].includes(upper) ? upper : "DRAFT";
  },
}));
vi.mock("@/api/series/series.api", () => ({
  seriesApi: { listMine: vi.fn(async () => []) },
}));
vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: { listMine: vi.fn(async () => []) },
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

describe("phase 2I-4 route resolution", () => {
  it("routes /events to the public square for a guest", async () => {
    renderAt("/events", false);

    expect(await screen.findByRole("heading", { name: "社区活动" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("routes /events/:id/submit to the submit page, not to the detail page", async () => {
    // The regression this guards: if submit were declared as a query or the
    // detail route swallowed the segment, submission would silently open detail.
    renderAt("/events/e1/submit", true);

    expect(await screen.findByRole("heading", { name: "活动投稿" })).toBeInTheDocument();
  });

  it("still routes a bare /events/:id to the detail page, not to submit", async () => {
    renderAt("/events/e1", true);

    expect(await screen.findByRole("heading", { name: "星语创作赛" })).toBeInTheDocument();
    // The detail page has its own 活动投稿 SECTION heading; the submit PAGE's
    // marker is the 1./2. step headings, which only it renders.
    expect(screen.queryByRole("heading", { name: "1. 选择投稿内容" })).not.toBeInTheDocument();
  });
});

describe("phase 2I-4 route guards", () => {
  it("bounces a guest from /events/:id/submit to login with a returnTo", async () => {
    renderAt("/events/e1/submit", false);

    // RequireAuth redirects; the login page is what a guest actually sees.
    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "1. 选择投稿内容" })).not.toBeInTheDocument();
  });

  it("bounces a guest from /me/events to login", async () => {
    renderAt("/me/events", false);

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的活动" })).not.toBeInTheDocument();
  });

  it("lets a signed-in user into /me/events", async () => {
    renderAt("/me/events", true);

    expect(await screen.findByRole("heading", { name: "我的活动" })).toBeInTheDocument();
  });
});
