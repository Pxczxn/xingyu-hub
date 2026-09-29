import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import type { EventView } from "@/api/events/events.types";
import { EventsPage } from "./EventsPage";

/*
 * The events square (Phase 2I-4).
 *
 * Public and guest-readable. The behaviour worth pinning is the status copy:
 * `submissionOpen` is NOT "the event is over", and the calendar marks CST days.
 *
 * Time is injected as a prop rather than faked with `vi.useFakeTimers()`.
 * Freezing the global clock also freezes testing-library's own polling, so
 * every `findBy*` below would hang until the 5s test timeout. The page takes
 * `now` for exactly this reason — and the tests exercise that same seam.
 */

vi.mock("@/api/events/events.api", () => ({
  eventsApi: { list: vi.fn(), get: vi.fn() },
}));

const mocked = vi.mocked(eventsApi);

/** 2026-09-28 10:00 CST — the instant the page is rendered at in these tests. */
const NOW = new Date("2026-09-28T02:00:00Z").getTime();

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "e1",
    slug: "starry",
    title: "星语创作赛",
    body: "用文字记录你的星空",
    startsAt: "2026-09-29T02:00:00Z",
    endsAt: "2026-10-05T02:00:00Z",
    submissionOpen: true,
    ...overrides,
  };
}

function renderPage(now: number = NOW) {
  return render(
    <MemoryRouter>
      <EventsPage now={now} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventsPage — list", () => {
  it("shows loading while the request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("renders the events in the order the server returned", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "first", title: "第一场" }),
      event({ id: "second", title: "第二场" }),
    ]);
    renderPage();

    const list = await screen.findByLabelText("活动列表");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("第一场")).toBeInTheDocument();
  });

  it("features the server's first row rather than re-ranking", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "e1", title: "被推荐的活动" }),
      event({ id: "e2", title: "普通活动" }),
    ]);
    renderPage();

    // The feature is a section above the list; its own link text gives it away.
    expect(await screen.findByRole("link", { name: "立即参与" })).toHaveAttribute(
      "href",
      "/events/e1",
    );
  });

  it("shows the empty state rather than an empty shell", async () => {
    mocked.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂未发布活动")).toBeInTheDocument();
  });

  it("shows the backend's own reason when it gives one", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "活动服务暂时不可用",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByText("活动服务暂时不可用")).toBeInTheDocument();
  });

  it("falls back to a plain statement without a detail", async () => {
    mocked.list.mockRejectedValue(new Error("network"));
    renderPage();
    expect(await screen.findByText("无法读取活动列表，请稍后重试。")).toBeInTheDocument();
  });
});

describe("EventsPage — status copy", () => {
  it("says 开放投稿 when submissions are open", async () => {
    mocked.list.mockResolvedValue([event({ submissionOpen: true })]);
    renderPage();
    await screen.findByLabelText("活动列表");
    expect(screen.getAllByText("开放投稿").length).toBeGreaterThan(0);
  });

  it("says 暂未开放投稿 — NOT 已结束 — when only submissions are closed", async () => {
    // The trap: submissionOpen=false while the event is still running. Reading
    // that as "ended" would tell the user something false.
    mocked.list.mockResolvedValue([
      event({ submissionOpen: false, endsAt: "2026-10-05T02:00:00Z" }),
    ]);
    renderPage(NOW);
    await screen.findByLabelText("活动列表");

    expect(screen.getAllByText("暂未开放投稿").length).toBeGreaterThan(0);
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });

  it("says 已结束 once endsAt has passed, even if submissions were left open", async () => {
    mocked.list.mockResolvedValue([
      event({ submissionOpen: true, endsAt: "2026-09-01T02:00:00Z" }),
    ]);
    renderPage(NOW);
    await screen.findByLabelText("活动列表");
    expect(screen.getAllByText("已结束").length).toBeGreaterThan(0);
  });

  it("does not say 已结束 when endsAt is unknown", async () => {
    // "We do not know" is not "finished" — the absence of a date must not be
    // rendered as an ending.
    mocked.list.mockResolvedValue([event({ endsAt: null, submissionOpen: true })]);
    renderPage(NOW);
    await screen.findByLabelText("活动列表");
    expect(screen.getAllByText("开放投稿").length).toBeGreaterThan(0);
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });
});

describe("EventsPage — calendar", () => {
  const SEPTEMBER = new Date("2026-09-01T00:00:00Z").getTime();

  it("marks the CST day of an event", async () => {
    mocked.list.mockResolvedValue([event({ startsAt: "2026-09-15T02:00:00Z" })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动列表");

    // 02:00 UTC on the 15th is the 15th in CST too.
    const marked = screen.getByLabelText("15 日有活动");
    expect(marked).toHaveAttribute("data-event", "true");
  });

  it("marks the NEXT day when the instant falls after CST midnight", async () => {
    // 16:30 UTC on the 15th is 00:30 on the 16th in Shanghai — a naive
    // local-time read would mark the wrong square.
    mocked.list.mockResolvedValue([event({ startsAt: "2026-09-15T16:30:00Z" })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动列表");

    expect(screen.getByLabelText("16 日有活动")).toHaveAttribute("data-event", "true");
    expect(screen.queryByLabelText("15 日有活动")).not.toBeInTheDocument();
  });

  it("does not mark any day when the event has no start time", async () => {
    mocked.list.mockResolvedValue([event({ startsAt: null })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动列表");

    expect(screen.queryByLabelText(/日有活动/)).not.toBeInTheDocument();
  });

  it("says so when there is nothing with a start time to schedule", async () => {
    mocked.list.mockResolvedValue([event({ startsAt: null })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动列表");

    expect(screen.getByText("暂无带开始时间的活动安排。")).toBeInTheDocument();
  });

  it("links upcoming events from the sidebar", async () => {
    mocked.list.mockResolvedValue([event({ id: "e9", title: "即将开始的活动" })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动列表");

    const link = screen.getByRole("link", { name: /即将开始的活动/ });
    expect(link).toHaveAttribute("href", "/events/e9");
  });
});

describe("EventsPage — calendar navigation", () => {
  it("moves the visible month without refetching", async () => {
    mocked.list.mockResolvedValue([event()]);
    renderPage(new Date("2026-09-15T00:00:00Z").getTime());
    await screen.findByLabelText("活动列表");

    expect(screen.getByLabelText("2026年9月")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("上个月"));
    expect(await screen.findByLabelText("2026年8月")).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledTimes(1);
  });
});
