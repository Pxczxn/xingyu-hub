import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { savedMessagesApi } from "@/api/saved-messages/saved-messages.api";
import { SavedMessagesPage } from "./SavedMessagesPage";

vi.mock("@/api/saved-messages/saved-messages.api", () => ({
  savedMessagesApi: {
    list: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockedList = vi.mocked(savedMessagesApi.list);
const mockedRemove = vi.mocked(savedMessagesApi.remove);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "bookmark-1",
    messageId: "msg-1",
    conversationId: "conv-1",
    conversationType: "DIRECT",
    conversationTitle: null,
    senderId: "user-1",
    body: "你好",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedMessagesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedList.mockReset();
  mockedRemove.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SavedMessagesPage — loading and errors", () => {
  it("shows a loading state before the list resolves", () => {
    mockedList.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeTruthy();
  });

  it("shows an expired-session error for a 401", async () => {
    mockedList.mockRejectedValueOnce(
      new ApiError({
        type: "about:blank",
        title: "未授权",
        status: 401,
        detail: "登录已过期",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeTruthy();
    expect(screen.getByText("登录状态已过期，请重新登录。")).toBeTruthy();
    expect(screen.getByRole("link", { name: "去登录" })).toBeTruthy();
  });

  it("shows a generic error for a non-auth failure", async () => {
    mockedList.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeTruthy();
    expect(screen.getByText("无法读取收藏的私信，请稍后重试。")).toBeTruthy();
  });

  /*
   * A 404 from list() means a bookmarked message was hard-deleted (the backend
   * maps every row and throws on the missing one — see saved-messages.api.ts
   * for the all-or-nothing hazard). This MUST render as an error, never as the
   * empty state: 「无法读取」 and 「你没有收藏」 mean opposite things, and telling
   * a user their bookmarks are gone when they are merely unreadable is the
   * exact dishonesty this suite exists to prevent.
   */
  it("renders a deleted-message 404 as an error, NOT as an empty list", async () => {
    mockedList.mockRejectedValueOnce(
      new ApiError({
        type: "about:blank",
        title: "未找到",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeTruthy();
    expect(screen.queryByTestId("page-state-empty")).toBeNull();
    expect(screen.queryByText("还没有收藏的私信")).toBeNull();
  });
});

describe("SavedMessagesPage — empty and rows", () => {
  it("shows the empty state when there are no bookmarks", async () => {
    mockedList.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeTruthy();
    expect(screen.getByText("还没有收藏的私信")).toBeTruthy();
  });

  it("renders a row with the conversation label and body", async () => {
    mockedList.mockResolvedValueOnce([row({ body: "记得看这个" })]);
    renderPage();
    expect(await screen.findByTestId("saved-message-row")).toBeTruthy();
    expect(screen.getByText(/私信 · user-1/)).toBeTruthy();
    expect(screen.getByText("记得看这个")).toBeTruthy();
  });

  it("uses a group title when the conversation has one", async () => {
    mockedList.mockResolvedValueOnce([
      row({ conversationType: "GROUP", conversationTitle: "观测站", body: "集合" }),
    ]);
    renderPage();
    expect(await screen.findByText(/观测站 · user-1/)).toBeTruthy();
  });

  it("deep-links to the original conversation", async () => {
    mockedList.mockResolvedValueOnce([row({ conversationId: "conv-9" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: "查看原会话" });
    expect(link.getAttribute("href")).toBe("/messages/conv-9");
  });
});

describe("SavedMessagesPage — tombstone", () => {
  it("renders the server's recall string as a tombstone, hiding the body", async () => {
    mockedList.mockResolvedValueOnce([row({ body: "[消息已撤回]" })]);
    renderPage();
    await screen.findByTestId("saved-message-row");
    // The served string is shown verbatim — never re-derived on the client.
    expect(screen.getByText("[消息已撤回]")).toBeTruthy();
  });
});

describe("SavedMessagesPage — attachments", () => {
  it("renders an image attachment and suppresses a body that repeats its URL", async () => {
    mockedList.mockResolvedValueOnce([
      row({ messageType: "IMAGE", attachmentUrl: "/a.png", body: "/a.png" }),
    ]);
    renderPage();
    await screen.findByTestId("saved-message-row");
    expect(screen.getByRole("img", { name: "图片" })).toBeTruthy();
    // The URL must not also be printed as body text.
    expect(screen.queryByText("/a.png")).toBeNull();
  });

  it("renders a file attachment by name", async () => {
    mockedList.mockResolvedValueOnce([
      row({ messageType: "FILE", attachmentUrl: "/a.pdf", attachmentName: "说明.pdf", body: null }),
    ]);
    renderPage();
    expect(await screen.findByRole("link", { name: "说明.pdf" })).toBeTruthy();
  });
});

describe("SavedMessagesPage — removal", () => {
  it("removes the row only after the server confirms", async () => {
    mockedList.mockResolvedValueOnce([row({ messageId: "msg-1" })]);
    mockedRemove.mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /取消收藏/ }));

    await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith("msg-1"));
    // DELETE takes the MESSAGE id, never the bookmark row id.
    expect(mockedRemove).not.toHaveBeenCalledWith("bookmark-1");
    await waitFor(() => expect(screen.getByTestId("page-state-empty")).toBeTruthy());
  });

  it("keeps the row and reports a 404 rather than pretending it is gone", async () => {
    mockedList.mockResolvedValueOnce([row({ messageId: "msg-1" })]);
    mockedRemove.mockRejectedValueOnce(
      new ApiError({
        type: "about:blank",
        title: "未找到",
        status: 404,
        detail: "不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /取消收藏/ }));

    expect(await screen.findByText("这条收藏已经不存在了，刷新后可看到最新列表。")).toBeTruthy();
    expect(screen.getByTestId("saved-message-row")).toBeTruthy();
  });

  it("reports a generic failure without dropping the row", async () => {
    mockedList.mockResolvedValueOnce([row()]);
    mockedRemove.mockRejectedValueOnce(new Error("network"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /取消收藏/ }));

    expect(await screen.findByText("取消收藏失败，请稍后重试。")).toBeTruthy();
    expect(screen.getByTestId("saved-message-row")).toBeTruthy();
  });
});
