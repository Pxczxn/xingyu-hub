import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { EventView } from "@/api/events/events.types";
import { CommunityEventsPanel, EVENT_LIMIT } from "./CommunityEventsPanel";

/*
 * The home rail's time semantics.
 *
 * The server returns ACTIVE events ordered by `starts_at DESC` and knows nothing
 * about ended-ness. The rail must not turn that into "the newest N are the ones
 * worth joining": an ended event could otherwise displace a live one, and an
 * ended event shown without a label reads as still-open.
 *
 * `now` is injectable for the same reason as on the events page — freezing the
 * global clock also freezes testing-library's polling.
 */

/** 2026-09-28 10:00 CST. */
const NOW = new Date("2026-09-28T02:00:00Z").getTime();

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "e1",
    slug: "starry",
    title: "星语创作赛",
    body: "用文字记录你的星空",
    startsAt: "2026-09-20T02:00:00Z",
    endsAt: "2026-10-05T02:00:00Z",
    submissionOpen: true,
    ...overrides,
  };
}

function renderPanel(items: EventView[]) {
  return render(
    <MemoryRouter>
      <CommunityEventsPanel status="ready" items={items} now={NOW} />
    </MemoryRouter>,
  );
}

describe("CommunityEventsPanel", () => {
  it("marks an ended event so it never reads as still-joinable", () => {
    renderPanel([event({ id: "done", title: "已结束的", endsAt: "2026-09-01T02:00:00Z" })]);

    expect(screen.getByText("已结束的")).toBeInTheDocument();
    expect(screen.getByText("已结束")).toBeInTheDocument();
  });

  it("does not label an event with no end time as ended", () => {
    renderPanel([event({ endsAt: null })]);
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });

  it("does not present a not-yet-started event as already running", () => {
    // The rail carries no 「进行中」 label at all — it shows the date range and
    // only badges 「已结束」. So a future event must read as a future date
    // ("09/29 起"), never as a running one, and must not carry the ended badge.
    renderPanel([
      event({ id: "future", title: "还没开始的", startsAt: "2026-09-29T02:00:00Z", endsAt: null }),
    ]);

    expect(screen.getByText("还没开始的")).toBeInTheDocument();
    expect(screen.getByText("09/29 起")).toBeInTheDocument();
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
    expect(screen.queryByText(/进行中/)).not.toBeInTheDocument();
  });

  it("keeps a not-yet-started event in the not-ended group, ahead of ended ones", () => {
    // The rail's contract is a STABLE partition: everything not-ended keeps the
    // server's order and only ended rows are demoted. It deliberately does not
    // re-rank running above upcoming — so this only pins that a future event is
    // grouped with the live ones rather than being pushed down with history.
    // EVENT_LIMIT is 2, so exactly the two not-ended rows survive the slice.
    renderPanel([
      event({ id: "done", title: "已结束的", startsAt: "2026-09-27T02:00:00Z", endsAt: "2026-09-27T03:00:00Z" }),
      event({ id: "future", title: "未来的", startsAt: "2026-09-29T02:00:00Z", endsAt: null }),
      event({ id: "live", title: "进行中的" }),
    ]);

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    // Both not-ended rows beat the ended one to the two visible slots.
    expect(hrefs).toContain("/events/future");
    expect(hrefs).toContain("/events/live");
    expect(hrefs).not.toContain("/events/done");
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });

  it("prefers a live event over an ended one even when the ended one is newer", () => {
    // The server order here puts the ended event first (newest start). A naive
    // `slice(0, EVENT_LIMIT)` would drop the live event entirely.
    renderPanel([
      event({ id: "done", title: "已结束的", startsAt: "2026-09-27T02:00:00Z", endsAt: "2026-09-27T03:00:00Z" }),
      event({ id: "live", title: "进行中的" }),
    ]);

    expect(screen.getByText("进行中的")).toBeInTheDocument();
    // EVENT_LIMIT is 2, so both fit — but the live one must come first.
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs.indexOf("/events/live")).toBeLessThan(hrefs.indexOf("/events/done"));
  });

  it("never truncates a live event away to make room for ended ones", () => {
    // Three ended events ahead of one live event: with EVENT_LIMIT=2 the live
    // event must still be shown.
    renderPanel([
      event({ id: "d1", title: "结束一", startsAt: "2026-09-27T02:00:00Z", endsAt: "2026-09-27T03:00:00Z" }),
      event({ id: "d2", title: "结束二", startsAt: "2026-09-26T02:00:00Z", endsAt: "2026-09-26T03:00:00Z" }),
      event({ id: "d3", title: "结束三", startsAt: "2026-09-25T02:00:00Z", endsAt: "2026-09-25T03:00:00Z" }),
      event({ id: "live", title: "进行中的" }),
    ]);

    expect(screen.getByText("进行中的")).toBeInTheDocument();
    // The rail still respects its own size budget.
    expect(screen.getAllByRole("link")).toHaveLength(EVENT_LIMIT + 1); // +1 for 全部 ›
  });

  it("renders nothing when the section is empty", () => {
    const { container } = render(
      <MemoryRouter>
        <CommunityEventsPanel status="empty" items={[]} now={NOW} />
      </MemoryRouter>,
    );
    // status="empty" is the contract for "hide the rail", not "show an empty box".
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the date range for an event with both bounds", () => {
    renderPanel([event({ startsAt: "2026-09-20T02:00:00Z", endsAt: "2026-10-05T02:00:00Z" })]);
    const link = screen.getByRole("link", { name: /星语创作赛/ });
    expect(within(link).getByText(/09\/20 - 10\/05/)).toBeInTheDocument();
  });
});
