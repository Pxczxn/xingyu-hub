import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { ArticleInteractions } from "./components/ArticleInteractions";

/*
 * Like tests (endpoint verified working on the real backend).
 * Also asserts the bookmark control is NOT exposed — the backend bookmark
 * endpoint is non-functional (POST no-op, DELETE 500).
 */

vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: {
    getLikeStatus: vi.fn(),
    getLikeCount: vi.fn(),
    like: vi.fn(),
    unlike: vi.fn(),
    getComments: vi.fn(),
    createComment: vi.fn(),
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    getBookmarkStatus: vi.fn(),
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

const mocked = vi.mocked(interactionsApi);

function renderBar() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ArticleInteractions objectId="a1" />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getLikeCount.mockResolvedValue({ count: 3 });
  mocked.getLikeStatus.mockResolvedValue({ liked: false });
});

describe("article like", () => {
  it("loads the initial like state and count", async () => {
    setStoredToken("tok");
    mocked.getLikeStatus.mockResolvedValue({ liked: true });
    mocked.getLikeCount.mockResolvedValue({ count: 5 });

    renderBar();

    const button = await screen.findByRole("button", { name: /已赞/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("5");
  });

  it("likes an article and updates the count", async () => {
    setStoredToken("tok");
    mocked.like.mockResolvedValue(undefined);

    renderBar();
    const button = await screen.findByRole("button", { name: /点赞/ });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.like).toHaveBeenCalledWith("ARTICLE", "a1"));
    expect(await screen.findByRole("button", { name: /已赞/ })).toHaveTextContent("4");
  });

  it("unlikes an article", async () => {
    setStoredToken("tok");
    mocked.getLikeStatus.mockResolvedValue({ liked: true });
    mocked.unlike.mockResolvedValue(undefined);

    renderBar();
    const button = await screen.findByRole("button", { name: /已赞/ });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.unlike).toHaveBeenCalledWith("ARTICLE", "a1"));
    expect(await screen.findByRole("button", { name: /点赞/ })).toBeInTheDocument();
  });

  it("rolls back the optimistic like when the request fails", async () => {
    setStoredToken("tok");
    mocked.like.mockRejectedValue(new Error("500"));

    renderBar();
    const button = await screen.findByRole("button", { name: /点赞/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /点赞/ })).toHaveAttribute("aria-pressed", "false");
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("操作失败");
  });

  it("does NOT expose a bookmark control (backend endpoint non-functional)", async () => {
    setStoredToken("tok");
    renderBar();
    await screen.findByRole("button", { name: /点赞/ });

    expect(screen.queryByRole("button", { name: /收藏/ })).not.toBeInTheDocument();
    expect(mocked.addBookmark).not.toHaveBeenCalled();
    expect(mocked.getBookmarkStatus).not.toHaveBeenCalled();
  });

  it("prompts guests to sign in instead of liking", async () => {
    renderBar();
    expect(await screen.findByRole("link", { name: "登录后互动" })).toBeInTheDocument();
    expect(mocked.like).not.toHaveBeenCalled();
  });
});
