import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesPage, PublicSeriesSummary } from "@/api/series/series.types";
import { ApiError } from "@/api/client";
import { PublicSeriesListPage } from "./pages/PublicSeriesListPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
    listPublic: vi.fn(),
    searchPublic: vi.fn(),
    getPublicById: vi.fn(),
    getPublicBySlug: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    recordReadingProgress: vi.fn(),
  },
}));

const mocked = vi.mocked(seriesApi);

function series(index: number, overrides: Partial<PublicSeriesSummary> = {}): PublicSeriesSummary {
  return {
    id: `series-${index}`,
    title: `系列 ${index}`,
    slug: `series-${index}`,
    description: `系列 ${index} 的简介`,
    chapterCount: index,
    author: { username: `author-${index}`, displayName: `作者 ${index}`, avatar: null },
    ...overrides,
  };
}

function page(
  items: PublicSeriesSummary[],
  nextCursor: string | null = null,
  total = items.length,
): PublicSeriesPage {
  return { items, nextCursor, total };
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/series"]}>
      <Routes>
        <Route path="/series" element={<PublicSeriesListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicSeriesListPage — states", () => {
  it("shows loading while the first page is in flight", () => {
    mocked.searchPublic.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no public series", async () => {
    mocked.searchPublic.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText("还没有公开的系列")).toBeInTheDocument();
  });

  it("renders each series as a work card that opens its detail page", async () => {
    mocked.searchPublic.mockResolvedValue(
      page([
        series(1, {
          id: "ser-1",
          title: "星语开发日志",
          slug: "xingyu-dev-log",
          description: "系列简介",
          chapterCount: 2,
          author: { username: "alice", displayName: "Alice", avatar: null },
        }),
      ]),
    );
    renderList();

    expect(await screen.findByText("星语开发日志")).toBeInTheDocument();

    const card = screen.getByTestId("series-work-card");
    expect(card).toHaveAttribute("href", "/series/ser-1");
    expect(within(card).getByText("系列简介")).toBeInTheDocument();
    expect(within(card).getByText("Alice")).toBeInTheDocument();
    expect(within(card).getByText("2 章")).toBeInTheDocument();
    expect(within(card).getByText("查看系列")).toBeInTheDocument();
    /* The cover is generated from the series key, so it is recognisable across visits. */
    expect(within(card).getByTestId("generated-series-cover")).toHaveAttribute(
      "data-cover-key",
      "ser-1:xingyu-dev-log",
    );
  });

  it("falls back to @username and clamps long text instead of growing the card", async () => {
    mocked.searchPublic.mockResolvedValue(
      page([
        series(1, {
          title: "长".repeat(60),
          description: "简".repeat(200),
          author: { username: "night_owl", displayName: null, avatar: null },
        }),
      ]),
    );
    renderList();

    const card = await screen.findByTestId("series-work-card");
    expect(within(card).getByText("@night_owl")).toBeInTheDocument();
    expect(card.querySelector("h3")?.className).toContain("line-clamp-2");
    expect(within(card).getByText("简".repeat(200)).className).toContain("line-clamp-2");
    expect(within(card).getByTestId("generated-series-cover").className).toContain("aspect-[3/4]");
  });

  it("lays the works out as one column on narrow screens and two from lg up", async () => {
    mocked.searchPublic.mockResolvedValue(page([series(1), series(2)]));
    renderList();

    const grid = await screen.findByTestId("series-work-grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("lg:grid-cols-2");
  });

  it("requests the first page from the paged endpoint, not the legacy window", async () => {
    mocked.searchPublic.mockResolvedValue(page([]));
    renderList();
    await screen.findByText("还没有公开的系列");
    expect(mocked.searchPublic).toHaveBeenCalledWith({ q: "", limit: 8 });
    expect(mocked.listPublic).not.toHaveBeenCalled();
  });

  it("shows the error state and retries the first page", async () => {
    mocked.searchPublic
      .mockRejectedValueOnce(
        new ApiError({
          type: "about:blank",
          title: "服务器错误",
          status: 500,
          detail: "服务器错误",
          code: "INTERNAL",
        }),
      )
      .mockResolvedValueOnce(page([series(1)]));

    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("系列 1")).toBeInTheDocument();
    expect(mocked.searchPublic).toHaveBeenLastCalledWith({ q: "", limit: 8 });
  });
});

describe("PublicSeriesListPage — paging beyond the first page", () => {
  it("keeps the service order and exposes no lifecycle or timestamp metadata", async () => {
    mocked.searchPublic.mockResolvedValue(
      page([
        series(1, { id: "older", title: "较早系列" }),
        series(2, { id: "newer", title: "最近系列", chapterCount: 3 }),
      ]),
    );
    renderList();

    const older = await screen.findByRole("link", { name: /较早系列/ });
    const newer = screen.getByRole("link", { name: /最近系列/ });
    expect(older.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("已归档")).not.toBeInTheDocument();
    expect(screen.queryByText("更新", { exact: true })).not.toBeInTheDocument();
  });

  it("keeps «load more» available while the server reports a next page", async () => {
    mocked.searchPublic.mockResolvedValueOnce(page([series(1)], "cursor-1", 9));
    renderList();

    expect(await screen.findByRole("button", { name: "加载更多系列" })).toBeInTheDocument();
  });

  it("appends the next page, never repeats a row, and stops only when the cursor is null", async () => {
    const first = Array.from({ length: 8 }, (_, index) => series(index + 1));
    mocked.searchPublic.mockResolvedValueOnce(page(first, "cursor-1", 12)).mockResolvedValueOnce(
      /* The last page overlaps the first by one id: the cursor is a boundary,
         not a promise that rows did not move between requests. */
      page([series(8), series(9), series(10), series(11), series(12)], null, 12),
    );

    renderList();
    expect(await screen.findByText("系列 8")).toBeInTheDocument();
    expect(screen.queryByText("系列 9")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "加载更多系列" }));

    expect(await screen.findByText("系列 12")).toBeInTheDocument();
    expect(screen.getAllByText("系列 8")).toHaveLength(1);
    expect(mocked.searchPublic).toHaveBeenLastCalledWith({
      q: "",
      limit: 8,
      cursor: "cursor-1",
    });
    expect(screen.queryByRole("button", { name: "加载更多系列" })).not.toBeInTheDocument();
  });

  it("keeps the loaded rows and offers a retry when load more fails", async () => {
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1)], "cursor-1", 2))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(page([series(2)], null, 2));

    renderList();
    expect(await screen.findByText("系列 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "加载更多系列" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("加载更多失败，请重试。");
    expect(screen.getByText("系列 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "加载更多系列" }));
    expect(await screen.findByText("系列 2")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops paging with an explicit message when the cursor is rejected", async () => {
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1)], "stale-cursor", 2))
      .mockRejectedValueOnce(
        new ApiError({
          type: "about:blank",
          title: "请求无效",
          status: 400,
          detail: "分页游标无效",
          code: "FIELD_INVALID",
        }),
      );

    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "加载更多系列" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("分页链接已失效");
    expect(screen.queryByRole("button", { name: "加载更多系列" })).not.toBeInTheDocument();
  });

  it("issues one request when load more is clicked twice before it resolves", async () => {
    const pending = deferred<PublicSeriesPage>();
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1)], "cursor-1", 2))
      .mockReturnValueOnce(pending.promise);

    renderList();
    const button = await screen.findByRole("button", { name: "加载更多系列" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocked.searchPublic).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.resolve(page([series(2)], null, 2));
      await pending.promise;
    });
    expect(screen.getByText("系列 2")).toBeInTheDocument();
  });

  it("drops a load-more response that arrives after the keyword changed", async () => {
    const stale = deferred<PublicSeriesPage>();
    mocked.searchPublic.mockImplementation(async (input = {}) => {
      const keyword = input.q ?? "";
      if (!keyword) return page([series(1)], null, 30);
      if (keyword === "深" && !input.cursor)
        return page([series(50, { title: "深度" })], "search-cursor", 20);
      if (keyword === "深") return stale.promise;
      /* The second keyword's results only exist on the server: they are not part
         of the first window, which is what makes this a real global-search test. */
      return page([series(51, { title: "深夜书房" })], null, 1);
    });

    renderList();
    await screen.findByText("系列 1");

    const field = screen.getByRole("textbox", { name: "搜索系列" });
    fireEvent.change(field, { target: { value: "深" } });
    expect(await screen.findByText("深度")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "加载更多系列" }));

    fireEvent.change(field, { target: { value: "深夜" } });
    expect(await screen.findByText("深夜书房")).toBeInTheDocument();

    await act(async () => {
      stale.resolve(page([series(52, { title: "旧关键词的第二页" })], null, 20));
      await stale.promise;
    });

    expect(screen.queryByText("旧关键词的第二页")).not.toBeInTheDocument();
    expect(screen.getByText("深夜书房")).toBeInTheDocument();
  });
});

describe("PublicSeriesListPage — search", () => {
  it("asks the server for the whole collection and shows the real match count", async () => {
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1), series(2)], null, 2))
      .mockResolvedValueOnce(
        page([series(40, { title: "被窗口挡住的系列", description: "第二十四页之后" })], null, 1),
      );

    renderList();
    await screen.findByText("系列 1");

    fireEvent.change(screen.getByRole("textbox", { name: "搜索系列" }), {
      target: { value: "  被窗口挡住  " },
    });

    expect(await screen.findByText("被窗口挡住的系列")).toBeInTheDocument();
    expect(mocked.searchPublic).toHaveBeenLastCalledWith({ q: "被窗口挡住", limit: 8 });
    const heading = screen.getByRole("heading", { name: "搜索结果" });
    /* Count comes from the response's `total`, not from the rendered rows. */
    expect(within(heading.parentElement!).getByText("1")).toBeInTheDocument();
  });

  it("explains a search with no matches without claiming the catalogue is empty", async () => {
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1)], null, 1))
      .mockResolvedValueOnce(page([], null, 0));

    renderList();
    await screen.findByText("系列 1");

    fireEvent.change(screen.getByRole("textbox", { name: "搜索系列" }), {
      target: { value: "不存在的关键词" },
    });

    expect(
      await screen.findByText("没有匹配「不存在的关键词」的系列，换个关键词试试。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("还没有公开的系列")).not.toBeInTheDocument();
  });

  it("restores the browse list on clear without refetching page one", async () => {
    mocked.searchPublic
      .mockResolvedValueOnce(page([series(1), series(2)], null, 2))
      .mockResolvedValueOnce(page([series(99, { title: "深夜书房" })], null, 1));

    renderList();
    await screen.findByText("系列 1");

    fireEvent.change(screen.getByRole("textbox", { name: "搜索系列" }), {
      target: { value: "深夜" },
    });
    await screen.findByText("深夜书房");

    const callsBeforeClear = mocked.searchPublic.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));

    expect(await screen.findByText("系列 1")).toBeInTheDocument();
    expect(screen.queryByText("深夜书房")).not.toBeInTheDocument();
    /* Browse state survived the search: clearing is a view switch, not a fetch. */
    await waitFor(() => {
      expect(mocked.searchPublic).toHaveBeenCalledTimes(callsBeforeClear);
    });
  });
});
