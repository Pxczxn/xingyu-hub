import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicsPage } from "./pages/TopicsPage";

/*
 * Topics plaza tests.
 *
 * 2026-10-13 (批次 04) — the "does NOT expose a follow control" test is gone.
 *
 * It asserted that no 关注 button may exist, on the stated grounds that the
 * backend had no working follow endpoint (404). That premise was fixed
 * backend-side on 2026-10-10 — SocialService hard-coded status=ENABLED while
 * topics are ACTIVE, so every follow 404'd — and `TopicFollowIntegrationTest`
 * now pins the whole follow / unfollow / idempotency / disabled-topic loop.
 * `CommunityAuthInterceptor` also runs optional auth across `/api/v1/topics`, so
 * the list endpoint carries the viewer's `following` flag.
 *
 * The control is therefore back, and it is asserted in both directions below: a
 * guest gets no button (their list has no state to show), a signed-in reader gets
 * one that follows, flips, and rolls back when the request fails.
 *
 * The follow contract itself is still verified at the API layer in
 * topics.api.ts.
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
    const list = await screen.findByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /AI/ })).toBeInTheDocument();
  });

  it("sorts featured topics by real contentCount and excludes zero-count topics", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 2 },
      { id: "t2", slug: "design", name: "设计", contentCount: 8 },
      { id: "t3", slug: "empty", name: "空话题", contentCount: 0 },
    ]);

    renderPage();

    const featured = await screen.findByTestId("featured-topics");
    const links = within(featured).getAllByRole("link");
    expect(links[0]).toHaveTextContent("设计");
    expect(links[1]).toHaveTextContent("AI");
    expect(within(featured).queryByText("空话题")).not.toBeInTheDocument();
  });

  it("hides featured topics when every contentCount is zero", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "empty", name: "空话题", contentCount: 0 },
    ]);

    renderPage();

    await screen.findByTestId("topic-list");
    expect(screen.queryByTestId("featured-topics")).not.toBeInTheDocument();
  });

  it("links each topic to its real slug", async () => {
    renderPage();

    const list = await screen.findByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /AI/ })).toHaveAttribute("href", "/topics/ai");
  });

  it("filters by keyword and hides featured topics while searching", async () => {
    mocked.getTopics.mockResolvedValue([
      { id: "t1", slug: "ai", name: "AI", contentCount: 4 },
      { id: "t2", slug: "design", name: "设计", description: "产品体验", contentCount: 1 },
    ]);

    renderPage();
    await screen.findByTestId("featured-topics");
    fireEvent.change(screen.getByRole("textbox", { name: "搜索话题" }), {
      target: { value: "设计" },
    });

    const list = screen.getByTestId("topic-list");
    expect(within(list).getByRole("link", { name: /设计/ })).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: /AI/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("featured-topics")).not.toBeInTheDocument();
  });

  it("shows a lightweight empty result for an unmatched search", async () => {
    renderPage();
    await screen.findByTestId("topic-list");

    fireEvent.change(screen.getByRole("textbox", { name: "搜索话题" }), {
      target: { value: "不存在" },
    });

    expect(screen.getByRole("status")).toHaveTextContent("没有找到匹配的话题");
  });

  it("shows no follow control to a guest, who has no follow state to show", async () => {
    renderPage();
    await screen.findByTestId("topic-list");

    /*
     * Not "the feature is missing" — a guest's list carries no `following` value,
     * and a button whose first click had to guess the current state would be a
     * lie the server then corrects. Guests get the plain card and can sign in
     * from the topic page itself.
     */
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
    expect(mocked.followTopic).not.toHaveBeenCalled();
    expect(mocked.unfollowTopic).not.toHaveBeenCalled();
  });

  it("follows a topic from its plaza card, with the count moving too", async () => {
    setStoredToken("tok");
    mocked.followTopic.mockResolvedValue(undefined);

    renderPage();

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
    // The count is the card's own fact line (设计方案 §3.3: 名称与内容数是重点),
    // so an optimistic update that moves the button but not the number is a bug.
    expect(screen.getByText("4 关注")).toBeInTheDocument();
  });

  it("rolls the plaza follow state back when the request fails", async () => {
    setStoredToken("tok");
    mocked.followTopic.mockRejectedValue(new Error("500"));

    renderPage();

    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followTopic).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
    expect(screen.getByText("3 关注")).toBeInTheDocument();
  });

  it("keeps loading, error and empty states", async () => {
    mocked.getTopics.mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    unmount();

    mocked.getTopics.mockRejectedValueOnce(new Error("boom"));
    const errorView = renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    errorView.unmount();

    mocked.getTopics.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });
});
