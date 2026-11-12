import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import { ApiError } from "@/api/client";
import { BookshelfPage } from "./pages/BookshelfPage";

vi.mock("@/api/bookshelf/bookshelf.api", () => ({
  bookshelfApi: { list: vi.fn() },
}));

const mocked = vi.mocked(bookshelfApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/bookshelf"]}>
      <Routes>
        <Route path="/me/bookshelf" element={<BookshelfPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookshelfPage", () => {
  it("shows loading while the request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows the empty series-subscription copy", async () => {
    mocked.list.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderPage();
    expect(await screen.findByText("暂时还没有订阅的系列")).toBeInTheDocument();
    expect(screen.queryByText("加入收藏夹后显示在这里")).not.toBeInTheDocument();
    expect(screen.queryByText("想读")).not.toBeInTheDocument();
    expect(screen.queryByText("在读")).not.toBeInTheDocument();
    expect(screen.queryByText("已读")).not.toBeInTheDocument();
    expect(screen.queryByText("收藏的文章")).not.toBeInTheDocument();
  });

  it("shows an error state", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renders subscribed series without fake reading metrics", async () => {
    mocked.list.mockResolvedValue({
      items: [
        {
          id: "ser-1",
          objectType: "SERIES",
          title: "星语长篇",
          summary: "简介",
          cover: null,
          authorName: null,
          updatedAt: "2026-09-22T11:37:47Z",
        },
      ],
      nextCursor: null,
      total: 1,
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "星语长篇" })).toBeInTheDocument();
    expect(screen.getByText("简介")).toBeInTheDocument();
    expect(screen.getAllByText("系列").length).toBeGreaterThan(0);
    expect(screen.queryByText("阅读时长")).not.toBeInTheDocument();
    expect(screen.queryByText("年度目标")).not.toBeInTheDocument();
  });

  /*
   * 骨架护栏（阶段 3，SK6 迁移时新增）。
   *
   * 这两条断言钉住的正是这次改造「有意改掉的视觉结构」，所以必须由测试看住：
   * 1. 行是「行」——发丝线分隔、没有逐项卡面（D=紧）；退回成 `rounded-xl bg-card`
   *    的卡片墙时这条会红。
   * 2. 右栏是 SK6 的轨，且必须有两块真实信息（本页是 /me/* 11 个同形列表页的模板）。
   * 页头只允许一个 h1（来自 masthead），也不允许再手写第二个标题。
   */
  const twoItems = {
    items: [
      {
        id: "ser-1",
        objectType: "SERIES",
        title: "星语长篇",
        summary: "简介",
        cover: null,
        authorName: "林晚",
        updatedAt: "2026-09-22T11:37:47Z",
      },
      {
        id: "ser-2",
        objectType: "SERIES",
        title: "旧系列",
        summary: null,
        cover: null,
        authorName: null,
        updatedAt: "2026-08-01T09:00:00Z",
      },
    ],
    nextCursor: null,
    total: 2,
  };

  it("renders the stream as hairline rows instead of card faces", async () => {
    mocked.list.mockResolvedValue(twoItems);
    renderPage();
    const row = (await screen.findByRole("heading", { name: "星语长篇" })).closest("li");
    expect(row).not.toBeNull();
    expect(row?.className).toContain("border-b");
    expect(row?.className).not.toContain("rounded-xl");
    expect(row?.className).not.toContain("bg-card");
  });

  it("keeps one h1 and puts two real information panels in the rail", async () => {
    mocked.list.mockResolvedValue(twoItems);
    renderPage();
    const rail = await screen.findByRole("complementary");
    /* 页头只来自 masthead；条目标题是 h3，不会再造一个一级标题。 */
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "我的书架" })).toBeInTheDocument();
    /* 块 1：概览（计数 + 最近更新），块 2：最近更新（前三条）。 */
    expect(within(rail).getByRole("heading", { name: "书架概览" })).toBeInTheDocument();
    expect(within(rail).getByRole("heading", { name: "最近更新" })).toBeInTheDocument();
    expect(within(rail).getByText("在架系列")).toBeInTheDocument();
    expect(within(rail).getByText("2")).toBeInTheDocument();
    /* 最近更新按 updatedAt 倒序：9 月的那条在前，8 月的在后。 */
    const latestTitles = within(rail)
      .getAllByRole("listitem")
      .map((item) => item.firstElementChild?.textContent);
    expect(latestTitles).toEqual(["星语长篇", "旧系列"]);
  });
});
