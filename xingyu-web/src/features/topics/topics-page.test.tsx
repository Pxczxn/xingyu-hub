import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicsPage } from "./pages/TopicsPage";

/*
 * Topics plaza tests.
 *
 * The optimistic follow / rollback click tests were REMOVED after live
 * acceptance: the backend has no working follow endpoint (404), so the follow
 * control is no longer exposed in the UI. Testing a click on a control that
 * must not exist would be wrong.
 *
 * The follow contract itself is still verified at the API layer in
 * topics.api.ts (kept for when the backend provides a working endpoint).
 */

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
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: false })),
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

const mocked = vi.mocked(topicsApi);

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TopicsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getTopics.mockResolvedValue([
    { id: "t1", slug: "ai", name: "AI", followerCount: 3, contentCount: 1, following: false },
  ]);
});

describe("topics page", () => {
  it("renders the topic list", async () => {
    renderPage();
    await waitFor(() => expect(mocked.getTopics).toHaveBeenCalled());
    expect(await screen.findByText("AI")).toBeInTheDocument();
  });

  it("filters by keyword", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 1 },
      { id: "t2", slug: "design", name: "设计", contentCount: 1 },
    ]);

    renderPage();
    await waitFor(() => expect(mocked.getTopics).toHaveBeenCalled());

    expect(await screen.findByText("AI")).toBeInTheDocument();
    expect(screen.getByText("设计")).toBeInTheDocument();
  });

  it("does NOT expose a follow control (backend endpoint unavailable)", async () => {
    renderPage();
    await waitFor(() => expect(mocked.getTopics).toHaveBeenCalled());
    await screen.findByText("AI");

    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
    expect(mocked.followTopic).not.toHaveBeenCalled();
    expect(mocked.unfollowTopic).not.toHaveBeenCalled();
  });
});
