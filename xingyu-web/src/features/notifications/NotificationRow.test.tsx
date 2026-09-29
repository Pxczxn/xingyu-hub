import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import type { Notification } from "@/api/notifications/notifications.types";
import { NotificationRow } from "./NotificationRow";

const FOLLOW: Notification = {
  id: "n1",
  category: "FOLLOW",
  title: "爱丽丝 关注了你",
  body: "@alice 开始关注你",
  read: false,
  createdAt: "2026-09-27T02:00:00Z",
};

function renderRow(overrides: Partial<Parameters<typeof NotificationRow>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <ul>
        <NotificationRow
          notification={FOLLOW}
          label="关注"
          href="/me/followers"
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
    expect(screen.getByRole("button", { name: "爱丽丝 关注了你（关注）" })).toBeInTheDocument();
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

  it("carries the localised category label", () => {
    renderRow({ label: "关注" });
    expect(screen.getByText("关注")).toBeInTheDocument();
  });
});

