import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { homeApi } from "@/api/home/home.api";
import { topicsApi } from "@/api/topics/topics.api";
import { discoverApi } from "@/api/discover/discover.api";
import { authApi } from "@/api/auth/auth.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { setStoredToken } from "@/lib/storage";
import { HomePage } from "./pages/HomePage";

/*
 * Home tests (Phase 1A):
 *  - guest renders from GET /api/v1/home
 *  - member renders from GET /api/v1/me/home
 *  - a failing non-critical section (announcements) must NOT blank the page
 *  - a failing composition endpoint is fatal and shows the error state
 */

vi.mock("@/api/home/home.api", () => ({
  homeApi: {
    getGuestHome: vi.fn(),
    getMyHome: vi.fn(),
    getAnnouncements: vi.fn(),
  },
}));

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(),
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

vi.mock("@/api/discover/discover.api", () => ({
  discoverApi: {
    getDiscover: vi.fn(),
    getDiscoverNav: vi.fn(),
    search: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
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

const homeMocked = vi.mocked(homeApi);
const topicsMocked = vi.mocked(topicsApi);
const authMocked = vi.mocked(authApi);
const discoverMocked = vi.mocked(discoverApi);

const ME = { email: "alice@example.com", emailVerified: true, username: "alice" };

function renderHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  topicsMocked.getTopics.mockResolvedValue([]);
  discoverMocked.getDiscover.mockResolvedValue({ items: [], total: 0, nextCursor: null });
  homeMocked.getAnnouncements.mockResolvedValue([
    { id: "n1", title: "社区公告一", body: "内容" },
  ]);
});

describe("home (guest)", () => {
  it("renders the first-screen sections from the guest endpoint", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      continueReading: [{ id: "c1", title: "继续阅读条目" }],
      followingUpdates: [{ id: "f1", title: "关注更新条目" }],
      discoveries: [{ id: "d1", title: "发现条目" }],
    });

    renderHome();

    await waitFor(() => expect(homeMocked.getGuestHome).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "社区公告" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "关注更新" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "继续阅读" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "为你推荐" })).toBeInTheDocument();
    expect(await screen.findByText("继续阅读条目")).toBeInTheDocument();
  });
});

describe("home (authenticated)", () => {
  it("uses the member endpoint when a session exists", async () => {
    setStoredToken("tok");
    authMocked.getMe.mockResolvedValue(ME);
    homeMocked.getMyHome.mockResolvedValue({
      continueReading: [{ id: "c1", title: "我的继续阅读" }],
      followUpdates: [],
      recommendations: [{ id: "r1", title: "为我推荐" }],
      draftArticles: [],
      pendingActions: [],
    });

    renderHome();

    await waitFor(() => expect(homeMocked.getMyHome).toHaveBeenCalled());
    expect(homeMocked.getGuestHome).not.toHaveBeenCalled();
    // Members get their discover rail from the working /api/v1/discover endpoint.
    expect(discoverMocked.getDiscover).toHaveBeenCalled();
    expect(await screen.findByText("为我推荐")).toBeInTheDocument();
  });
});

describe("home degradation", () => {
  it("keeps the page alive when a non-critical section fails", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      continueReading: [{ id: "c1", title: "继续阅读条目" }],
      followingUpdates: [],
      discoveries: [{ id: "d1", title: "发现条目" }],
    });
    // Announcements is non-critical: its failure is contained to its own section.
    homeMocked.getAnnouncements.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => expect(homeMocked.getAnnouncements).toHaveBeenCalled());

    // The rest of the page still works.
    expect(await screen.findByText("继续阅读条目")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "为你推荐" })).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("shows a fatal error when the home composition endpoint fails", async () => {
    homeMocked.getGuestHome.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});
