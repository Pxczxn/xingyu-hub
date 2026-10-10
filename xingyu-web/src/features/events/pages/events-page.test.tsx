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
    // Defaults to a RUNNING event at NOW: started in the past, not yet ended.
    // The previous default was a future start, which the page now (correctly)
    // groups under 「即将开始」 — so it would no longer exercise the list.
    startsAt: "2026-09-20T02:00:00Z",
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
    // An ended event is no longer mixed into 「进行中的活动」; it gets its own section.
    const endedList = await screen.findByLabelText("已结束的活动列表");
    expect(within(endedList).getAllByText("已结束").length).toBeGreaterThan(0);
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

describe("EventsPage — time grouping", () => {
  it("counts only not-ended events under 进行中的活动", async () => {
    // The bug this guards: the header used to read "共 N 场" from the raw ACTIVE
    // list, so an ended event inflated a count labelled "running".
    mocked.list.mockResolvedValue([
      event({ id: "live", title: "进行中" }),
      event({ id: "done", title: "已结束的", endsAt: "2026-09-01T02:00:00Z" }),
    ]);
    renderPage(NOW);

    const liveList = await screen.findByLabelText("活动列表");
    expect(within(liveList).getAllByRole("listitem")).toHaveLength(1);
    expect(within(liveList).getByText("进行中")).toBeInTheDocument();
    // The running header and the ended header can both legitimately read
    // "共 1 场", so count the headers rather than assuming a single match.
    expect(screen.getAllByText("共 1 场")).toHaveLength(2);
    // …and the count that belongs to 「进行中的活动」 is the one without an
    // ended section above it: assert on the running section's own heading pair.
    const headings = screen.getAllByRole("heading", { name: "进行中的活动" });
    expect(headings).toHaveLength(1);
  });

  it("never counts a not-yet-started event under 进行中的活动", async () => {
    // The bug this guards: 「进行中」 used to mean merely "not ended", so a
    // future-starting event appeared in BOTH 「进行中的活动」 and 「即将开始」 —
    // two labels describing disjoint states. Advance registration before
    // startsAt stays legal; only the display partition must be exclusive.
    mocked.list.mockResolvedValue([
      event({ id: "future", title: "还没开始的", startsAt: "2026-09-30T02:00:00Z", endsAt: null }),
    ]);
    renderPage(NOW);

    // It belongs to 即将开始 …
    const upcomingLink = await screen.findByRole("link", { name: /还没开始的/ });
    expect(upcomingLink).toBeInTheDocument();
    // … so the running section must report zero, not one.
    expect(screen.getByText("当前没有进行中的活动。")).toBeInTheDocument();
    expect(screen.queryByText("共 1 场")).not.toBeInTheDocument();
  });

  it("splits a mixed list into three disjoint buckets", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "live", title: "进行中的" }),
      event({ id: "future", title: "未来的", startsAt: "2026-09-30T02:00:00Z", endsAt: null }),
      event({ id: "done", title: "已结束的", endsAt: "2026-09-01T02:00:00Z" }),
    ]);
    renderPage(NOW);

    const liveList = await screen.findByLabelText("活动列表");
    expect(within(liveList).getByText("进行中的")).toBeInTheDocument();
    expect(within(liveList).queryByText("未来的")).not.toBeInTheDocument();
    expect(within(liveList).queryByText("已结束的")).not.toBeInTheDocument();

    const endedList = screen.getByLabelText("已结束的活动列表");
    expect(within(endedList).getByText("已结束的")).toBeInTheDocument();

    // Each bucket holds exactly one row — no row is double-counted.
    expect(screen.getAllByText("共 1 场")).toHaveLength(2);
  });

  it("treats an event starting exactly at now as running, not upcoming", async () => {
    // Boundary: startsAt <= now is running. Only a strictly-future start is
    // upcoming, so the boundary instant must fall on the running side.
    const atNow = new Date(NOW).toISOString();
    mocked.list.mockResolvedValue([
      event({ id: "at-boundary", title: "正好开始", startsAt: atNow, endsAt: null }),
    ]);
    renderPage(NOW);

    const liveList = await screen.findByLabelText("活动列表");
    expect(within(liveList).getByText("正好开始")).toBeInTheDocument();
    expect(screen.getByText("暂无即将开始的活动。")).toBeInTheDocument();
  });

  it("keeps an event with endsAt=null in the running bucket indefinitely", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "no-end", title: "没有结束时间", startsAt: "2026-01-01T00:00:00Z", endsAt: null }),
    ]);
    renderPage(NOW);

    const liveList = await screen.findByLabelText("活动列表");
    expect(within(liveList).getByText("没有结束时间")).toBeInTheDocument();
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });

  it("keeps ended events browsable in their own section", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "done", title: "已结束的", endsAt: "2026-09-01T02:00:00Z" }),
    ]);
    renderPage(NOW);

    const endedList = await screen.findByLabelText("已结束的活动列表");
    expect(within(endedList).getByText("已结束的")).toBeInTheDocument();
    // Still reachable — history must not be deleted, only demoted.
    expect(within(endedList).getByRole("link", { name: /查看详情/ })).toHaveAttribute(
      "href",
      "/events/done",
    );
  });

  it("never features an ended event as the hero when a live one exists", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "done", title: "已结束的", endsAt: "2026-09-01T02:00:00Z" }),
      event({ id: "live", title: "进行中的" }),
    ]);
    renderPage(NOW);

    // The hero's CTA is 「立即参与」; it must point at the live event.
    expect(await screen.findByRole("link", { name: "立即参与" })).toHaveAttribute(
      "href",
      "/events/live",
    );
  });
});

describe("EventsPage — calendar", () => {
  const SEPTEMBER = new Date("2026-09-01T00:00:00Z").getTime();

  /*
    These cases page at SEPTEMBER (Sep 1) purely to check WHICH calendar square
    gets marked. The default `event()` starts Sep 20, which at that instant is
    still in the future — under the locked partition it is 「即将开始」, so there is
    no 「进行中的活动」 list to await. The calendar itself renders regardless of the
    partition, so that is the correct thing to wait on here.
  */
  const RUNNING = { startsAt: "2026-08-20T02:00:00Z", endsAt: "2026-10-05T02:00:00Z" };

  it("marks the CST day of an event", async () => {
    mocked.list.mockResolvedValue([
      event({ ...RUNNING, startsAt: "2026-09-15T02:00:00Z" }),
    ]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动日历");

    // 02:00 UTC on the 15th is the 15th in CST too.
    const marked = screen.getByLabelText("15 日有活动");
    expect(marked).toHaveAttribute("data-event", "true");
  });

  it("marks the NEXT day when the instant falls after CST midnight", async () => {
    // 16:30 UTC on the 15th is 00:30 on the 16th in Shanghai — a naive
    // local-time read would mark the wrong square.
    // Starts Aug 20 so the event is already running at the SEPTEMBER render.
    mocked.list.mockResolvedValue([
      event({ id: "cst", startsAt: "2026-09-15T16:30:00Z", endsAt: "2026-10-05T02:00:00Z" }),
      event({ id: "running", ...RUNNING }),
    ]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动日历");

    expect(screen.getByLabelText("16 日有活动")).toHaveAttribute("data-event", "true");
    expect(screen.queryByLabelText("15 日有活动")).not.toBeInTheDocument();
  });

  it("does not mark any day when the event has no start time", async () => {
    mocked.list.mockResolvedValue([event({ ...RUNNING, startsAt: null })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动日历");

    expect(screen.queryByLabelText(/日有活动/)).not.toBeInTheDocument();
  });

  it("says so when there is nothing with a start time to schedule", async () => {
    mocked.list.mockResolvedValue([event({ ...RUNNING, startsAt: null })]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动日历");

    expect(screen.getByText("暂无即将开始的活动。")).toBeInTheDocument();
  });

  it("links upcoming events from the sidebar", async () => {
    mocked.list.mockResolvedValue([
      event({ id: "e9", title: "即将开始的活动", startsAt: "2026-09-29T02:00:00Z" }),
    ]);
    renderPage(SEPTEMBER);
    await screen.findByLabelText("活动日历");

    const link = screen.getByRole("link", { name: /即将开始的活动/ });
    expect(link).toHaveAttribute("href", "/events/e9");
  });

  it("does NOT list an already-started event under 即将开始", async () => {
    // The bug this guards: the sidebar used to take the first three events that
    // merely HAD a start time, so a date in the past was advertised as upcoming.
    // NOW here is 2026-09-28, and the event started 09/20 — strictly in the past.
    mocked.list.mockResolvedValue([
      event({ id: "past", title: "早就开始的活动", startsAt: "2026-09-20T02:00:00Z" }),
    ]);
    renderPage(NOW);
    await screen.findByLabelText("活动列表");

    expect(screen.getByText("暂无即将开始的活动。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /早就开始的活动/ })).not.toBeInTheDocument();
  });
});

describe("EventsPage — calendar navigation", () => {
  it("moves the visible month without refetching", async () => {
    // Rendered at Sep 15; the default event starts Sep 20, i.e. still future
    // there — so pin an already-started window to keep a 「进行中」 list mounted.
    mocked.list.mockResolvedValue([
      event({ startsAt: "2026-08-20T02:00:00Z", endsAt: "2026-10-05T02:00:00Z" }),
    ]);
    renderPage(new Date("2026-09-15T00:00:00Z").getTime());
    await screen.findByLabelText("活动列表");

    expect(screen.getByLabelText("2026年9月")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("上个月"));
    expect(await screen.findByLabelText("2026年8月")).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledTimes(1);
  });
});
