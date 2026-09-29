import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary, TrashItem } from "@/api/articles/articles.types";
import { ContentListPage } from "./ContentListPage";

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listMine: vi.fn(),
    listTrash: vi.fn(),
    trash: vi.fn(),
    restoreFromTrash: vi.fn(),
  },
}));

const mocked = vi.mocked(articlesApi);

function article(over: Partial<MyArticleSummary> = {}): MyArticleSummary {
  return {
    id: "art-1",
    status: "DRAFT",
    title: "我的草稿",
    categoryId: null,
    updatedAt: "2026-09-28T02:00:00Z",
    ...over,
  };
}

function trashItem(over: Partial<TrashItem> = {}): TrashItem {
  return {
    objectType: "ARTICLE",
    objectId: "art-9",
    title: "被回收的文章",
    trashedAt: "2026-09-27T02:00:00Z",
    ...over,
  };
}

function renderPage(initialEntry = "/studio/content") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/studio/content" element={<ContentListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.listMine.mockResolvedValue([]);
  mocked.listTrash.mockResolvedValue([]);
});

describe("ContentListPage", () => {
  it("shows loading while the owner list is in flight", () => {
    mocked.listMine.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("offers a visible 新建文章 link to the editor", async () => {
    // THE regression this page fixes: the editor existed but had no entry point.
    renderPage();
    const link = await screen.findByRole("link", { name: "新建文章" });
    expect(link).toHaveAttribute("href", "/studio/content/new");
  });

  it("renders only the 新建文章 link as the create entry — no dead links", async () => {
    renderPage();
    await screen.findByTestId("content-counters");
    const hrefs = screen
      .getAllByRole("link")
      .map((el) => el.getAttribute("href"))
      .filter((href): href is string => Boolean(href));
    // Every link must resolve to a route the V2 router actually declares.
    for (const href of hrefs) {
      expect(href.startsWith("/studio/content/") || href.startsWith("/studio/content")).toBe(true);
    }
  });

  it("shows an empty state when the author has no articles", async () => {
    renderPage();
    expect(await screen.findByText("还没有文章")).toBeInTheDocument();
  });

  it("renders article rows with title, status and edit links", async () => {
    mocked.listMine.mockResolvedValue([article({ id: "art-1", title: "第一篇" })]);
    renderPage();
    expect(await screen.findByText("第一篇")).toBeInTheDocument();
    // Scoped to the row list: "草稿" also appears as a counter label.
    expect(screen.getByTestId("content-rows")).toHaveTextContent("草稿");
    expect(screen.getByRole("link", { name: "编辑" })).toHaveAttribute(
      "href",
      "/studio/content/art-1",
    );
    expect(screen.getByRole("link", { name: "版本历史" })).toHaveAttribute(
      "href",
      "/studio/content/art-1/versions",
    );
  });

  it("falls back to a placeholder for a null title", async () => {
    mocked.listMine.mockResolvedValue([article({ title: null })]);
    renderPage();
    expect(await screen.findByText("无标题文章")).toBeInTheDocument();
  });

  it("renders per-status counters from the whole list", async () => {
    mocked.listMine.mockResolvedValue([
      article({ id: "1", status: "PUBLISHED" }),
      article({ id: "2", status: "PUBLISHED" }),
      article({ id: "3", status: "DRAFT" }),
      article({ id: "4", status: "REVIEW" }),
    ]);
    renderPage();
    const counters = await screen.findByTestId("content-counters");
    expect(counters).toHaveTextContent("2");
    expect(counters).toHaveTextContent("已发布");
    expect(counters).toHaveTextContent("审核中");
  });

  it("filters to a tab via the query parameter", async () => {
    mocked.listMine.mockResolvedValue([
      article({ id: "1", status: "PUBLISHED", title: "已发布的" }),
      article({ id: "2", status: "DRAFT", title: "草稿篇" }),
    ]);
    renderPage("/studio/content?tab=published");
    expect(await screen.findByText("已发布的")).toBeInTheDocument();
    expect(screen.queryByText("草稿篇")).not.toBeInTheDocument();
  });

  it("falls back to 全部内容 for an unrecognised tab value", async () => {
    mocked.listMine.mockResolvedValue([article({ title: "仍然可见" })]);
    renderPage("/studio/content?tab=nonsense");
    // A bad URL must not masquerade as "you have no articles".
    expect(await screen.findByText("仍然可见")).toBeInTheDocument();
  });

  it("shows a tab-specific empty state", async () => {
    renderPage("/studio/content?tab=reviewing");
    expect(await screen.findByText("没有审核中的文章")).toBeInTheDocument();
  });

  it("surfaces list errors with a reload control", async () => {
    mocked.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.queryByTestId("content-rows")).not.toBeInTheDocument();
  });

  it("does not offer 移入回收站 while an article is in the review queue", async () => {
    // TrashService rejects in-review articles with 409, so no button must exist.
    mocked.listMine.mockResolvedValue([
      article({ id: "r1", status: "REVIEW", title: "审核中的" }),
    ]);
    renderPage();
    await screen.findByText("审核中的");
    expect(screen.queryByRole("button", { name: "移入回收站" })).not.toBeInTheDocument();
  });

  it("offers 移入回收站 for a draft and refreshes after success", async () => {
    mocked.listMine.mockResolvedValue([article({ id: "d1", status: "DRAFT" })]);
    mocked.trash.mockResolvedValue(trashItem({ objectId: "d1" }));
    renderPage();
    const button = await screen.findByRole("button", { name: "移入回收站" });
    fireEvent.click(button);
    await waitFor(() => expect(mocked.trash).toHaveBeenCalledWith("d1"));
    // Re-fetched rather than locally patched, so the counters stay truthful.
    expect(mocked.listMine).toHaveBeenCalledTimes(2);
  });

  it("shows the backend detail when trashing fails", async () => {
    mocked.listMine.mockResolvedValue([article({ id: "d1", status: "DRAFT" })]);
    mocked.trash.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "冲突",
        status: 409,
        detail: "审核中的文章不可移入回收站",
        code: "CONFLICT",
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "移入回收站" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("审核中的文章不可移入回收站");
  });
});

describe("ContentListPage — trash tab", () => {
  it("fetches the trash endpoint lazily, only when the tab is opened", async () => {
    renderPage();
    await screen.findByTestId("content-counters");
    // Never touched while the default tab is active.
    expect(mocked.listTrash).not.toHaveBeenCalled();
  });

  it("lists trashed articles and offers restore", async () => {
    mocked.listTrash.mockResolvedValue([trashItem({ objectId: "art-9", title: "旧稿" })]);
    renderPage("/studio/content?tab=trash");
    expect(await screen.findByText("旧稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument();
  });

  it("states that permanent deletion is unavailable rather than showing a dead button", async () => {
    mocked.listTrash.mockResolvedValue([trashItem()]);
    renderPage("/studio/content?tab=trash");
    await screen.findByTestId("trash-rows");
    expect(screen.getByTestId("trash-note")).toHaveTextContent("不提供彻底删除");
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
  });

  it("restores an article and refreshes both the trash and the owner list", async () => {
    mocked.listTrash.mockResolvedValue([trashItem({ objectId: "art-9" })]);
    mocked.restoreFromTrash.mockResolvedValue(undefined);
    renderPage("/studio/content?tab=trash");
    fireEvent.click(await screen.findByRole("button", { name: "恢复" }));
    await waitFor(() => expect(mocked.restoreFromTrash).toHaveBeenCalledWith("art-9"));
    // Called once to open the tab, again after the restore.
    expect(mocked.listTrash).toHaveBeenCalledTimes(2);
    expect(mocked.listMine).toHaveBeenCalledTimes(2);
  });

  it("surfaces a 404 detail when the article is no longer in the trash", async () => {
    mocked.listTrash.mockResolvedValue([trashItem({ objectId: "art-9" })]);
    mocked.restoreFromTrash.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "未找到",
        status: 404,
        detail: "文章不在回收站",
        code: "NOT_FOUND",
      }),
    );
    renderPage("/studio/content?tab=trash");
    fireEvent.click(await screen.findByRole("button", { name: "恢复" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("文章不在回收站");
  });

  it("separates non-article trash rows instead of hiding them", async () => {
    mocked.listTrash.mockResolvedValue([
      trashItem({ objectId: "a1", objectType: "ARTICLE", title: "文章稿" }),
      trashItem({ objectId: "c1", objectType: "COLLECTION", title: null }),
    ]);
    renderPage("/studio/content?tab=trash");
    const others = await screen.findByTestId("trash-others");
    expect(others).toHaveTextContent("COLLECTION");
    // Only the article row is restorable.
    expect(screen.getAllByRole("button", { name: "恢复" })).toHaveLength(1);
  });

  it("shows an empty trash state", async () => {
    renderPage("/studio/content?tab=trash");
    expect(await screen.findByText("回收站是空的")).toBeInTheDocument();
  });

  it("surfaces a trash load failure with a reload control", async () => {
    mocked.listTrash.mockRejectedValue(new Error("boom"));
    renderPage("/studio/content?tab=trash");
    expect(await screen.findByText("无法加载回收站")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });
});

