import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { SearchMessagesPage } from "./SearchMessagesPage";

/*
 * Mailbox-wide message search (Phase 2I-3b).
 *
 * The two behaviour traps this pins:
 *  1. The query lives in the URL, and a blank box must CLEAR it rather than
 *     search for nothing — the server answers a blank q with `[]` and no error,
 *     so searching an empty string would make the page claim it searched.
 *  2. A search hit may arrive with `conversationType` unset and no ownership
 *     information. Nothing may be guessed from either.
 */

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    search: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

function hit(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    // Search hits are the one place this can be null — the service does not
    // fill it for /search, unlike the thread endpoints.
    conversationType: null,
    senderId: "u-2",
    sequenceNumber: 1,
    body: "关于星语的消息",
    messageType: "TEXT",
    attachmentUrl: null,
    attachmentName: null,
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

function renderSearch(initial = "/messages/search") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/messages" element={<div>私信列表</div>} />
        <Route path="/login" element={<div>登录页</div>} />
        <Route path="/messages/search" element={<SearchMessagesPage />} />
        <Route path="/messages/:conversationId" element={<div>会话详情</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SearchMessagesPage — the query gate", () => {
  it("does NOT call the API on first load with no query", () => {
    renderSearch();
    expect(mocked.search).not.toHaveBeenCalled();
    expect(screen.getByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("输入关键词开始搜索")).toBeInTheDocument();
  });

  it("searches the query that is already in the URL", async () => {
    mocked.search.mockResolvedValue([hit()]);
    renderSearch("/messages/search?q=%E6%98%9F%E8%AF%AD");

    expect(await screen.findByLabelText("搜索结果")).toBeInTheDocument();
    expect(mocked.search).toHaveBeenCalledWith("星语", 50);
  });

  it("submits the typed keyword and searches it", async () => {
    mocked.search.mockResolvedValue([]);
    renderSearch();

    fireEvent.change(screen.getByLabelText("搜索消息"), { target: { value: "星语" } });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(mocked.search).toHaveBeenCalledWith("星语", 50));
  });

  it("clears the query on an empty submit instead of searching for nothing", async () => {
    mocked.search.mockResolvedValue([hit()]);
    renderSearch("/messages/search?q=%E6%98%9F%E8%AF%AD");
    await screen.findByLabelText("搜索结果");
    expect(mocked.search).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("搜索消息"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));

    // Back to the idle prompt, and no second request — the server would have
    // answered `[]` and the page would have shown "没有找到".
    expect(await screen.findByText("输入关键词开始搜索")).toBeInTheDocument();
    expect(mocked.search).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/没有找到/)).not.toBeInTheDocument();
  });

  it("distinguishes 'no results' from 'not searched yet'", async () => {
    mocked.search.mockResolvedValue([]);
    renderSearch("/messages/search?q=zzz");

    // Searched and empty: says so, quoting the keyword.
    expect(await screen.findByText("没有找到与「zzz」相关的消息")).toBeInTheDocument();
    // ...and is NOT the idle prompt.
    expect(screen.queryByText("输入关键词开始搜索")).not.toBeInTheDocument();
  });
});

describe("SearchMessagesPage — results", () => {
  it("renders a hit without needing conversationType", async () => {
    mocked.search.mockResolvedValue([hit({ conversationType: null })]);
    renderSearch("/messages/search?q=a");

    const list = await screen.findByLabelText("搜索结果");
    expect(within(list).getByText("关于星语的消息")).toBeInTheDocument();
  });

  it("links each hit back to its conversation, encoded", async () => {
    mocked.search.mockResolvedValue([hit({ conversationId: "a/b" })]);
    renderSearch("/messages/search?q=a");

    const list = await screen.findByLabelText("搜索结果");
    expect(within(list).getByRole("link", { name: "查看所在会话" })).toHaveAttribute(
      "href",
      "/messages/a%2Fb",
    );
  });

  it("never offers 撤回 or a sender label, because ownership is unknowable here", async () => {
    // No socket is opened on this page, so the caller's own id is unknown and
    // every bubble must stay neutral rather than guess.
    mocked.search.mockResolvedValue([hit({ senderId: "u-2" })]);
    renderSearch("/messages/search?q=a");

    const list = await screen.findByLabelText("搜索结果");
    expect(within(list).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
  });

  it("renders a recalled hit as a tombstone rather than its body", async () => {
    mocked.search.mockResolvedValue([
      hit({ recalledAt: "2026-09-27T04:00:00Z", body: "[消息已撤回]" }),
    ]);
    renderSearch("/messages/search?q=a");

    const list = await screen.findByLabelText("搜索结果");
    expect(list.querySelector("[data-recalled='true']")).not.toBeNull();
  });

  it("renders one row per hit", async () => {
    mocked.search.mockResolvedValue([
      hit({ id: "a", conversationId: "c1" }),
      hit({ id: "b", conversationId: "c2" }),
    ]);
    renderSearch("/messages/search?q=a");

    const list = await screen.findByLabelText("搜索结果");
    expect(within(list).getAllByRole("link", { name: "查看所在会话" })).toHaveLength(2);
  });
});

describe("SearchMessagesPage — errors", () => {
  it("shows the backend's own reason when it gives one", async () => {
    mocked.search.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "参数无效",
        status: 400,
        detail: "关键词过长",
        code: "BAD_REQUEST",
      }),
    );
    renderSearch("/messages/search?q=a");

    expect(await screen.findByText("关键词过长")).toBeInTheDocument();
  });

  it("falls back to a plain statement when the backend gives no detail", async () => {
    mocked.search.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "",
        code: "INTERNAL_ERROR",
      }),
    );
    renderSearch("/messages/search?q=a");

    expect(await screen.findByText("无法完成搜索，请稍后重试。")).toBeInTheDocument();
  });

  it("sends an expired session to login", async () => {
    mocked.search.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderSearch("/messages/search?q=a");

    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });
});

