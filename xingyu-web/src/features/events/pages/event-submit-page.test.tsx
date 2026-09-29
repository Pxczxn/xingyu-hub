import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { eventsApi } from "@/api/events/events.api";
import type { EventView } from "@/api/events/events.types";
import { momentsApi } from "@/api/moments/moments.api";
import type { MomentView } from "@/api/moments/moments.types";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesSummary } from "@/api/series/series.types";
import { EventSubmitPage } from "./EventSubmitPage";

/*
 * Submitting to an event (Phase 2I-4).
 *
 * THE FILTER IS THE FEATURE. The server 404s 「投稿内容不存在」 for anything not
 * in `search_document`, and only published content is indexed — so the page must
 * never OFFER a draft. These tests pin that narrowing, the on-demand fetch of a
 * single tab's list, and the two gates the server can still answer with.
 */

vi.mock("@/api/events/events.api", () => ({
  eventsApi: { get: vi.fn(), submit: vi.fn() },
}));
// The picker reads `normalizeLifecycleStatus` from the article API module. Mocking
// the module wholesale, as the submit page's own tests must, would otherwise turn
// that import into undefined and blow up the tab render.
vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: { listMine: vi.fn() },
  normalizeLifecycleStatus: (value: string | null | undefined) => {
    const upper = (value ?? "").toUpperCase();
    return ["DRAFT", "IN_REVIEW", "PUBLISHED"].includes(upper) ? upper : "DRAFT";
  },
}));
vi.mock("@/api/series/series.api", () => ({
  seriesApi: { listMine: vi.fn() },
}));
vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: { listMine: vi.fn() },
}));

const mockedEvents = vi.mocked(eventsApi);
const mockedArticles = vi.mocked(articlesApi);
const mockedSeries = vi.mocked(seriesApi);
const mockedMoments = vi.mocked(momentsApi);

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

function article(overrides: Partial<MyArticleSummary> = {}): MyArticleSummary {
  return {
    id: "a1",
    status: "PUBLISHED",
    title: "已发布的文章",
    categoryId: null,
    updatedAt: "2026-09-20T02:00:00Z",
    ...overrides,
  };
}

function series(overrides: Partial<SeriesSummary> = {}): SeriesSummary {
  return {
    id: "sr1",
    title: "进行中的系列",
    slug: "ongoing",
    description: null,
    status: "ACTIVE",
    chapterCount: 3,
    updatedAt: "2026-09-20T02:00:00Z",
    ...overrides,
  };
}

function moment(overrides: Partial<MomentView> = {}): MomentView {
  return {
    id: "m1",
    body: "今天看到了一颗流星",
    authorId: "u1",
    createdAt: "2026-09-20T02:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/events/e1/submit"]}>
      <Routes>
        <Route path="/events/:eventId/submit" element={<EventSubmitPage />} />
        <Route path="/events/:eventId" element={<p>活动详情占位</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedEvents.get.mockResolvedValue(event());
  mockedArticles.listMine.mockResolvedValue([]);
  mockedSeries.listMine.mockResolvedValue([]);
  mockedMoments.listMine.mockResolvedValue([]);
});

describe("EventSubmitPage — content filter", () => {
  it("only offers published articles, never drafts or in-review", async () => {
    mockedArticles.listMine.mockResolvedValue([
      article({ id: "pub", title: "已发布", status: "PUBLISHED" }),
      article({ id: "draft", title: "草稿", status: "DRAFT" }),
      article({ id: "review", title: "审核中", status: "IN_REVIEW" }),
    ]);
    renderPage();

    const select = await screen.findByLabelText("选择投稿内容");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["已发布"]);
  });

  it("only offers active series, never archived", async () => {
    mockedSeries.listMine.mockResolvedValue([
      series({ id: "sr1", title: "进行中", status: "ACTIVE" }),
      series({ id: "sr2", title: "已归档", status: "ARCHIVED" }),
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "系列作品" }));

    const select = await screen.findByLabelText("选择投稿内容");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["进行中"]);
  });

  it("offers moments with their body as the title", async () => {
    mockedMoments.listMine.mockResolvedValue([moment({ body: "今天看到了一颗流星" })]);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "社区动态" }));

    const select = await screen.findByLabelText("选择投稿内容");
    expect(select.querySelectorAll("option")[0].textContent).toBe("今天看到了一颗流星");
  });

  it("explains an empty article list instead of showing an empty dropdown", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ status: "DRAFT" })]);
    renderPage();

    expect(
      await screen.findByText(
        "没有可投稿的文章。只有已发布的文章可以投稿，草稿和审核中的文章不在范围内。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("选择投稿内容")).not.toBeInTheDocument();
  });

  it("explains an empty moment list", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "社区动态" }));

    expect(
      await screen.findByText("还没有可投稿的动态。发布一条动态后就可以投稿了。"),
    ).toBeInTheDocument();
  });
});

describe("EventSubmitPage — fetch behaviour", () => {
  it("only fetches the active tab's list", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    renderPage();
    await screen.findByLabelText("选择投稿内容");

    expect(mockedArticles.listMine).toHaveBeenCalledTimes(1);
    // Loading all three would triple the requests for lists never opened.
    expect(mockedSeries.listMine).not.toHaveBeenCalled();
    expect(mockedMoments.listMine).not.toHaveBeenCalled();
  });

  it("fetches on demand when the tab changes", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedSeries.listMine.mockResolvedValue([series({ id: "sr1" })]);
    renderPage();
    await screen.findByLabelText("选择投稿内容");

    fireEvent.click(screen.getByRole("button", { name: "系列作品" }));

    await waitFor(() => expect(mockedSeries.listMine).toHaveBeenCalledTimes(1));
    expect(mockedMoments.listMine).not.toHaveBeenCalled();
  });

  it("preselects the first option so the common case is one click", async () => {
    mockedArticles.listMine.mockResolvedValue([
      article({ id: "a1", title: "第一篇" }),
      article({ id: "a2", title: "第二篇" }),
    ]);
    renderPage();

    const select = await screen.findByLabelText("选择投稿内容");
    const options = Array.from(select.querySelectorAll("option")) as HTMLOptionElement[];
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe("a1");
    expect(
      select.querySelector("option[selected]")?.getAttribute("value") ?? options[0].value,
    ).toBe("a1");
  });

  it("surfaces a load failure for the content list", async () => {
    mockedArticles.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "无法读取你的文章",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("无法读取你的文章");
  });
});

describe("EventSubmitPage — submit", () => {
  it("sends the selected object and trims the note", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedEvents.submit.mockResolvedValue({
      id: "s1",
      eventId: "e1",
      objectType: "ARTICLE",
      objectId: "a1",
      objectTitle: "已发布的文章",
      note: "创作思路",
      status: "SUBMITTED",
    });
    renderPage();

    await screen.findByLabelText("选择投稿内容");
    fireEvent.change(screen.getByLabelText("投稿说明"), {
      target: { value: "  创作思路  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交投稿" }));

    await waitFor(() => {
      expect(mockedEvents.submit).toHaveBeenCalledWith("e1", {
        objectType: "ARTICLE",
        objectId: "a1",
        note: "创作思路",
      });
    });
  });

  it("omits the note entirely when it is blank — an empty note is not a note", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedEvents.submit.mockResolvedValue({
      id: "s1",
      eventId: "e1",
      objectType: "ARTICLE",
      objectId: "a1",
      objectTitle: "已发布的文章",
      status: "SUBMITTED",
    });
    renderPage();

    await screen.findByLabelText("选择投稿内容");
    fireEvent.click(screen.getByRole("button", { name: "提交投稿" }));

    await waitFor(() => expect(mockedEvents.submit).toHaveBeenCalledTimes(1));
    const payload = mockedEvents.submit.mock.calls[0][1];
    expect("note" in payload).toBe(false);
  });

  it("returns to the event after a successful submit", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedEvents.submit.mockResolvedValue({
      id: "s1",
      eventId: "e1",
      objectType: "ARTICLE",
      objectId: "a1",
      objectTitle: "已发布的文章",
      status: "SUBMITTED",
    });
    renderPage();

    await screen.findByLabelText("选择投稿内容");
    fireEvent.click(screen.getByRole("button", { name: "提交投稿" }));

    // The event page already shows the list and the flow's third step, so a
    // separate success card would be a surface with no content of its own.
    expect(await screen.findByText("活动详情占位")).toBeInTheDocument();
  });

  it("shows the server's own 「投稿内容不存在」 verbatim", async () => {
    // This is the message a draft produces. Paraphrasing it would hide the rule.
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedEvents.submit.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "投稿内容不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage();

    await screen.findByLabelText("选择投稿内容");
    fireEvent.click(screen.getByRole("button", { name: "提交投稿" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("投稿内容不存在");
  });

  it("shows the server's 「活动投稿已关闭」 on a 409", async () => {
    mockedArticles.listMine.mockResolvedValue([article({ id: "a1" })]);
    mockedEvents.submit.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "活动投稿已关闭",
        code: "CONFLICT",
      }),
    );
    renderPage();

    await screen.findByLabelText("选择投稿内容");
    fireEvent.click(screen.getByRole("button", { name: "提交投稿" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("活动投稿已关闭");
  });
});

describe("EventSubmitPage — submission gate", () => {
  it("replaces the form with a notice when submissions are closed", async () => {
    mockedEvents.get.mockResolvedValue(event({ submissionOpen: false }));
    renderPage();

    expect(await screen.findByText("投稿通道未开放")).toBeInTheDocument();
    expect(screen.getByText("这个活动当前未开放投稿，请稍后再来。")).toBeInTheDocument();
    expect(screen.queryByLabelText("选择投稿内容")).not.toBeInTheDocument();
    // The form stays unmounted, and with it the article picker — the gate is on
    // the rendering, not on the fetch (the tab effect has no event dependency).
  });

  it("says the event is over — not merely closed — once endsAt has passed", async () => {
    mockedEvents.get.mockResolvedValue(
      event({ submissionOpen: true, endsAt: "2000-01-01T00:00:00Z" }),
    );
    renderPage();

    expect(await screen.findByText("这个活动已经结束，无法再投稿。")).toBeInTheDocument();
  });

  it("reports a 404 event as missing", async () => {
    mockedEvents.get.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "活动不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage();

    expect(await screen.findByText("这个活动不存在，或者已经下线。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回活动广场" })).toHaveAttribute("href", "/events");
  });
});
