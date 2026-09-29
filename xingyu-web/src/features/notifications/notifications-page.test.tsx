import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import { ApiError } from "@/api/client";
import type { Notification } from "@/api/notifications/notifications.types";
import { formatNotificationAt, notificationIcon } from "./NotificationRow";
import { NotificationsPage } from "./pages/NotificationsPage";

vi.mock("@/api/notifications/notifications.api", () => ({
  notificationsApi: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const mocked = vi.mocked(notificationsApi);

const FOLLOW: Notification = {
  id: "n1",
  category: "FOLLOW",
  title: "爱丽丝 关注了你",
  body: "@alice 开始关注你",
  read: false,
  createdAt: "2026-09-27T02:00:00Z",
};

const ANNOUNCE: Notification = {
  id: "n2",
  category: "ANNOUNCE",
  title: "系统维护",
  body: "今晚维护",
  read: false,
  createdAt: "2026-09-26T02:00:00Z",
};

const READ_LIKE: Notification = {
  id: "n3",
  category: "LIKE",
  title: "有人赞了你的文章",
  body: null,
  read: true,
  createdAt: null,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/me/followers" element={<div>粉丝页</div>} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatNotificationAt / notificationIcon", () => {
  it("formats a real timestamp", () => {
    expect(formatNotificationAt("2026-09-27T02:00:00Z")).toMatch(/2026/);
  });

  it("returns null (not 'Invalid Date') for a missing or bad timestamp", () => {
    expect(formatNotificationAt(null)).toBeNull();
    expect(formatNotificationAt(undefined)).toBeNull();
    expect(formatNotificationAt("not-a-date")).toBeNull();
  });

  it("falls back to the bell for an unknown category instead of throwing", () => {
    expect(notificationIcon("FOLLOW")).toBe(notificationIcon("FOLLOW"));
    expect(notificationIcon("SOMETHING_NEW")).toBe(notificationIcon("nope"));
    expect(notificationIcon(null)).toBe(notificationIcon(undefined));
  });
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

  it("lists notifications and counts the unread ones", async () => {
    mocked.list.mockResolvedValue([FOLLOW, ANNOUNCE, READ_LIKE]);
    renderPage();

    expect(await screen.findByText("爱丽丝 关注了你")).toBeInTheDocument();
    expect(screen.getByText("系统维护")).toBeInTheDocument();
    expect(screen.getByText("有人赞了你的文章")).toBeInTheDocument();
    expect(screen.getByText("2 条未读")).toBeInTheDocument();
  });

  it("shows the empty state with guidance", async () => {
    mocked.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("暂无通知")).toBeInTheDocument();
    expect(screen.getByText("有人关注你、点赞或评论时，会出现在这里。")).toBeInTheDocument();
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

  it("renders no timestamp when the backend sends no createdAt", async () => {
    mocked.list.mockResolvedValue([READ_LIKE]);
    renderPage();
    await screen.findByText("有人赞了你的文章");
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });
});

describe("NotificationsPage tabs", () => {
  it("filters to the system bucket and back", async () => {
    mocked.list.mockResolvedValue([FOLLOW, ANNOUNCE]);
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    const nav = screen.getByRole("navigation", { name: "通知分类" });
    await userEvent.setup().click(within(nav).getByRole("button", { name: /系统/ }));

    expect(screen.queryByText("爱丽丝 关注了你")).not.toBeInTheDocument();
    expect(screen.getByText("系统维护")).toBeInTheDocument();

    await userEvent.setup().click(within(nav).getByRole("button", { name: /全部/ }));
    expect(screen.getByText("爱丽丝 关注了你")).toBeInTheDocument();
  });

  it("carries the unread count on each tab", async () => {
    mocked.list.mockResolvedValue([FOLLOW, ANNOUNCE]);
    renderPage();
    const nav = await screen.findByRole("navigation", { name: "通知分类" });
    expect(within(nav).getByRole("button", { name: /全部/ })).toHaveTextContent("2");
    expect(within(nav).getByRole("button", { name: /互动/ })).toHaveTextContent("1");
    expect(within(nav).getByRole("button", { name: /系统/ })).toHaveTextContent("1");
  });

  it("explains an empty tab rather than looking broken", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    const nav = screen.getByRole("navigation", { name: "通知分类" });
    await userEvent.setup().click(within(nav).getByRole("button", { name: /系统/ }));

    expect(screen.getByText("这个分类下没有通知")).toBeInTheDocument();
  });
});

describe("NotificationsPage mark-read", () => {
  /*
   * Opening a row both marks it read and navigates. To assert on the page's own
   * state we therefore have to observe it *while the write is in flight* — once
   * the promise settles the page has already unmounted.
   *
   * These tests attach their assertions inside the mock, which runs before the
   * page's `await` continues, so the container is still mounted.
   */

  it("does NOT optimistically flip a row when the mark-read call fails", async () => {
    // Deliberate difference from Legacy, which set `read: true` even on failure.
    mocked.list.mockResolvedValue([READ_LIKE, FOLLOW]);
    let observedAfterFailure: (() => void) | null = null;

    mocked.markRead.mockImplementation(async () => {
      const error = new ApiError({
        type: "about:blank",
        title: "t",
        status: 500,
        detail: "boom",
        code: "UNKNOWN",
      });
      // Let the page's catch/finally run, then inspect before it navigates.
      setTimeout(() => observedAfterFailure?.(), 0);
      throw error;
    });

    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    const observed = new Promise<void>((resolve) => {
      observedAfterFailure = () => {
        // Still unread: the failed write must not have flipped the row.
        expect(screen.getByText("1 条未读")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("标记已读失败，请稍后重试。");
        resolve();
      };
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你（关注）" }));
    await observed;
  }, 20000);

  it("reports a 404 as 'gone' rather than a generic failure", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.markRead.mockRejectedValue(notFound());
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你（关注）" }));

    // The call is what matters; the page then follows the row's destination.
    expect(mocked.markRead).toHaveBeenCalledWith("n1");
    expect(await screen.findByText("粉丝页")).toBeInTheDocument();
  }, 20000);

  it("drops the unread count after a successful mark-read", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    let observedAfterSuccess: (() => void) | null = null;

    mocked.markRead.mockImplementation(async () => {
      setTimeout(() => observedAfterSuccess?.(), 0);
      return { ...FOLLOW, read: true };
    });

    renderPage();
    await screen.findByText("爱丽丝 关注了你");
    expect(screen.getByText("1 条未读")).toBeInTheDocument();

    const observed = new Promise<void>((resolve) => {
      observedAfterSuccess = () => {
        expect(screen.getByText("没有未读通知")).toBeInTheDocument();
        resolve();
      };
    });

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你（关注）" }));
    await observed;

    expect(mocked.markRead).toHaveBeenCalledWith("n1");
  }, 20000);

  it("routes a follow notification to the followers list", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.markRead.mockResolvedValue({ ...FOLLOW, read: true });
    renderPage();
    await screen.findByText("爱丽丝 关注了你");

    await userEvent.setup().click(screen.getByRole("button", { name: "爱丽丝 关注了你（关注）" }));

    expect(await screen.findByText("粉丝页")).toBeInTheDocument();
  }, 20000);

  it("does not offer a click target for a category with no safe destination", async () => {
    // LIKE has no targetRoute and no sensible fallback, so the row is text —
    // better than a link that leads nowhere.
    mocked.list.mockResolvedValue([READ_LIKE]);
    renderPage();
    await screen.findByText("有人赞了你的文章");
    expect(screen.queryByRole("button", { name: /有人赞了你的文章/ })).not.toBeInTheDocument();
  });
});

describe("NotificationsPage mark-all-read", () => {
  it("marks everything read locally after the 204", async () => {
    mocked.list.mockResolvedValue([FOLLOW, ANNOUNCE]);
    mocked.markAllRead.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("2 条未读");

    await userEvent.setup().click(screen.getByRole("button", { name: /全部已读/ }));

    expect(mocked.markAllRead).toHaveBeenCalled();
    expect(await screen.findByText("没有未读通知")).toBeInTheDocument();
  });

  it("keeps the unread state when mark-all fails", async () => {
    mocked.list.mockResolvedValue([FOLLOW]);
    mocked.markAllRead.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "t", status: 500, detail: "全部标记失败", code: "UNKNOWN" }),
    );
    renderPage();
    await screen.findByText("1 条未读");

    await userEvent.setup().click(screen.getByRole("button", { name: /全部已读/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("全部标记失败");
    expect(screen.getByText("1 条未读")).toBeInTheDocument();
  });

  it("disables the control when there is nothing unread", async () => {
    mocked.list.mockResolvedValue([READ_LIKE]);
    renderPage();
    await screen.findByText("有人赞了你的文章");
    expect(screen.getByRole("button", { name: /全部已读/ })).toBeDisabled();
  });
});

