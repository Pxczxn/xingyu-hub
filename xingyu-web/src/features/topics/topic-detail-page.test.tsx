import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError, type ProblemDetails } from "@/api/client";
import { topicsApi } from "@/api/topics/topics.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { TopicDetailPage } from "./pages/TopicDetailPage";

/*
 * Regression tests for the 404 branch of the topic detail page (task-63).
 *
 * THE BUG THIS PINS: `GET /api/v1/topics/{slug}` answering 404 used to land in
 * the same branch as a network/5xx failure, so a reader following a stale link
 * was told 「加载失败 / 请稍后重试」 — "the service is broken, try again" — when
 * the truth is "this topic is gone". ArticleDetailPage and
 * PublicSeriesDetailPage already split 404 into their own 「不存在」 state; the
 * topic page never did, because its loader only exposed a boolean `error` and
 * threw the error value away.
 *
 * The rejection values are real `ApiError`s carrying `problem.status`, because
 * that is the exact shape `apiRequest` throws (`src/api/client.ts:131` etc.) and
 * the branch keys off it. A plain `new Error("404")` would not exercise the
 * distinction at all.
 */

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    getTopics: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true })),
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

/** The same payload the transport layer builds from a real problem+json response. */
function apiError(status: number, detail: string): ApiError {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: status === 404 ? "Not Found" : "Internal Server Error",
    status,
    detail,
    code: status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
  };
  return new ApiError(problem);
}

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/topics/${slug}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/topics/:slug" element={<TopicDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getTopicContent.mockResolvedValue([]);
  mocked.getTopicCreators.mockResolvedValue([]);
});

describe("topic detail 404", () => {
  it("renders 「话题不存在或未公开」 with a way back, not a retry prompt, when the slug is 404", async () => {
    mocked.getTopic.mockRejectedValue(apiError(404, "topic not found"));

    renderAt("does-not-exist");

    expect(await screen.findByText("话题不存在或未公开")).toBeInTheDocument();
    // The whole point of the fix: a missing topic must not read like a transient
    // failure that the reader could fix by retrying.
    expect(screen.queryByText("请稍后重试。")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
    // ... and it must offer an exit, not a dead end.
    expect(screen.getByRole("link", { name: "去话题广场" })).toHaveAttribute("href", "/topics");
  });

  it("keeps the generic retry state for a non-404 failure", async () => {
    mocked.getTopic.mockRejectedValue(apiError(500, "boom"));

    renderAt("broken");

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByText("请稍后重试。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
    expect(screen.queryByText("话题不存在或未公开")).not.toBeInTheDocument();
  });
});
