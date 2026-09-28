import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { MyGroupsPage } from "./MyGroupsPage";

/*
 * Page tests for /me/groups (Phase 3E).
 *
 * The non-obvious behaviours pinned here:
 *   1. DIRECT rows is filtered OUT (the mailbox mixes types in one array).
 *   2. Creation sends ONLY the title — the endpoint ignores anything else, so an
 *      "invite members" affordance must not exist.
 *   3. Rows link to the SHARED /messages/:id route, never Legacy's unrouted
 *      /messages/group/:id.
 */

const listConversations = vi.fn();
const createGroup = vi.fn();

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: (...args: unknown[]) => listConversations(...args),
    createGroup: (...args: unknown[]) => createGroup(...args),
  },
}));

function group(over: Record<string, unknown> = {}) {
  return {
    id: "g1",
    type: "GROUP",
    title: "前端交流",
    updatedAt: "2026-09-28T10:00:00Z",
    unreadCount: 0,
    joinMode: "OPEN",
    myRole: "OWNER",
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/groups"]}>
      <MyGroupsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listConversations.mockResolvedValue([group()]);
  createGroup.mockResolvedValue(group({ id: "g-new", title: "新群" }));
});

describe("MyGroupsPage — loading & error", () => {
  it("shows a loading state first", () => {
    listConversations.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("reports a non-auth failure with the server's detail", async () => {
    listConversations.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "boom",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    const alert = await screen.findByTestId("page-state-error");
    expect(alert).toHaveTextContent("系统繁忙，请稍后再试");
  });

  it("tells an expired session to log in again (401)", async () => {
    listConversations.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    await screen.findByTestId("page-state-error");
    expect(screen.getByRole("link", { name: "去登录" })).toBeInTheDocument();
  });
});

describe("MyGroupsPage — listing", () => {
  it("renders only GROUP rows, dropping DIRECT ones", async () => {
    listConversations.mockResolvedValue([
      group({ id: "g1", title: "前端交流" }),
      { id: "d1", type: "DIRECT", title: null, unreadCount: 0 },
      group({ id: "g2", title: "读书会" }),
    ]);
    renderPage();
    expect(await screen.findByRole("heading", { name: "我的群聊" })).toBeInTheDocument();
    expect(screen.getByText("前端交流")).toBeInTheDocument();
    expect(screen.getByText("读书会")).toBeInTheDocument();
    expect(screen.queryByText("私信")).not.toBeInTheDocument();
  });

  it("falls back to 「未命名群聊」 for a null title", async () => {
    listConversations.mockResolvedValue([group({ title: null })]);
    renderPage();
    expect(await screen.findByText("未命名群聊")).toBeInTheDocument();
  });

  it("links each row to the SHARED /messages/:id route", async () => {
    listConversations.mockResolvedValue([group({ id: "abc" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: /前端交流/ });
    expect(link).toHaveAttribute("href", "/messages/abc");
    expect(link.getAttribute("href")).not.toContain("/messages/group/");
  });

  it("shows the caller's role and the join mode", async () => {
    listConversations.mockResolvedValue([group({ id: "g1", myRole: "OWNER", joinMode: "OPEN" })]);
    renderPage();
    expect(await screen.findByTestId("group-role-g1")).toHaveTextContent("群主");
    expect(screen.getByText(/开放加入/)).toBeInTheDocument();
  });

  it("shows an unread badge only when unreadCount > 0", async () => {
    listConversations.mockResolvedValue([
      group({ id: "g1", unreadCount: 3 }),
      group({ id: "g2", title: "安静群", unreadCount: 0 }),
    ]);
    renderPage();
    expect(await screen.findByTestId("group-unread-g1")).toHaveTextContent("3");
    expect(screen.queryByTestId("group-unread-g2")).not.toBeInTheDocument();
  });

  it("explains an empty group list and still offers creation", async () => {
    listConversations.mockResolvedValue([{ id: "d1", type: "DIRECT", title: null, unreadCount: 0 }]);
    renderPage();
    expect(await screen.findByText("暂无群聊")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /创建群聊/ })).toBeInTheDocument();
  });
});

describe("MyGroupsPage — creating", () => {
  it("reveals an inline form (no separate route) and sends ONLY the title", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    const input = screen.getByLabelText("群聊名称");
    fireEvent.change(input, { target: { value: "  新群  " } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
    // ONLY the title — the endpoint reads nothing else from the body.
    expect(createGroup).toHaveBeenCalledWith("新群");
  });

  it("does NOT offer a member-invite field (the endpoint would ignore it)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    expect(screen.queryByLabelText(/成员/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/邀请/)).not.toBeInTheDocument();
  });

  it("prepends the created group without refetching", async () => {
    renderPage();
    await screen.findByText("前端交流");
    fireEvent.click(screen.getByRole("button", { name: /创建群聊/ }));
    fireEvent.change(screen.getByLabelText("群聊名称"), { target: { value: "新群" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    expect(await screen.findByText("新群")).toBeInTheDocument();
    // The original row is still there and the list was NOT re-read.
    expect(screen.getByText("前端交流")).toBeInTheDocument();
    expect(listConversations).toHaveBeenCalledTimes(1);
  });

  it("creates on Enter", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    const input = screen.getByLabelText("群聊名称");
    fireEvent.change(input, { target: { value: "键盘群" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(createGroup).toHaveBeenCalledWith("键盘群"));
  });

  it("rejects an empty title locally without calling the API", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("请输入群聊名称")).toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("rejects an over-long title locally", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    fireEvent.change(screen.getByLabelText("群聊名称"), { target: { value: "x".repeat(51) } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("群聊名称不超过 50 个字符")).toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection (e.g. blank title 400) as an inline error", async () => {
    createGroup.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "校验失败",
        status: 400,
        detail: "title: 群聊标题不能为空",
        code: "VALIDATION_FAILED",
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    fireEvent.change(screen.getByLabelText("群聊名称"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByText("title: 群聊标题不能为空")).toBeInTheDocument();
  });

  it("can be dismissed without creating", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /创建群聊/ }));
    fireEvent.change(screen.getByLabelText("群聊名称"), { target: { value: "算了" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByLabelText("群聊名称")).not.toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("ships NO admin controls for a group the caller owns", async () => {
    listConversations.mockResolvedValue([group({ myRole: "OWNER" })]);
    renderPage();
    await screen.findByText("前端交流");
    // The backend HAS owner/admin writes, but this phase ships none of them — so
    // no control may imply otherwise.
    expect(screen.queryByRole("button", { name: /设置/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /公告/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /退出/ })).not.toBeInTheDocument();
  });
});
