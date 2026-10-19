import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail } from "@/api/series/series.types";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { ApiError } from "@/api/client";
import { SeriesArticlesPage } from "./pages/SeriesArticlesPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listMine: vi.fn(),
  },
}));

const mockedSeries = vi.mocked(seriesApi);
const mockedArticles = vi.mocked(articlesApi);

const DETAIL: SeriesDetail = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "s",
  description: null,
  status: "ACTIVE",
  lockVersion: 3,
  chapters: [
    { id: "ch-1", articleId: "a1", title: "第一章", position: 1 },
    { id: "ch-2", articleId: "a2", title: "第二章", position: 2 },
  ],
  updatedAt: "2026-09-25T14:15:36Z",
};

function article(overrides: Partial<MyArticleSummary> & { id: string }): MyArticleSummary {
  return {
    status: "PUBLISHED",
    title: null,
    categoryId: null,
    updatedAt: "2026-09-25T14:15:36Z",
    ...overrides,
  };
}

const ARTICLES: MyArticleSummary[] = [
  article({ id: "a1", title: "第一章" }),
  article({ id: "a2", title: "第二章", status: "IN_REVIEW" }),
  article({ id: "a3", title: "可以添加的文章" }),
  article({ id: "a4", title: "还没公开的草稿", status: "DRAFT" }),
  article({
    id: "a5",
    title: "被治理隐藏的文章",
    moderationStatus: "HIDDEN",
  }),
];

function renderPage(entry = "/studio/series/ser-1/articles") {
  const router = createMemoryRouter(
    [
      { path: "/studio/series/:id/articles", element: <SeriesArticlesPage /> },
      { path: "/studio/series", element: <div data-testid="list-page">系列列表</div> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

async function loadPage(detail: SeriesDetail = DETAIL) {
  mockedSeries.getMine.mockResolvedValueOnce(detail);
  mockedArticles.listMine.mockResolvedValueOnce(ARTICLES);
  renderPage();
  return screen.findByTestId("chapter-list");
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function savedDetail(
  chapterIds: string[],
  lockVersion = 4,
  titles: Record<string, string> = { a1: "第一章", a2: "第二章", a3: "可以添加的文章" },
): SeriesDetail {
  return {
    ...DETAIL,
    lockVersion,
    chapters: chapterIds.map((articleId, index) => ({
      id: `ch-new-${index}`,
      articleId,
      title: titles[articleId] ?? null,
      position: index + 1,
    })),
  };
}

beforeEach(() => {
  // resetAllMocks also clears queued mockResolvedValueOnce values; clearAllMocks
  // leaves them behind and can leak one test's verification response into the next.
  vi.resetAllMocks();
});

describe("SeriesArticlesPage", () => {
  it("isolates late loads when switching between series", async () => {
    const first = deferred<SeriesDetail>();
    mockedSeries.getMine
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ...DETAIL, id: "ser-2", title: "另一个系列", chapters: [] });
    mockedArticles.listMine.mockResolvedValue(ARTICLES);
    const router = renderPage();
    await act(() => router.navigate("/studio/series/ser-2/articles"));
    await screen.findByRole("heading", { name: "另一个系列" });
    await act(async () => first.resolve(DETAIL));
    expect(screen.queryByRole("heading", { name: DETAIL.title })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "另一个系列" })).toBeInTheDocument();
  });

  it("protects refresh only while dirty and removes protection after saving", async () => {
    await loadPage();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "下移：第一章" }));
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    mockedSeries.update.mockResolvedValue(savedDetail(["a2", "a1"]));
    mockedSeries.getMine.mockResolvedValue(savedDetail(["a2", "a1"]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("已保存。");
    const saved = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(saved);
    expect(saved.defaultPrevented).toBe(false);
  });

  it("does not adopt another editor's version for local edits made during verification", async () => {
    await loadPage();
    const verification = deferred<SeriesDetail>();
    mockedSeries.update.mockResolvedValue(savedDetail(["a2", "a1"]));
    mockedSeries.getMine.mockReturnValueOnce(verification.promise);
    fireEvent.click(screen.getByRole("button", { name: "下移：第一章" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mockedSeries.getMine).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "移除：第一章" }));
    verification.resolve(savedDetail(["a3"], 5));
    await screen.findByText(/版本冲突：/);
    expect(screen.getByTestId("chapter-list").querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByTestId("chapter-list")).toHaveTextContent("第二章");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(mockedSeries.update).toHaveBeenCalledTimes(1);
  });

  it("keeps edits made after confirming a server reload", async () => {
    await loadPage();
    mockedSeries.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        code: "CONFLICT",
        detail: "conflict",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "下移：第一章" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText(/版本冲突：/);
    const reload = deferred<SeriesDetail>();
    mockedSeries.getMine.mockReturnValueOnce(reload.promise);
    fireEvent.click(screen.getByRole("button", { name: "载入服务端最新编排" }));
    fireEvent.click(screen.getByRole("button", { name: "确认载入" }));
    fireEvent.click(screen.getByRole("button", { name: "移除：第一章" }));
    reload.resolve(DETAIL);
    await screen.findByText(/读取期间又有修改/);
    expect(screen.getByTestId("chapter-list")).not.toHaveTextContent("第一章");
  });

  it("shows titles, real article states and ordinals instead of raw article ids", async () => {
    const list = await loadPage();
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("第一章");
    expect(rows[0]).toHaveTextContent("已发布");
    expect(rows[0]).toHaveTextContent("01");
    expect(rows[1]).toHaveTextContent("第二章");
    expect(rows[1]).toHaveTextContent("审核中");
    expect(rows[1]).toHaveTextContent("02");

    // Raw ids stay out of the creator-facing row.
    expect(within(list).queryByText("a1")).toBeNull();

    const picker = screen.getByTestId("article-picker");
    expect(within(picker).getByText("还没公开的草稿")).toBeInTheDocument();
    expect(within(picker).getByText("草稿")).toBeInTheDocument();
    expect(within(picker).getByText("被治理隐藏的文章")).toBeInTheDocument();
    expect(within(picker).getByText("已隐藏")).toBeInTheDocument();
    expect(within(picker).getByText(/草稿和审核中的文章可以先编排/)).toBeInTheDocument();
  });

  it("marks a chapter whose article is no longer in the owner list as unavailable", async () => {
    const detail = {
      ...DETAIL,
      chapters: [{ id: "ch-9", articleId: "a9", title: null, position: 1 }],
    };
    const list = await loadPage(detail);
    expect(within(list).getByText("无标题文章")).toBeInTheDocument();
    expect(within(list).getByText("文章不可用")).toBeInTheDocument();
    expect(within(list).getByText(/移入回收站/)).toBeInTheDocument();
  });

  it("does not send a save request when nothing changed", async () => {
    await loadPage();
    const save = screen.getByRole("button", { name: "保存" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(mockedSeries.update).not.toHaveBeenCalled();
  });

  it("reorders with the up/down fallback, saves the final id order, and re-reads it", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "上移：第二章" }));
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("第二章");

    mockedSeries.update.mockResolvedValue(savedDetail(["a2", "a1"]));
    mockedSeries.getMine.mockResolvedValueOnce(savedDetail(["a2", "a1"]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockedSeries.update).toHaveBeenCalledWith("ser-1", {
        chapterArticleIds: ["a2", "a1"],
        lockVersion: 3,
      });
    });
    expect(await screen.findByText("已保存。")).toBeInTheDocument();
    expect(mockedSeries.getMine).toHaveBeenCalledTimes(2);
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("第二章");
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("removes a chapter locally, explains that the article survives, and can undo", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));

    expect(within(list).queryByText("第一章")).toBeNull();
    expect(screen.getByText(/只解除关联，文章没有被删除/)).toBeInTheDocument();
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    // The article is still in the picker, so removing a relation did not delete it.
    expect(screen.getByRole("button", { name: "添加：第一章" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(within(list).getByText("第一章")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("saves a removal as the replacement list without touching the article", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));

    mockedSeries.update.mockResolvedValue(savedDetail(["a2"]));
    mockedSeries.getMine.mockResolvedValueOnce(savedDetail(["a2"]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockedSeries.update).toHaveBeenCalledWith("ser-1", {
        chapterArticleIds: ["a2"],
        lockVersion: 3,
      });
    });
    await screen.findByText("已保存。");
    expect(screen.getByRole("button", { name: "添加：第一章" })).toBeEnabled();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("prevents duplicate articles and supports adding several in a row", async () => {
    const list = await loadPage();
    expect(screen.getByRole("button", { name: "已添加：第一章" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "添加：可以添加的文章" }));
    expect(screen.getByRole("button", { name: "已添加：可以添加的文章" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "添加：还没公开的草稿" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(
      within(list)
        .getAllByRole("listitem")
        .filter((row) => row.textContent?.includes("可以添加的文章")),
    ).toHaveLength(1);

    mockedSeries.update.mockResolvedValue(savedDetail(["a1", "a2", "a3", "a4"]));
    mockedSeries.getMine.mockResolvedValueOnce(savedDetail(["a1", "a2", "a3", "a4"]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mockedSeries.update).toHaveBeenCalledWith("ser-1", {
        chapterArticleIds: ["a1", "a2", "a3", "a4"],
        lockVersion: 3,
      });
    });
  });

  it("searches the picker by title and distinguishes matches from the rest", async () => {
    await loadPage();
    const picker = screen.getByTestId("article-picker");
    fireEvent.change(within(picker).getByLabelText("搜索我的文章"), {
      target: { value: "可以" },
    });
    expect(
      within(picker).getByRole("button", { name: "添加：可以添加的文章" }),
    ).toBeInTheDocument();
    expect(within(picker).queryByText("还没公开的草稿")).toBeNull();

    fireEvent.change(within(picker).getByLabelText("搜索我的文章"), {
      target: { value: "不存在" },
    });
    expect(within(picker).getByText("没有匹配「不存在」的文章。")).toBeInTheDocument();
  });

  it("saves an empty list to clear the series without deleting articles", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));
    fireEvent.click(within(list).getByRole("button", { name: "移除：第二章" }));
    expect(screen.getByText("还没有收录章节")).toBeInTheDocument();

    mockedSeries.update.mockResolvedValue(savedDetail([]));
    mockedSeries.getMine.mockResolvedValueOnce(savedDetail([]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mockedSeries.update).toHaveBeenCalledWith("ser-1", {
        chapterArticleIds: [],
        lockVersion: 3,
      });
    });
    await screen.findByText("已保存。");
    expect(screen.getByRole("button", { name: "添加：第一章" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加：第二章" })).toBeEnabled();
  });

  it("keeps local edits and reports the error when saving fails", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));
    mockedSeries.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求参数无效",
        status: 400,
        detail: "chapterArticleIds: 章节文章不存在或不属于当前用户",
        code: "VALIDATION_FAILED",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "chapterArticleIds: 章节文章不存在或不属于当前用户",
    );
    expect(within(list).queryByText("第一章")).toBeNull();
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    expect(screen.getByText("保存失败")).toBeInTheDocument();
  });

  it("does not overwrite edits made while the save request is in flight", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "上移：第二章" }));

    const pending = deferred<SeriesDetail>();
    mockedSeries.update.mockReturnValue(pending.promise);
    mockedSeries.getMine.mockResolvedValueOnce(savedDetail(["a2", "a1"]));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();

    // A new local edit lands while the old request is still open.
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));
    pending.resolve(savedDetail(["a2", "a1"]));

    expect(
      await screen.findByText("已保存上一版编排；保存期间的修改尚未提交。"),
    ).toBeInTheDocument();
    expect(within(list).queryByText("第一章")).toBeNull();
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
  });

  it("handles 409 by keeping local work and only reloading after an explicit confirm", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "上移：第二章" }));
    mockedSeries.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求冲突",
        status: 409,
        detail: "系列已被他人更新",
        code: "CONFLICT",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("版本冲突");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("第二章");

    fireEvent.click(screen.getByRole("button", { name: "载入服务端最新编排" }));
    expect(await screen.findByRole("group", { name: "确认载入服务端版本" })).toHaveTextContent(
      "覆盖你当前未保存的章节顺序",
    );

    mockedSeries.getMine.mockResolvedValueOnce(DETAIL);
    fireEvent.click(screen.getByRole("button", { name: "确认载入" }));
    expect(await screen.findByText("已载入服务端最新编排。")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("第一章");
    // Local work was only dropped after that explicit confirmation; no silent
    // retry with the new lockVersion.
    expect(mockedSeries.update).toHaveBeenCalledTimes(1);
  });

  it("asks before leaving with an unsaved arrangement", async () => {
    const list = await loadPage();
    fireEvent.click(within(list).getByRole("button", { name: "移除：第一章" }));
    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));

    const dialog = await screen.findByRole("alertdialog", { name: "有未保存的章节编排" });
    expect(dialog).toHaveTextContent("放弃修改并离开");
    fireEvent.click(screen.getByRole("button", { name: "留在本页" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(within(list).queryByText("第一章")).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));
    await screen.findByRole("alertdialog", { name: "有未保存的章节编排" });
    fireEvent.click(screen.getByRole("button", { name: "放弃修改并离开" }));
    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
  });
});
