import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import { ApiError } from "@/api/client";
import type { Notification } from "@/api/notifications/notifications.types";
import { onUnreadChanged } from "./unread-sync";
import { NotificationsPage } from "./pages/NotificationsPage";

vi.mock("@/api/notifications/notifications.api", () => ({
  notificationsApi: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const mocked = vi.mocked(notificationsApi);

const FOLLOW: Notification = {
  id: "n1",
  category: "FOLLOW",
  title: "爱丽丝 关注了你",
  body: null,
  read: false,
  createdAt: "2026-09-27T02:00:00Z",
  actor: { userId: "u1", username: "alice", displayName: "爱丽丝" },
};

/** Unread, no actor — the shape of a FOLLOW row written before V044 added the identity. */
const NO_ACTOR: Notification = {
  id: "n2",
  category: "FOLLOW",
  title: "有人关注了你",
  body: null,
  read: false,
  createdAt: "2026-09-26T02:00:00Z",
  actor: null,
};

const READ_FOLLOW: Notification = {
  id: "n3",
  category: "FOLLOW",
  title: "鲍勃 关注了你",
  body: null,
  read: true,
  createdAt: null,
  actor: { userId: "u2", username: "bob", displayName: "鲍勃" },
};

/** Actor present but with no resolvable username -> no destination. */
const UNRESOLVABLE_ACTOR: Notification = {
  id: "n4",
  category: "FOLLOW",
  title: "某位用户 关注了你",
  body: null,
  read: false,
  createdAt: "2026-09-27T03:00:00Z",
  actor: { userId: "u9", username: null, displayName: null },
};

function authError(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "请先登录",
    status: 401,
    detail: "请先登录",
    code: "AUTH_REQUIRED",
  });
}

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function ProfileProbe() {
  const { username } = useParams();
  return <div data-testid="profile">{username}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/u/:username" element={<ProfileProbe />} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Server-confirmed counts published to the shell header during a test. */
let published: number[] = [];
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  published = [];
  unsubscribe?.();
  unsubscribe = onUnreadChanged((count) => published.push(count));
  mocked.getUnreadCount.mockResolvedValue(0);
  mocked.markAllRead.mockResolvedValue(undefined);
});

describe("NotificationsPage", () => {
  it("shows loading while the list request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("fetches a single 50-item window (no cursor paging)", async () => {
    mocked.list.mockResolvedValue([]);
    renderPage();
    await screen.findByTestId("page-state-empty");
    expect(mocked.list).toHaveBeenCalledWith(50);
  });

  it("lists notifications", async () => {
    mocked.list.mockResolvedValue([FOLLOW, READ_FOLLOW]);
    renderPage();

    expect(await screen.findByText("爱丽丝 关注了你")).toBeInTheDocument();
    expect(screen.getByText("鲍勃 关注了你")).toBeInTheDocument();
  });

  /*
   * The lede reports the SERVER's account-wide count, not the number of unread rows
   * in this 50-row window. They are different numbers, and the header badge shows the
   * server one — two different numbers on one screen would be the bug.
   */
  it("shows the server's account-wide unread count, not the window's", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockResolvedValue(9);
    renderPage();

    expect(await screen.findByText("9 条未读")).toBeInTheDocument();
  });

  it("falls back to the window count when the server count cannot be read", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockRejectedValue(new Error("offline"));
    renderPage();

    expect(await screen.findByText("1 条未读")).toBeInTheDocument();
  });

  it("narrows the reading column instead of stretching a row across the shell", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    const { container } = renderPage();
    await screen.findByText("爱丽丝 关注了你");
    // 1440 下 shell 是 1200px，一行 FOLLOW 不该横跨整个内容区。
    expect(container.querySelector(".max-w-2xl")).not.toBeNull();
  });

  it("explains an expired session on 401 rather than showing an empty list", async () => {
    mocked.list.mockRejectedValue(authError());
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("shows a generic error for a non-auth failure", async () => {
    mocked.list.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("无法读取通知列表，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });
});

/*
 * Contract honesty: the backend has one producer (FOLLOW). The UI must not offer a
 * taxonomy over data that cannot exist, and the empty state must not name producers
 * that do not exist.
 */
describe("NotificationsPage only surfaces real capabilities", () => {
  it("offers no category filters", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    expect(screen.queryByRole("navigation", { name: "通知分类" })).not.toBeInTheDocument();
    // 精确名匹配：批量动作「全部已读」必须留下，被删掉的是三个筛选 Tab。
    expect(screen.queryByRole("button", { name: "全部" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "互动" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "系统" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /全部已读/ })).toBeInTheDocument();
  });

  it("does not promise 点赞 / 评论 / 系统 notifications in the empty state", async () => {
    mocked.list.mockResolvedValue([]);
    renderPage();
    await screen.findByText("暂无通知");

    expect(screen.getByText("有人关注你时，会出现在这里。")).toBeInTheDocument();
    expect(screen.queryByText(/点赞|评论/)).not.toBeInTheDocument();
  });
});

describe("NotificationsPage mark-read", () => {
  it("opens the actor's canonical profile", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.markRead.mockResolvedValue({ ...FOLLOW, read: true });
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你" }));

    expect(mocked.markRead).toHaveBeenCalledWith("n1");
    expect(await screen.findByTestId("profile")).toHaveTextContent("alice");
  });

  it("reports a 404 as 'gone' rather than a generic failure", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.markRead.mockRejectedValue(notFound());
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你" }));

    expect(mocked.markRead).toHaveBeenCalledWith("n1");
  }, 20000);

  /*
   * 反证：写入失败时 badge 不能被错误扣减。
   * 页面只在服务端确认之后才广播，失败路径一次广播都不发。
   */
  it("does NOT publish an unread change when the mark-read call fails", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockResolvedValue(1);
    mocked.markRead.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "t",
        status: 500,
        detail: "boom",
        code: "UNKNOWN",
      }),
    );
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    published = [];
    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你" }));

    expect(published).toEqual([]);
  }, 20000);

  it("does not optimistically flip the row to read when the write fails", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockResolvedValue(1);
    let observed: (() => void) | null = null;

    mocked.markRead.mockImplementation(async () => {
      setTimeout(() => observed?.(), 0);
      throw new ApiError({
        type: "about:blank",
        title: "t",
        status: 500,
        detail: "boom",
        code: "UNKNOWN",
      });
    });

    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    const done = new Promise<void>((resolve) => {
      observed = () => {
        // Still unread on screen, and the failure is stated.
        expect(screen.getByText("未读")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("标记已读失败，请稍后重试。");
        resolve();
      };
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你" }));
    await done;
  }, 20000);

  it("publishes the server's new count after a successful mark-read", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockResolvedValueOnce(1).mockResolvedValue(0);
    mocked.markRead.mockResolvedValue({ ...FOLLOW, read: true });
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    published = [];
    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你" }));

    expect(await screen.findByTestId("profile")).toHaveTextContent("alice");
    await vi.waitFor(() => expect(published).toEqual([0]));
  }, 20000);

  it("does not offer a click target for a row with no destination", async () => {
    // 没有 actor 的历史 FOLLOW 行、以及 actor 查不到用户名的行，都渲染成纯文本 ——
    // 好过给一个点了没用的链接。
    mocked.list.mockResolvedValue([NO_ACTOR, UNRESOLVABLE_ACTOR]);
    renderPage();
    await screen.findByText("有人关注了你");
    expect(screen.getByText("某位用户 关注了你")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "有人关注了你" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "某位用户 关注了你" })).not.toBeInTheDocument();
  });
});

describe("NotificationsPage mark-all-read", () => {
  it("publishes 0 to the header after the account-wide 204", async () => {
    mocked.list.mockResolvedValue([FOLLOW, NO_ACTOR]);
    mocked.getUnreadCount.mockResolvedValue(2);
    renderPage();
    await screen.findByText("2 条未读");

    published = [];
    await userEvent.setup().click(screen.getByRole("button", { name: /全部已读/ }));

    expect(mocked.markAllRead).toHaveBeenCalled();
    // read-all 的语义是账户全部通知，所以 0 是服务端语义的直接结果，不是猜测。
    expect(published).toEqual([0]);
    expect(await screen.findByText("没有未读通知")).toBeInTheDocument();
  });

  it("keeps the unread state and publishes nothing when mark-all fails", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.getUnreadCount.mockResolvedValue(1);
    mocked.markAllRead.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "t",
        status: 500,
        detail: "全部标记失败",
        code: "UNKNOWN",
      }),
    );
    renderPage();
    await screen.findByText("1 条未读");

    published = [];
    await userEvent.setup().click(screen.getByRole("button", { name: /全部已读/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("全部标记失败");
    expect(screen.getByText("1 条未读")).toBeInTheDocument();
    expect(published).toEqual([]);
  });

  it("disables the control when there is nothing unread", async () => {
    mocked.list.mockResolvedValue([READ_FOLLOW]);
    mocked.getUnreadCount.mockResolvedValue(0);
    renderPage();
    await screen.findByText("鲍勃 关注了你");
    expect(screen.getByRole("button", { name: /全部已读/ })).toBeDisabled();
  });
});
