import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import type { Notification } from "@/api/notifications/notifications.types";
import { NotificationBell } from "./NotificationBell";

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderBell(unread: number | null = 1) {
  return render(
    <MemoryRouter initialEntries={["/discover"]}>
      <Routes>
        <Route
          path="/discover"
          element={
            <>
              <NotificationBell unread={unread} />
              <LocationProbe />
            </>
          }
        />
        <Route path="/u/:username" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.list.mockResolvedValue([FOLLOW]);
  mocked.getUnreadCount.mockResolvedValue(0);
  mocked.markRead.mockImplementation(async (id) => ({ ...FOLLOW, id, read: true }));
  mocked.markAllRead.mockResolvedValue(undefined);
});

describe("NotificationBell", () => {
  it("opens a 328px card under the bell and stays on the current page", async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole("button", { name: "通知（1 条未读）" }));

    expect(await screen.findByRole("heading", { name: "通知" })).toBeInTheDocument();
    expect(await screen.findByText("爱丽丝 关注了你")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/discover");

    const list = screen.getByText("爱丽丝 关注了你").closest("[data-header-menu-list]");
    expect(list).toHaveClass("max-h-[min(32rem,70dvh)]");
    expect(list?.parentElement).toHaveClass("w-[min(24rem,calc(100vw-2rem))]");
    expect(list?.parentElement?.className).not.toMatch(/328px|480px/);
    expect(screen.queryByRole("navigation", { name: "通知分类" })).not.toBeInTheDocument();
  });

  it("follows the actor when a row is opened", async () => {
    const user = userEvent.setup();
    renderBell();
    await user.click(screen.getByRole("button", { name: "通知（1 条未读）" }));
    await user.click(await screen.findByRole("button", { name: "爱丽丝 关注了你" }));

    expect(await screen.findByTestId("location")).toHaveTextContent("/u/alice");
    expect(mocked.markRead).toHaveBeenCalledWith("n1");
  });
});
