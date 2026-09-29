import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { homeApi } from "@/api/home/home.api";
import { topicsApi } from "@/api/topics/topics.api";
import { authApi } from "@/api/auth/auth.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { setStoredToken } from "@/lib/storage";
import { HomePage } from "./pages/HomePage";

/*
 * Home tests (Phase 1A, re-cut for the feed IA):
 *  - guest renders from GET /api/v1/home, member from GET /api/v1/me/home
 *  - 推荐 / 关注 are a REAL feed switch (same payload, different fields)
 *  - 继续阅读 is signed-in only, even if a guest payload carries the rows
 *  - a failing non-critical rail module must NOT blank the page
 *  - an empty non-critical module renders nothing at all (no placeholder box)
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
  homeMocked.getAnnouncements.mockResolvedValue([
    { id: "n1", title: "社区公告一", body: "内容" },
  ]);
});

describe("home (guest)", () => {
  it("renders the recommendations feed from the guest endpoint", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      // Deliberately non-empty: a guest must never see a resume affordance.
      continueReading: [{ id: "c1", title: "游客继续阅读" }],
      followingUpdates: [{ id: "f1", title: "游客关注条目" }],
      discoveries: [{ id: "d1", title: "游客推荐条目" }],
    });

    renderHome();

    await waitFor(() => expect(homeMocked.getGuestHome).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: "推荐" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "关注" })).toBeInTheDocument();
    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    // The sidebar module is present because the mock returns one announcement.
    expect(screen.getByRole("heading", { name: "社区公告" })).toBeInTheDocument();
    // 继续阅读 is signed-in only.
    expect(screen.queryByRole("heading", { name: "继续阅读" })).not.toBeInTheDocument();
  });

  it("switches the feed to 关注 without leaving the page", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      continueReading: [],
      followingUpdates: [{ id: "f1", title: "游客关注条目" }],
      discoveries: [{ id: "d1", title: "游客推荐条目" }],
    });

    renderHome();

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));

    expect(await screen.findByText("游客关注条目")).toBeInTheDocument();
    expect(screen.queryByText("游客推荐条目")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "关注" })).toHaveAttribute("aria-selected", "true");
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
    expect(await screen.findByText("为我推荐")).toBeInTheDocument();
    // 继续阅读 shows as a compact strip for a signed-in session with rows.
    expect(screen.getByRole("heading", { name: "继续阅读" })).toBeInTheDocument();
    expect(screen.getByText("我的继续阅读")).toBeInTheDocument();
  });
});

describe("home degradation", () => {
  it("keeps the page alive when a non-critical rail module fails", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      continueReading: [],
      followingUpdates: [],
      discoveries: [{ id: "d1", title: "游客推荐条目" }],
    });
    // Announcements is non-critical: its failure is contained to its own module.
    homeMocked.getAnnouncements.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => expect(homeMocked.getAnnouncements).toHaveBeenCalled());

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("renders nothing for a non-critical module that is empty", async () => {
    homeMocked.getGuestHome.mockResolvedValue({
      unreadNotifications: 0,
      continueReading: [],
      followingUpdates: [],
      discoveries: [{ id: "d1", title: "游客推荐条目" }],
    });
    homeMocked.getAnnouncements.mockResolvedValue([]);

    renderHome();

    expect(await screen.findByText("游客推荐条目")).toBeInTheDocument();
    // Empty non-critical modules are hidden outright, not replaced by a box.
    expect(screen.queryByRole("heading", { name: "社区公告" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "热门话题" })).not.toBeInTheDocument();
  });

  it("shows a fatal error when the home composition endpoint fails", async () => {
    homeMocked.getGuestHome.mockRejectedValue(new Error("boom"));

    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId("page-state-error")).toBeInTheDocument();
    });
  });
});
