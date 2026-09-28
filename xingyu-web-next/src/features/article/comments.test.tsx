import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { CommentSection } from "./components/CommentSection";

/*
 * Comments tests. The real backend requires auth for the LIST endpoint
 * (401 for guests) and works for CREATE when authenticated.
 */

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    getComments: vi.fn(),
    createComment: vi.fn(),
    getLikeStatus: vi.fn(),
    getLikeCount: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true, username: "me_user" })),
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

const mocked = vi.mocked(interactionsApi);

function renderSection() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CommentSection objectId="a1" />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("comments (guest)", () => {
  it("prompts for sign-in and fires no request", async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText(/评论需要登录后查看/)).toBeInTheDocument());
    expect(mocked.getComments).not.toHaveBeenCalled();
  });
});

describe("comments (authenticated)", () => {
  it("lists comments", async () => {
    setStoredToken("tok");
    mocked.getComments.mockResolvedValue([
      { id: "c1", authorId: "u1", authorUsername: "alice", body: "很棒", createdAt: "2026-09-01T00:00:00Z" },
    ]);

    renderSection();

    expect(await screen.findByTestId("comment-list")).toBeInTheDocument();
    expect(screen.getByText("很棒")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute("href", "/u/alice");
  });

  it("shows an empty state", async () => {
    setStoredToken("tok");
    mocked.getComments.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByTestId("comments-empty")).toBeInTheDocument();
  });

  it("shows an error state", async () => {
    setStoredToken("tok");
    mocked.getComments.mockRejectedValue(new Error("500"));
    renderSection();
    expect(await screen.findByTestId("comments-error")).toBeInTheDocument();
  });

  it("creates a comment and appends it", async () => {
    setStoredToken("tok");
    mocked.getComments.mockResolvedValue([]);
    mocked.createComment.mockResolvedValue({
      id: "c9",
      authorId: "u9",
      authorUsername: "me_user",
      body: "[WEB-V2 TEST] 新评论",
      createdAt: "2026-09-21T00:00:00Z",
    });

    renderSection();
    await screen.findByTestId("comments-empty");

    // fireEvent.change: userEvent.type would parse "[WEB-V2" as a keyboard descriptor.
    fireEvent.change(screen.getByLabelText("评论内容"), {
      target: { value: "[WEB-V2 TEST] 新评论" },
    });
    await userEvent.click(screen.getByRole("button", { name: "发表评论" }));

    await waitFor(() =>
      expect(mocked.createComment).toHaveBeenCalledWith({
        objectType: "ARTICLE",
        objectId: "a1",
        body: "[WEB-V2 TEST] 新评论",
      }),
    );
    expect(await screen.findByText("[WEB-V2 TEST] 新评论")).toBeInTheDocument();
  });

  it("shows an error when creating fails", async () => {
    setStoredToken("tok");
    mocked.getComments.mockResolvedValue([]);
    mocked.createComment.mockRejectedValue(new Error("500"));

    renderSection();
    await screen.findByTestId("comments-empty");

    await userEvent.type(screen.getByLabelText("评论内容"), "会失败的评论");
    await userEvent.click(screen.getByRole("button", { name: "发表评论" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("评论发布失败");
  });
});
