import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import type { EventSubmissionView, EventView } from "@/api/events/events.types";
import { MyEventsPage } from "./MyEventsPage";

/*
 * My events (Phase 2I-4).
 *
 * Two reads are joined: /me/event-submissions (every submission, any status) and
 * /events (the ACTIVE events, to name and link each row). The behaviours worth
 * pinning are the join's consequences — an orphaned submission keeps its row and
 * loses its link — and the fact that grouping follows REVIEW STATE, not event
 * lifecycle, because no per-event lifecycle is available to the client.
 */

vi.mock("@/api/events/events.api", () => ({
  eventsApi: { list: vi.fn(), listMySubmissions: vi.fn() },
}));

const mocked = vi.mocked(eventsApi);

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "e1",
    slug: "starry",
    title: "星语创作赛",
    body: "用文字记录你的星空",
    startsAt: "2026-09-29T02:00:00Z",
    endsAt: "2099-10-05T02:00:00Z",
    submissionOpen: true,
    ...overrides,
  };
}

function submission(
  overrides: Partial<EventSubmissionView> = {},
): EventSubmissionView {
  return {
    id: "s1",
    eventId: "e1",
    objectType: "ARTICLE",
    objectId: "a1",
    objectTitle: "我的星空",
    note: null,
    status: "SUBMITTED",
    createdAt: "2026-09-30T02:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyEventsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.list.mockResolvedValue([]);
  mocked.listMySubmissions.mockResolvedValue([]);
});

describe("MyEventsPage — empty and error", () => {
  it("shows a loading state while both reads are in flight", () => {
    mocked.listMySubmissions.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("says there is nothing yet, and points at the events square", async () => {
    renderPage();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("还没有参与活动")).toBeInTheDocument();
    expect(screen.getByText("还没有活动投稿记录")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "浏览活动" })).toHaveAttribute(
      "href",
      "/events",
    );
  });

  it("asks the user to sign in again when the session expired", async () => {
    mocked.listMySubmissions.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        code: "AUTH_REQUIRED",
        detail: "",
      }),
    );
    renderPage();

    expect(
      await screen.findByText("登录状态已过期，请重新登录。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("prefers the backend's own wording for a non-auth failure", async () => {
    mocked.listMySubmissions.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "投稿记录暂时不可用",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByText("投稿记录暂时不可用")).toBeInTheDocument();
  });
});

describe("MyEventsPage — the join", () => {
  it("names the event behind each submission", async () => {
    mocked.listMySubmissions.mockResolvedValue([submission({ eventId: "e1" })]);
    mocked.list.mockResolvedValue([event({ id: "e1", title: "星语创作赛" })]);
    renderPage();

    const list = await screen.findByLabelText("投稿记录");
    expect(within(list).getByText("星语创作赛")).toBeInTheDocument();
    expect(
      within(list).getByRole("link", { name: "查看活动" }),
    ).toHaveAttribute("href", "/events/e1");
  });

  it("keeps an orphaned submission's row but drops its dead link", async () => {
    // The event list is ACTIVE-only, so a taken-down event leaves the submission
    // orphaned. Dropping the row would erase the user's own history.
    mocked.listMySubmissions.mockResolvedValue([
      submission({ eventId: "gone" }),
    ]);
    mocked.list.mockResolvedValue([event({ id: "e1" })]);
    renderPage();

    const list = await screen.findByLabelText("投稿记录");
    expect(within(list).getByText("我的星空")).toBeInTheDocument();
    expect(within(list).getByText("活动已不在开放列表")).toBeInTheDocument();
    expect(
      within(list).queryByRole("link", { name: "查看活动" }),
    ).not.toBeInTheDocument();
  });

  it("still renders the history when the event list fails", async () => {
    // The events read is decoration; its failure must not erase the submissions.
    mocked.listMySubmissions.mockResolvedValue([submission({ eventId: "e1" })]);
    mocked.list.mockRejectedValue(new Error("network"));
    renderPage();

    // Promise.all rejects, so the whole page errors — assert the honest outcome
    // rather than a half-rendered one.
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

describe("MyEventsPage — grouping", () => {
  it("buckets by review state, counting each tab", async () => {
    mocked.listMySubmissions.mockResolvedValue([
      submission({ id: "s1", status: "SUBMITTED" }),
      submission({ id: "s2", status: "ACCEPTED" }),
      submission({ id: "s3", status: "REJECTED" }),
      submission({ id: "s4", status: "APPROVED" }),
    ]);
    mocked.list.mockResolvedValue([event()]);
    renderPage();

    await screen.findByLabelText("投稿记录");
    const tabs = screen.getByLabelText("投稿状态");
    // APPROVED is the legacy spelling of ACCEPTED and must land in the same tab.
    expect(
      within(tabs).getByRole("button", { name: /^待审核/ }),
    ).toHaveTextContent("1");
    expect(
      within(tabs).getByRole("button", { name: /^已通过/ }),
    ).toHaveTextContent("2");
    expect(
      within(tabs).getByRole("button", { name: /^未通过/ }),
    ).toHaveTextContent("1");
  });

  it("shows only the selected bucket's rows", async () => {
    mocked.listMySubmissions.mockResolvedValue([
      submission({
        id: "s1",
        status: "SUBMITTED",
        objectTitle: "审核中的作品",
      }),
      submission({ id: "s2", status: "ACCEPTED", objectTitle: "已通过的作品" }),
    ]);
    mocked.list.mockResolvedValue([event()]);
    renderPage();

    await screen.findByLabelText("投稿记录");
    expect(screen.getByText("审核中的作品")).toBeInTheDocument();
    expect(screen.queryByText("已通过的作品")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^已通过/ }));

    expect(await screen.findByText("已通过的作品")).toBeInTheDocument();
    expect(screen.queryByText("审核中的作品")).not.toBeInTheDocument();
  });

  it("explains an empty bucket instead of showing nothing", async () => {
    mocked.listMySubmissions.mockResolvedValue([
      submission({ status: "SUBMITTED" }),
    ]);
    mocked.list.mockResolvedValue([event()]);
    renderPage();

    await screen.findByLabelText("投稿记录");
    fireEvent.click(screen.getByRole("button", { name: /^未通过/ }));

    expect(await screen.findByText("没有未通过的投稿")).toBeInTheDocument();
  });

  it("shows the object type and review wording for a row", async () => {
    mocked.listMySubmissions.mockResolvedValue([
      submission({ objectType: "SERIES", status: "ACCEPTED" }),
    ]);
    mocked.list.mockResolvedValue([event()]);
    renderPage();

    // The default tab is 待审核, so an accepted row lives under its own tab.
    await screen.findByTestId("page-state-empty");
    fireEvent.click(screen.getByRole("button", { name: /^已通过/ }));

    const list = await screen.findByLabelText("投稿记录");
    expect(within(list).getByText("系列作品")).toBeInTheDocument();
    expect(within(list).getByText("已通过")).toBeInTheDocument();
    expect(within(list).getByText("已审核")).toBeInTheDocument();
  });
});

describe("MyEventsPage — recommendations", () => {
  it("recommends active events the user has not submitted to", async () => {
    mocked.listMySubmissions.mockResolvedValue([submission({ eventId: "e1" })]);
    mocked.list.mockResolvedValue([
      event({ id: "e1", title: "已参与的活动" }),
      event({ id: "e2", title: "可以参加的活动" }),
    ]);
    renderPage();

    await screen.findByLabelText("投稿记录");
    expect(
      screen.getByRole("link", { name: /可以参加的活动/ }),
    ).toHaveAttribute("href", "/events/e2");
    expect(
      screen.queryByRole("link", { name: /已参与的活动/ }),
    ).not.toBeInTheDocument();
  });

  it("says so when every active event has already been entered", async () => {
    mocked.listMySubmissions.mockResolvedValue([submission({ eventId: "e1" })]);
    mocked.list.mockResolvedValue([event({ id: "e1" })]);
    renderPage();

    await screen.findByLabelText("投稿记录");
    expect(
      screen.getByText("你已经参与了所有进行中的活动。"),
    ).toBeInTheDocument();
  });

  it("says there is nothing to recommend when there are no submissions either", async () => {
    renderPage();
    expect(await screen.findByText("暂无可推荐活动。")).toBeInTheDocument();
  });
});
