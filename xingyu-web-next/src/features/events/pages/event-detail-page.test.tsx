import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import type { EventSubmissionView, EventView } from "@/api/events/events.types";
import { useAuth } from "@/features/auth/auth.store";
import { EventDetailPage } from "./EventDetailPage";

/*
 * One event (Phase 2I-4).
 *
 * Three behaviours matter and are pinned here:
 *   1. The public submission list is ACCEPTED-ONLY — an empty list must not be
 *      rendered as "nobody submitted".
 *   2. Registration and submission are two different actions.
 *   3. A 404 from cancel-registration is the empty state, not an error banner.
 */

vi.mock("@/api/events/events.api", () => ({
  eventsApi: {
    get: vi.fn(),
    listAcceptedSubmissions: vi.fn(),
    register: vi.fn(),
    cancelRegistration: vi.fn(),
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: vi.fn(),
}));

const mocked = vi.mocked(eventsApi);
const mockedUseAuth = vi.mocked(useAuth);

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
    status: "ACCEPTED",
    createdAt: "2026-09-30T02:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/events/e1"]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    isAuthenticated: false,
    user: null,
    status: "anonymous",
  } as unknown as ReturnType<typeof useAuth>);
  mocked.listAcceptedSubmissions.mockResolvedValue([]);
});

describe("EventDetailPage — loading and errors", () => {
  it("shows a loading state while the event is in flight", () => {
    mocked.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("says the event does not exist on a 404, and offers the way back", async () => {
    mocked.get.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "活动不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage();

    expect(await screen.findByText("活动不存在")).toBeInTheDocument();
    expect(
      screen.getByText("这个活动不存在，或者已经下线。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回活动广场" })).toHaveAttribute(
      "href",
      "/events",
    );
  });

  it("prefers the backend's own wording for a non-404 failure", async () => {
    mocked.get.mockRejectedValue(
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

  it("renders the event even when the submission list fails", async () => {
    // The list is decoration; a failure there must not sink the page.
    mocked.get.mockResolvedValue(event());
    mocked.listAcceptedSubmissions.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "星语创作赛" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("暂无通过审核的投稿。投稿需要经过审核后才会公示。"),
    ).toBeInTheDocument();
  });
});

describe("EventDetailPage — submission list", () => {
  it("words an empty list as 暂无通过审核的投稿, not as nobody having submitted", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.listAcceptedSubmissions.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText(
        "暂无通过审核的投稿。投稿需要经过审核后才会公示。",
      ),
    ).toBeInTheDocument();
  });

  it("lists accepted submissions with their type and title", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.listAcceptedSubmissions.mockResolvedValue([
      submission({
        id: "s1",
        objectTitle: "星空下的约定",
        objectType: "SERIES",
        status: "ACCEPTED",
      }),
    ]);
    renderPage();

    const list = await screen.findByLabelText("投稿列表");
    expect(within(list).getByText("星空下的约定")).toBeInTheDocument();
    expect(within(list).getByText("系列作品")).toBeInTheDocument();
    expect(within(list).getByLabelText("已通过")).toBeInTheDocument();
  });

  it("falls back to 未命名作品 when the server could not resolve a title", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.listAcceptedSubmissions.mockResolvedValue([
      submission({ objectTitle: null }),
    ]);
    renderPage();

    const list = await screen.findByLabelText("投稿列表");
    expect(within(list).getByText("未命名作品")).toBeInTheDocument();
  });
});

describe("EventDetailPage — submission gate", () => {
  it("offers 提交作品 when submissions are open", async () => {
    mocked.get.mockResolvedValue(event({ submissionOpen: true }));
    renderPage();

    expect(
      await screen.findByRole("link", { name: "提交作品" }),
    ).toHaveAttribute("href", "/events/e1/submit");
  });

  it("hides 提交作品 when submissions are closed but the event is still running", async () => {
    // The trap: closed submissions is NOT "the event is over".
    mocked.get.mockResolvedValue(
      event({ submissionOpen: false, endsAt: "2099-10-05T02:00:00Z" }),
    );
    renderPage();

    await screen.findByRole("heading", { name: "星语创作赛" });
    expect(
      screen.queryByRole("link", { name: "提交作品" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("暂未开放投稿").length).toBeGreaterThan(0);
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
  });

  it("says 已结束 and hides submission once endsAt has passed", async () => {
    mocked.get.mockResolvedValue(
      event({ submissionOpen: true, endsAt: "2000-01-01T00:00:00Z" }),
    );
    renderPage();

    await screen.findByRole("heading", { name: "星语创作赛" });
    expect(screen.getAllByText("已结束").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: "提交作品" }),
    ).not.toBeInTheDocument();
  });
});

describe("EventDetailPage — guest", () => {
  it("offers 登录后参与 with a returnTo pointing back at this event", async () => {
    mocked.get.mockResolvedValue(event());
    renderPage();

    const link = await screen.findByRole("link", { name: "登录后参与" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fevents%2Fe1");
  });

  it("does not offer the registration button to a guest", async () => {
    mocked.get.mockResolvedValue(event());
    renderPage();

    await screen.findByRole("heading", { name: "星语创作赛" });
    expect(
      screen.queryByRole("button", { name: /报名参加/ }),
    ).not.toBeInTheDocument();
  });
});

describe("EventDetailPage — registration", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "u1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("starts from a neutral 报名参加 rather than claiming to know the state", async () => {
    // There is no "am I registered" endpoint, so first paint must not assert it.
    mocked.get.mockResolvedValue(event());
    renderPage();

    expect(
      await screen.findByRole("button", { name: /报名参加/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /取消报名/ }),
    ).not.toBeInTheDocument();
  });

  it("reports what the server returned rather than assuming REGISTERED", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.register.mockResolvedValue({
      id: "r1",
      eventId: "e1",
      status: "REGISTERED",
      createdAt: "2026-09-28T02:00:00Z",
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /报名参加/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /取消报名/ }),
      ).toBeInTheDocument();
    });
    expect(mocked.register).toHaveBeenCalledWith("e1");
  });

  it("treats a 404 from cancel-registration as the empty state, not an error", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.register.mockResolvedValue({
      id: "r1",
      eventId: "e1",
      status: "REGISTERED",
    });
    mocked.cancelRegistration.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "没有报名记录",
        code: "NOT_FOUND",
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /报名参加/ }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /取消报名/ }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /取消报名/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /报名参加/ }),
      ).toBeInTheDocument();
    });
    // The 404 is the state we asked for — it must not produce a banner.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces the backend's reason when registration genuinely fails", async () => {
    mocked.get.mockResolvedValue(event());
    mocked.register.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "活动报名已关闭",
        code: "CONFLICT",
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /报名参加/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "活动报名已关闭",
    );
  });

  it("hides the registration button once the event has ended", async () => {
    mocked.get.mockResolvedValue(event({ endsAt: "2000-01-01T00:00:00Z" }));
    renderPage();

    await screen.findByRole("heading", { name: "星语创作赛" });
    expect(
      screen.queryByRole("button", { name: /报名参加/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps registration separate from submission", async () => {
    mocked.get.mockResolvedValue(event({ submissionOpen: true }));
    renderPage();

    await screen.findByRole("heading", { name: "星语创作赛" });
    // Both actions exist and neither implies the other.
    expect(screen.getByRole("link", { name: "提交作品" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /报名参加/ }),
    ).toBeInTheDocument();
  });
});
