import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import type { Notification } from "@/api/notifications/notifications.types";
import { NotificationRow, formatNotificationAt, notificationIcon } from "./NotificationRow";

const FOLLOW: Notification = {
  id: "n1",
  category: "FOLLOW",
  title: "爱丽丝 关注了你",
  body: null,
  read: false,
  createdAt: "2026-09-27T02:00:00Z",
  actor: { userId: "u1", username: "alice", displayName: "爱丽丝" },
};

function renderRow(overrides: Partial<Parameters<typeof NotificationRow>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <ul>
        <NotificationRow
          notification={FOLLOW}
          href="/u/alice"
          pending={false}
          onOpen={onOpen}
          {...overrides}
        />
      </ul>
    </MemoryRouter>,
  );
  return onOpen;
}

beforeEach(() => {
  vi.clearAllMocks();
  void notificationsApi;
});

describe("NotificationRow", () => {
  it("renders a clickable row when the page resolved a destination", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "爱丽丝 关注了你" })).toBeInTheDocument();
  });

  it("renders plain text when there is no safe destination", () => {
    renderRow({ href: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("爱丽丝 关注了你")).toBeInTheDocument();
  });

  it("keeps an unread row marked as unread for assistive tech", () => {
    renderRow();
    // The gold dot is decorative; the text is what is announced.
    expect(screen.getByText("未读")).toBeInTheDocument();
  });

  it("announces nothing extra once the row is read", () => {
    renderRow({ notification: { ...FOLLOW, read: true } });
    expect(screen.queryByText("未读")).not.toBeInTheDocument();
  });

  it("renders the title and the time, and no third line for a FOLLOW row", () => {
    // 单行目标：title 已完整表达「谁 · 做了什么」，后端也不写 body，所以行内不应出现第二段文案。
    renderRow();
    expect(screen.getByText("爱丽丝 关注了你")).toBeInTheDocument();
    expect(screen.getByRole("time")).toHaveTextContent(/2026/);
    expect(screen.queryByText(/开始关注你/)).not.toBeInTheDocument();
  });

  it("still renders a body when a notification carries one", () => {
    // body 列还在 —— 将来真有 producer 需要第二行时不必改渲染层。
    renderRow({ notification: { ...FOLLOW, body: "补充说明" } });
    expect(screen.getByText("补充说明")).toBeInTheDocument();
  });

  it("omits the timestamp when createdAt is missing or unparseable", () => {
    renderRow({ notification: { ...FOLLOW, createdAt: null } });
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });
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
