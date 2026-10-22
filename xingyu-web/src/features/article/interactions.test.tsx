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

function renderBar(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
  // 生产 apiRequest 恒返回 Promise；mock 缺省返回 undefined 会让 .then 同步抛错，
  // 属于测试 Mock 不完整（2026-10-10 Phase 2.5 裁断），生产代码不做防御。
  mocked.getBookmarkStatus.mockResolvedValue({ bookmarked: false });
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

  it("restores the bookmark control and loads its viewer-scoped status", async () => {
    // 2026-10-10 P0-C: bookmark UI restored — the backend index gap that made
    // every bookmark 404 is closed (see interactions.api.ts header note).
    setStoredToken("tok");
    mocked.getBookmarkStatus.mockResolvedValue({ bookmarked: true });

    renderBar();
    const button = await screen.findByRole("button", { name: /已收藏/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(mocked.getBookmarkStatus).toHaveBeenCalledWith("ARTICLE", "a1");
  });

  it("bookmarks an article and reflects the optimistic state", async () => {
    setStoredToken("tok");
    mocked.getBookmarkStatus.mockResolvedValue({ bookmarked: false });
    mocked.addBookmark.mockResolvedValue(undefined);

    renderBar();
    const button = await screen.findByRole("button", { name: /收藏/ });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.addBookmark).toHaveBeenCalledWith("ARTICLE", "a1"));
    expect(await screen.findByRole("button", { name: /已收藏/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("unbookmarks an article", async () => {
    setStoredToken("tok");
    mocked.getBookmarkStatus.mockResolvedValue({ bookmarked: true });
    mocked.removeBookmark.mockResolvedValue(undefined);

    renderBar();
    const button = await screen.findByRole("button", { name: /已收藏/ });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.removeBookmark).toHaveBeenCalledWith("ARTICLE", "a1"));
    expect(await screen.findByRole("button", { name: /^收藏$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("rolls back the optimistic bookmark when the request fails", async () => {
    setStoredToken("tok");
    mocked.getBookmarkStatus.mockResolvedValue({ bookmarked: false });
    mocked.addBookmark.mockRejectedValue(new Error("500"));

    renderBar();
    const button = await screen.findByRole("button", { name: /^收藏$/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^收藏$/ })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("操作失败");
  });

  it("shows guests the public like count and no interactive controls", async () => {
    renderBar();
    const prompt = await screen.findByRole("link", { name: "登录后互动" });
    // The count is the one interaction read a guest can make: the backend exposes
    // GET /likes/{type}/{id}/count publicly and discovery cards already print it,
    // so the article page must not regress to a bare 「点赞」.
    await waitFor(() => expect(prompt.parentElement).toHaveTextContent("3 赞"));
    expect(mocked.getLikeCount).toHaveBeenCalledWith("ARTICLE", "a1");
    // Viewer-scoped reads stay session-only (401 for guests).
    expect(mocked.getLikeStatus).not.toHaveBeenCalled();
    expect(mocked.getBookmarkStatus).not.toHaveBeenCalled();
    expect(mocked.like).not.toHaveBeenCalled();
  });

  it("keeps the plain guest prompt when the public count is unavailable", async () => {
    mocked.getLikeCount.mockRejectedValue(new Error("500"));
    renderBar();
    const prompt = await screen.findByRole("link", { name: "登录后互动" });
    expect(prompt.parentElement).toHaveTextContent("点赞");
    expect(prompt.parentElement).not.toHaveTextContent(/\d+ 赞/);
  });

  it("sends the guest to login with the article as the return path", async () => {
    renderBar("/articles/a1");
    const prompt = await screen.findByRole("link", { name: "登录后互动" });
    // 登录页读 returnTo 并在成功后回跳；入口只写裸 /login 会把读者丢回首页。
    expect(prompt).toHaveAttribute("href", "/login?returnTo=%2Farticles%2Fa1");
  });
});
