import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import type { PublicConfig } from "@/api/auth/auth.types";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRoutes } from "@/router/routes";
import { clearPublicConfigCache } from "@/lib/public-config";
import { setStoredToken } from "@/lib/storage";

/*
 * GuestOnly — the other half of audit A1 (2026-11-10).
 *
 * /login and /register used to be reachable while signed in: the pages rendered,
 * a mistyped password hit the login endpoint for no reason, and a valid session
 * could sit on a screen that only exists for guests. The guard under test is the
 * route-level fix; these cases pin the observable contract:
 *
 *   1. signed-in visitor -> redirected to the sanitized `returnTo` (or "/");
 *   2. guest             -> sees the form (the guard must not over-block);
 *   3. hostile returnTo  -> sanitized to "/" (reuses sanitizeInAppPath);
 *   4. returnTo = /login -> "/" instead of redirecting onto another guest-only
 *                           screen (a self-referential target would otherwise
 *                           replace the URL with itself and paint nothing).
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    register: vi.fn(),
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

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(async () => []),
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

vi.mock("@/api/events/events.api", () => ({
  eventsApi: {
    list: vi.fn(async () => []),
    get: vi.fn(),
    listAcceptedSubmissions: vi.fn(async () => []),
    listMySubmissions: vi.fn(async () => []),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
    submit: vi.fn(),
  },
}));

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: {
    list: vi.fn(async () => []),
    getBySlug: vi.fn(),
    getCommunityRules: vi.fn(async () => ({
      id: "g2",
      slug: "community-rules",
      title: "社区公约",
      body: "公约正文",
      publishedAt: "2026-09-18T20:33:57Z",
    })),
  },
}));

const CONFIG = {
  registration: {
    enabled: true,
    verifyEmail: false,
    verifyPhone: false,
    needAudit: false,
    defaultRole: "USER",
    captchaEnabled: false,
  },
  login: { rememberMe: true, captchaEnabled: false, captchaType: "math", maxRetryCount: 5 },
  sms: { enabled: false },
  siteName: "星语",
} as unknown as PublicConfig;

const ME = { email: "alice@example.com", emailVerified: true, username: "alice" };

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{`${location.pathname}${location.search}`}</div>;
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
  vi.clearAllMocks();
  clearPublicConfigCache();
  vi.mocked(authApi.getMe).mockResolvedValue(ME);
  vi.mocked(authApi.getPublicConfig).mockResolvedValue(CONFIG);
});

describe("GuestOnly guard", () => {
  it("redirects a signed-in user off /login to the returnTo target", async () => {
    setStoredToken("test-token");
    renderAt("/login?returnTo=%2Frules");

    expect(await screen.findByRole("heading", { name: "社区公约" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/rules");
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("keeps a guest on /login", async () => {
    renderAt("/login");

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
  });

  it("also redirects a signed-in user off /register", async () => {
    setStoredToken("test-token");
    renderAt("/register");

    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe("/"));
    expect(screen.queryByRole("heading", { name: "注册星语" })).not.toBeInTheDocument();
  });

  it("still lets a guest open /register", async () => {
    renderAt("/register");

    expect(await screen.findByRole("heading", { name: "注册星语" })).toBeInTheDocument();
  });

  it("sanitizes a hostile returnTo back to /", async () => {
    setStoredToken("test-token");
    renderAt("/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal");

    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe("/"));
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });

  it("does not bounce between guest-only screens when returnTo points at /login", async () => {
    setStoredToken("test-token");
    renderAt("/login?returnTo=%2Flogin");

    // Redirecting onto /login again would replace the URL with itself and paint
    // an empty screen, so an auth path must fall back to "/".
    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe("/"));
    expect(screen.queryByRole("heading", { name: "登录星语" })).not.toBeInTheDocument();
  });
});
