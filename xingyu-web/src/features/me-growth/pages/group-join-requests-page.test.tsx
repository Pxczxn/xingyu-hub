import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GroupJoinRequestsPage } from "./GroupJoinRequestsPage";

const mockedList = vi.fn();

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: { listMyGroupJoinRequests: (limit?: number) => mockedList(limit) },
}));

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    conversationId: "g1",
    conversationTitle: "读书会",
    joinMode: "APPROVAL",
    message: "想加入",
    status: "PENDING",
    createdAt: "2026-09-01T10:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupJoinRequestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedList.mockResolvedValue([]);
});

describe("GroupJoinRequestsPage — scope", () => {
  it("states that following needs no request, so only join requests appear", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "关系请求" })).toBeInTheDocument();
    expect(document.body.textContent).toContain("关注是开放模式");
  });

  it("shows an empty state when there are none", async () => {
    renderPage();
    expect(await screen.findByText("暂无入群申请")).toBeInTheDocument();
  });
});

describe("GroupJoinRequestsPage — splitting", () => {
  it("separates pending from decided", async () => {
    mockedList.mockResolvedValue([
      request({ id: "p1", conversationTitle: "待审群", status: "PENDING" }),
      request({ id: "h1", conversationTitle: "已决群", status: "APPROVED" }),
    ]);
    renderPage();

    const pending = await screen.findByLabelText("待处理");
    expect(within(pending).getByText("待审群")).toBeInTheDocument();

    const history = screen.getByLabelText("历史记录");
    expect(within(history).getByText("已决群")).toBeInTheDocument();
  });

  it("hides the pending section entirely when nothing is pending", async () => {
    mockedList.mockResolvedValue([request({ status: "APPROVED" })]);
    renderPage();
    await screen.findByLabelText("历史记录");
    expect(screen.queryByLabelText("待处理")).not.toBeInTheDocument();
  });

  it("labels the three real statuses", async () => {
    mockedList.mockResolvedValue([
      request({ id: "a", status: "PENDING" }),
      request({ id: "b", status: "APPROVED" }),
      request({ id: "c", status: "REJECTED" }),
    ]);
    renderPage();
    await screen.findByLabelText("待处理");
    expect(screen.getByTestId("request-status-a")).toHaveTextContent("待处理");
    expect(screen.getByTestId("request-status-b")).toHaveTextContent("已通过");
    expect(screen.getByTestId("request-status-c")).toHaveTextContent("已拒绝");
  });

  it("shows the resolution time only once resolved", async () => {
    mockedList.mockResolvedValue([
      request({ id: "a", status: "PENDING" }),
      request({ id: "b", status: "APPROVED", resolvedAt: "2026-09-02T10:00:00Z" }),
    ]);
    renderPage();
    await screen.findByLabelText("历史记录");
    const resolved = screen.getByLabelText("历史记录");
    expect(resolved.textContent).toContain("处理于");
    const pending = screen.getByLabelText("待处理");
    expect(pending.textContent).not.toContain("处理于");
  });
});

describe("GroupJoinRequestsPage — a vanished group is reported", () => {
  it("says the group no longer exists instead of inventing a name", async () => {
    mockedList.mockResolvedValue([request({ conversationTitle: null })]);
    renderPage();
    expect(await screen.findByTestId("request-gone-r1")).toHaveTextContent("该群聊已不存在");
    // Must NOT fall back to a fabricated label like "群聊".
    expect(document.body.textContent).not.toContain("未命名群聊");
  });

  it("does not link a request whose group is gone", async () => {
    mockedList.mockResolvedValue([request({ conversationTitle: null })]);
    renderPage();
    await screen.findByTestId("request-gone-r1");
    expect(screen.queryByRole("link", { name: "查看群聊" })).not.toBeInTheDocument();
  });
});

describe("GroupJoinRequestsPage — links", () => {
  it("links to V2's real /messages/:conversationId route", async () => {
    renderPage();
    mockedList.mockResolvedValue([request({ conversationId: "g1" })]);
    renderPage();
    // First render also mounted; query within the freshest list.
    const links = await screen.findAllByRole("link", { name: "查看群聊" });
    expect(links.some((el) => el.getAttribute("href") === "/messages/g1")).toBe(true);
  });

  it("never links Legacy's unrouted /messages/group/{id}", async () => {
    mockedList.mockResolvedValue([request({ conversationId: "g1" })]);
    renderPage();
    await screen.findByRole("link", { name: "查看群聊" });
    const hrefs = screen.getAllByRole("link").map((el) => el.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.startsWith("/messages/group/"))).toBe(false);
  });
});

describe("GroupJoinRequestsPage — join mode", () => {
  it("explains an approval-gated group", async () => {
    mockedList.mockResolvedValue([request({ joinMode: "APPROVAL" })]);
    renderPage();
    expect(await screen.findByText("该群聊需要群主审批。")).toBeInTheDocument();
  });

  it("flags an OPEN group as unusual for a request row", async () => {
    mockedList.mockResolvedValue([request({ joinMode: "OPEN" })]);
    renderPage();
    expect(await screen.findByText(/无需申请/)).toBeInTheDocument();
  });
});

describe("GroupJoinRequestsPage — failures", () => {
  it("shows a retryable error", async () => {
    mockedList.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("加载失败")).toBeInTheDocument();
    expect(document.body.textContent).toContain("无法读取你的入群申请");
  });

  it("points at login when the session expired", async () => {
    const { ApiError } = await import("@/api/client");
    mockedList.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });
});

