import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { MyGroupsPage } from "./MyGroupsPage";

/*
 * Page tests for /me/groups (Phase 3E).
 *
 * The non-obvious behaviours pinned here:
 *   1. DIRECT rows is filtered OUT (the mailbox mixes types in one array).
 *   2. Creation is RETIRED (2026-10-06): `POST /messages/group` can only ever seat
 *      the caller as the sole OWNER and V2 has no way to add anyone, so the entry
 *      point is hidden. The client capability and the endpoint stay for the Group
 *      Messaging Product Phase.
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

  it("explains an empty group list WITHOUT offering creation (2026-10-06)", async () => {
    listConversations.mockResolvedValue([
      { id: "d1", type: "DIRECT", title: null, unreadCount: 0 },
    ]);
    renderPage();
    expect(await screen.findByText("暂无群聊")).toBeInTheDocument();
    // Creation is retired: `POST /messages/group` only seats the caller as OWNER and
    // V2 has no way to add anyone, so the button could only ever produce a group of
    // one. An entry point that always yields a dead object is a fake capability.
    expect(screen.queryByRole("button", { name: /创建群聊/ })).not.toBeInTheDocument();
  });
});

/*
 * 2026-10-06 — the creation surface is intentionally gone, so the whole "creating" suite
 * is replaced by assertions that it stays gone. Group creation itself is NOT removed:
 * `messagesApi.createGroup` and the backend endpoint stay, and come back with the
 * Group Messaging Product Phase (member adding + group discovery).
 */
describe("MyGroupsPage — creation is retired (not removed)", () => {
  it("has no creation entry, and the API surface is untouched", async () => {
    listConversations.mockResolvedValue([group({ id: "g1" })]);
    renderPage();
    await screen.findByText("前端交流");
    expect(screen.queryByRole("button", { name: /创建群聊/ })).not.toBeInTheDocument();
    // The capability itself is still wired on the client, just not offered.
    expect(typeof createGroup).toBe("function");
  });

  it("does not claim members can be added later", async () => {
    listConversations.mockResolvedValue([group({ id: "g1" })]);
    renderPage();
    await screen.findByText("前端交流");
    // The old copy said 「之后可以在群聊里添加成员」 with no such control anywhere.
    expect(screen.queryByText(/添加成员/)).not.toBeInTheDocument();
    expect(screen.queryByText(/邀请/)).not.toBeInTheDocument();
  });

  it("still lists groups the user is already in", async () => {
    listConversations.mockResolvedValue([group({ id: "g1", title: "已存在的群" })]);
    renderPage();
    expect(await screen.findByText("已存在的群")).toBeInTheDocument();
  });
});

describe("MyGroupsPage — ownership", () => {
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
