import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ContentSummary } from "@/api/common.types";
import { DiscoverListItem } from "./DiscoverListItem";

const mocks = vi.hoisted(() => ({
  signedIn: false,
  detail: vi.fn(),
  article: vi.fn(),
  comments: vi.fn(),
  preview: vi.fn(),
}));
vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: mocks.signedIn }),
}));
vi.mock("@/api/articles/articles.api", () => ({ articlesApi: { getArticle: mocks.article } }));
vi.mock("@/api/series/series.api", () => ({ seriesApi: { getPublicById: mocks.detail } }));
vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: { getComments: mocks.comments, getCommentPreview: mocks.preview },
}));
const comments = Array.from({ length: 4 }, (_, index) => ({
  id: String(index),
  authorUsername: "评论者",
  body: `真实评论 ${index + 1}`,
  createdAt: "2026-10-15T08:00:00Z",
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.signedIn = false;
  mocks.detail.mockResolvedValue({ chapters: [{ articleId: "a", title: "真实章节" }] });
  mocks.article.mockImplementation(async (id: string) => ({
    id,
    title: `文章 ${id}`,
    body: `## 标题 ${id}\n\n正文 ${id}`,
  }));
  mocks.comments.mockRejectedValue(new Error("Unauthorized"));
  mocks.preview.mockResolvedValue(comments.slice(0, 3));
});
function Row({ item }: { item: ContentSummary }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <DiscoverListItem
      item={item}
      variant={expanded ? "expanded" : "normal"}
      onToggleExpand={() => setExpanded((value) => !value)}
    />
  );
}
function expand(summary?: string) {
  const view = render(
    <MemoryRouter>
      <Row item={{ id: "s", title: "测试系列", objectType: "SERIES", commentCount: 4, summary }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("测试系列"));
  return view;
}

/*
 * The chapter switcher is a non-modal Radix DropdownMenu rather than a Radix
 * Select: Select locks document scroll while open, which dropped the page
 * scrollbar. The trigger is a button labelled by the "切换章节" span and the
 * options are menuitemradio elements.
 */
async function selectChapter(name: string) {
  const trigger = await screen.findByRole("button", { name: "切换章节" });
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  });
  const option = await screen.findByRole("menuitemradio", { name });
  await act(async () => {
    fireEvent.click(option);
  });
}
it("reading panel keeps body and directory landmarks without redundant visible labels", async () => {
  expand();
  expect(await screen.findByText("正文 a")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "正文预览" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "章节目录" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "正文" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "目录" })).not.toBeInTheDocument();
});
it("chapter loading keeps the same reading viewport and resets only its own scroll", async () => {
  mocks.detail.mockResolvedValue({
    chapters: [
      { articleId: "a", title: "第一章" },
      { articleId: "b", title: "第二章" },
    ],
  });
  expand();
  const firstBody = await screen.findByText("正文 a");
  const viewport = firstBody.closest<HTMLDivElement>("[data-reading-viewport]")!;
  const region = screen.getByRole("region", { name: "正文预览" });
  const comment = screen.getByText("真实评论 1");
  viewport.scrollTop = 160;
  let resolveNext!: (value: unknown) => void;
  mocks.article.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveNext = resolve;
    }),
  );
  await selectChapter("2. 第二章");
  expect(screen.getByText("章节加载中...")).toBeInTheDocument();
  expect(region.querySelector("[data-reading-viewport]")).toBe(viewport);
  expect(viewport.scrollTop).toBe(0);
  expect(screen.getByText("真实评论 1")).toBe(comment);
  await act(async () => {
    resolveNext({ id: "b", body: "第二章正文" });
  });
  expect(screen.getByText("第二章正文").closest("[data-reading-viewport]")).toBe(viewport);
  expect(screen.getByText("真实评论 1")).toBe(comment);
});
it("series opens the first chapter body and switches chapters from its directory", async () => {
  mocks.detail.mockResolvedValue({
    chapters: [
      { articleId: "a", title: "第一章" },
      { articleId: "b", title: "第二章" },
    ],
  });
  expand();
  expect(await screen.findByText("正文 a")).toBeInTheDocument();
  const directory = screen.getByRole("navigation", { name: "章节目录" });
  expect(within(directory).getByRole("button", { name: "切换章节" })).toHaveTextContent(
    "1. 第一章",
  );
  await selectChapter("2. 第二章");
  expect(await screen.findByText("正文 b")).toBeInTheDocument();
  expect(screen.queryByText("正文 a")).not.toBeInTheDocument();
  expect(within(directory).getByRole("button", { name: "切换章节" })).toHaveTextContent(
    "2. 第二章",
  );
  expect(screen.getByText("真实评论 1")).toBeInTheDocument();
});
it("articles render their full Markdown body with working heading links and comments below", async () => {
  mocks.article.mockResolvedValue({
    id: "article",
    body: `## 开始\n\n${"完整正文".repeat(150)}\n\n## 结尾\n\n最后一段`,
  });
  render(
    <MemoryRouter>
      <Row item={{ id: "article", title: "文章预览", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("文章预览"));
  expect(await screen.findByText("最后一段")).toBeInTheDocument();
  const directory = screen.getByRole("navigation", { name: "文章目录" });
  const link = within(directory).getByRole("link", { name: "结尾" });
  const heading = screen.getByRole("heading", { name: "结尾" });
  expect(link).toHaveAttribute("href", `#${heading.id}`);
  const viewport = screen.getByText("最后一段").closest<HTMLDivElement>("[data-reading-viewport]")!;
  viewport.scrollTop = 100;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 200, 500, 400));
  vi.spyOn(heading, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 650, 500, 30));
  const scroll = vi.fn();
  viewport.scrollTo = scroll;
  const pageScroll = vi.spyOn(heading, "scrollIntoView");
  fireEvent.click(link);
  expect(scroll).toHaveBeenCalledWith({ top: 534, behavior: "smooth" });
  expect(pageScroll).not.toHaveBeenCalled();
  const comments = screen.getByText("真实评论 1");
  expect(
    directory.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it("keeps a collapsed row's own detail link and drops it once the row is the reading row", async () => {
  render(
    <MemoryRouter>
      <Row item={{ id: "series", title: "折叠入口", objectType: "SERIES" }} />
    </MemoryRouter>,
  );
  const folded = screen.getByRole("link", { name: "阅读全文：折叠入口" });
  expect(folded).toHaveAttribute("href", "/series/series");
  fireEvent.click(screen.getByText("折叠入口"));
  await screen.findByText("正文 a");
  expect(screen.queryByRole("link", { name: /^阅读全文：/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute("href", "/series/series");
});

it("renders one unchanged detail link after the reading body and before comments in the reader grid", async () => {
  render(
    <MemoryRouter>
      <Row item={{ id: "article", title: "详情位置", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("详情位置"));
  await screen.findByText("正文 article");
  const links = screen.getAllByRole("link", { name: "查看详情" });
  expect(links).toHaveLength(1);
  const detail = links[0];
  expect(detail).toHaveAttribute("href", "/articles/article");
  expect(document.querySelector(".discover-reader")).toContainElement(detail);
  const body = screen.getByRole("region", { name: "正文预览" });
  const commentsRegion = screen.getByRole("region", { name: "评论预览" });
  expect(body.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(
    detail.compareDocumentPosition(commentsRegion) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("keeps the same focused detail link while the article body finishes loading", async () => {
  let resolveArticle!: (value: unknown) => void;
  mocks.article.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveArticle = resolve;
    }),
  );
  render(
    <MemoryRouter>
      <Row item={{ id: "article", title: "加载时的详情入口", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("加载时的详情入口"));
  const detail = screen.getByRole("link", { name: "查看详情" });
  expect(detail).toHaveAttribute("href", "/articles/article");
  detail.focus();
  await act(async () => {
    resolveArticle({ id: "article", body: "异步正文", seriesContexts: [] });
  });
  expect(await screen.findByText("异步正文")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看详情" })).toBe(detail);
  expect(detail).toHaveFocus();
});

it("retries article failures without hiding comments or the detail link", async () => {
  mocks.article.mockRejectedValueOnce(new Error("offline"));
  render(
    <MemoryRouter>
      <Row item={{ id: "article", title: "重试文章", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("重试文章"));
  expect(await screen.findByText("加载内容失败")).toBeInTheDocument();
  expect(await screen.findByText("真实评论 1")).toBeInTheDocument();
  const detail = screen.getByRole("link", { name: "查看详情" });
  expect(detail).toHaveAttribute("href", "/articles/article");
  fireEvent.click(screen.getByRole("button", { name: "重新加载正文" }));
  expect(await screen.findByText("正文 article")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看详情" })).toBe(detail);
});

it("keeps a collapse control available beside long mobile content and returns focus to the trigger", async () => {
  expand();
  await screen.findByText("正文 a");
  const collapse = screen.getByRole("button", { name: "收起阅读" });
  collapse.focus();
  fireEvent.click(collapse);
  expect(screen.getByRole("button", { name: /测试系列/ })).toHaveFocus();
  expect(screen.getByRole("button", { name: /测试系列/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("late article responses cannot overwrite a reopened article", async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.article.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  render(
    <MemoryRouter>
      <Row item={{ id: "article", title: "异步正文", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  const trigger = screen.getByRole("button", { name: /异步正文/ });
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(await screen.findByText("正文 article")).toBeInTheDocument();
  await act(async () => {
    resolveOld({ id: "article", body: "过期正文" });
  });
  expect(screen.queryByText("过期正文")).not.toBeInTheDocument();
  expect(screen.getByText("正文 article")).toBeInTheDocument();
});

it("uses immediate outline positioning when reduced motion is requested", async () => {
  const media = vi.spyOn(window, "matchMedia");
  const defaultMedia = window.matchMedia("all");
  media.mockImplementation((query) => ({
    ...defaultMedia,
    matches: query.includes("prefers-reduced-motion"),
  }));
  try {
    render(
      <MemoryRouter>
        <Row item={{ id: "article", title: "减少动画", objectType: "ARTICLE" }} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("减少动画"));
    await screen.findByText("正文 article");
    const viewport = document.querySelector<HTMLDivElement>("[data-reading-viewport]")!;
    viewport.scrollTo = vi.fn();
    fireEvent.click(screen.getByRole("link", { name: "标题 article" }));
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  } finally {
    media.mockRestore();
  }
});

it("mobile outline navigation uses the settled sticky toolbar height rather than its current page position", async () => {
  const defaultMedia = window.matchMedia("all");
  const media = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...defaultMedia,
    matches: query.includes("max-width: 1023px"),
  }));
  const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  try {
    render(
      <MemoryRouter>
        <Row item={{ id: "article", title: "手机目录", objectType: "ARTICLE" }} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("手机目录"));
    await screen.findByText("正文 article");
    const viewport = document.querySelector<HTMLDivElement>("[data-reading-viewport]")!;
    viewport.scrollTo = vi.fn();
    const toolbar = document.querySelector<HTMLElement>("[data-reading-toolbar]")!;
    toolbar.style.top = "76px";
    const toolbarRect = vi
      .spyOn(toolbar, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 300, 300, 60));
    const headingRect = vi
      .spyOn(screen.getByRole("heading", { name: "标题 article" }), "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 800, 300, 32));
    fireEvent.click(screen.getByRole("link", { name: "标题 article" }));
    expect(pageScroll).toHaveBeenCalledWith({ top: 648, behavior: "smooth" });
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    toolbarRect.mockRestore();
    headingRect.mockRestore();
  } finally {
    media.mockRestore();
    pageScroll.mockRestore();
  }
});

it("header reports real zero and positive counts without inventing missing counts", () => {
  const view = render(
    <MemoryRouter>
      <Row item={{ id: "a", title: "统计", likeCount: 0, commentCount: 0 }} />
    </MemoryRouter>,
  );
  expect(screen.getByText("0 赞")).toBeInTheDocument();
  expect(screen.getByText("0 评论")).toBeInTheDocument();
  view.rerender(
    <MemoryRouter>
      <Row item={{ id: "a", title: "统计", likeCount: 12, commentCount: 5 }} />
    </MemoryRouter>,
  );
  expect(screen.getByText("12 赞")).toBeInTheDocument();
  expect(screen.getByText("5 评论")).toBeInTheDocument();
  view.rerender(
    <MemoryRouter>
      <Row item={{ id: "a", title: "统计" }} />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/\d+ 赞/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\d+ 评论/)).not.toBeInTheDocument();
});
it("chapter failure leaves the directory and comments usable", async () => {
  mocks.article.mockRejectedValue(new Error("offline"));
  expand();
  expect(await screen.findByText("章节加载失败，请重试。")).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "章节目录" })).toBeInTheDocument();
  expect(screen.getByText("真实评论 1")).toBeInTheDocument();
});
it("late chapter responses cannot overwrite the selected chapter", async () => {
  let resolveFirst!: (value: unknown) => void;
  mocks.detail.mockResolvedValue({
    chapters: [
      { articleId: "a", title: "第一章" },
      { articleId: "b", title: "第二章" },
    ],
  });
  mocks.article.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFirst = resolve;
    }),
  );
  expand();
  await selectChapter("2. 第二章");
  expect(await screen.findByText("正文 b")).toBeInTheDocument();
  await act(async () => {
    resolveFirst({ id: "a", body: "旧章节正文" });
  });
  expect(screen.queryByText("旧章节正文")).not.toBeInTheDocument();
  expect(screen.getByText("正文 b")).toBeInTheDocument();
});
it("multiple expanded articles have distinct heading targets", async () => {
  mocks.article.mockResolvedValue({ body: "## 相同标题\n\n正文" });
  render(
    <MemoryRouter>
      <Row item={{ id: "one", title: "文章一", objectType: "ARTICLE" }} />
      <Row item={{ id: "two", title: "文章二", objectType: "ARTICLE" }} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("文章一"));
  fireEvent.click(screen.getByText("文章二"));
  await waitFor(() => expect(screen.getAllByRole("heading", { name: "相同标题" })).toHaveLength(2));
  const headings = screen.getAllByRole("heading", { name: "相同标题" });
  expect(headings[0].id).not.toBe(headings[1].id);
  const links = screen.getAllByRole("link", { name: "相同标题" });
  expect(links[0]).toHaveAttribute("href", `#${headings[0].id}`);
  expect(links[1]).toHaveAttribute("href", `#${headings[1].id}`);
});
it("expanded headers hide the summary and keep a sibling collapse button beside the article identity", async () => {
  const title = "长标题需要完整换行，收起按钮与文章身份信息彼此独立。".repeat(3);
  render(
    <MemoryRouter>
      <Row
        item={{
          id: "article",
          title,
          objectType: "ARTICLE",
          authorName: "测试作者",
          updatedAt: "2026-10-17T00:00:00Z",
          summary: "正常列表摘要",
          likeCount: 12,
          commentCount: 3,
          readMinutes: 5,
        }}
      />
    </MemoryRouter>,
  );
  const summary = screen.getByText("正常列表摘要").closest(".discover-summary")!;
  expect(summary).toHaveAttribute("aria-hidden", "false");
  fireEvent.click(screen.getByRole("heading", { name: title }));
  await screen.findByText("正文 article");
  expect(summary).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByText(/正在阅读/)).not.toBeInTheDocument();
  const header = screen.getByRole("heading", { name: title }).closest("[data-reading-toolbar]")!;
  const collapse = screen.getByRole("button", { name: "收起阅读" });
  expect(header).toContainElement(collapse);
  expect(header).toContainElement(screen.getByText("测试作者"));
  expect(header).toContainElement(screen.getByText("12 赞"));
  expect(header).toContainElement(screen.getByText("3 评论"));
  expect(header).toContainElement(screen.getByText("5 分钟"));
  expect(header.querySelector("time")).toHaveAttribute("dateTime", "2026-10-17T00:00:00Z");
  expect(document.querySelector("[data-discover-trigger]")).not.toContainElement(collapse);
  fireEvent.click(collapse);
  expect(summary).toHaveAttribute("aria-hidden", "false");
  expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
});

it("sizes the desktop reading limit from measured header geometry and releases it on collapse", async () => {
  expand();
  await screen.findByText("正文 a");
  const row = document.querySelector<HTMLElement>("[data-discover-variant]")!;
  const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]")!;
  const viewport = row.querySelector<HTMLElement>("[data-reading-viewport]")!;
  const triggerRect = vi
    .spyOn(trigger, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 100, 800, 96));
  const viewportRect = vi
    .spyOn(viewport, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 220, 600, 500));
  fireEvent.resize(window);
  expect(row.style.getPropertyValue("--discover-reading-top")).toBe("136px");
  viewportRect.mockReturnValue(new DOMRect(0, 252, 600, 468));
  fireEvent.resize(window);
  expect(row.style.getPropertyValue("--discover-reading-top")).toBe("168px");
  fireEvent.click(screen.getByRole("button", { name: "收起阅读" }));
  expect(row.style.getPropertyValue("--discover-reading-top")).toBe("");
  triggerRect.mockRestore();
  viewportRect.mockRestore();
});

it("expanding hides the list summary without a duplicate introduction card", async () => {
  expand("关于产品、写作与社区反馈的连续记录。");
  expect(await screen.findByRole("button", { name: "切换章节" })).toHaveTextContent("1. 真实章节");
  expect(screen.getAllByText("关于产品、写作与社区反馈的连续记录。")).toHaveLength(1);
  expect(
    screen.getByText("关于产品、写作与社区反馈的连续记录。").closest(".discover-summary"),
  ).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("heading", { name: "简介" })).not.toBeInTheDocument();
  expect(screen.getByText("真实评论 1")).toBeInTheDocument();
});
it("guests see three preview comments and a login link without requesting the full list", async () => {
  expand();
  expect(await screen.findByRole("button", { name: "切换章节" })).toHaveTextContent("1. 真实章节");
  expect(await screen.findByText("真实评论 1")).toBeInTheDocument();
  expect(screen.getByText("真实评论 3")).toBeInTheDocument();
  expect(screen.queryByText("真实评论 4")).not.toBeInTheDocument();
  expect(mocks.preview).toHaveBeenCalledWith("SERIES", "s");
  expect(mocks.comments).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "登录查看全部评论" })).toHaveAttribute("href", "/login");
});
it("comment failures do not hide successfully loaded content", async () => {
  mocks.signedIn = true;
  expand();
  expect(await screen.findByRole("button", { name: "切换章节" })).toHaveTextContent("1. 真实章节");
  expect(await screen.findByText("评论加载失败，请稍后重试。")).toBeInTheDocument();
  expect(mocks.preview).not.toHaveBeenCalled();
});
it("guests see comment errors rather than a misleading login restriction", async () => {
  mocks.preview.mockRejectedValue(new Error("Network error"));
  expand();
  expect(await screen.findByRole("alert")).toHaveTextContent("评论加载失败，请稍后重试。");
  expect(await screen.findByRole("button", { name: "切换章节" })).toHaveTextContent("1. 真实章节");
});
it("empty previews show an empty state", async () => {
  mocks.preview.mockResolvedValue([]);
  expand();
  expect(await screen.findByText("暂无评论")).toBeInTheDocument();
});
it("signing out replaces full comments with a preview", async () => {
  mocks.signedIn = true;
  mocks.comments.mockResolvedValue(comments);
  const view = expand();
  expect(await screen.findByText("还有 1 条评论...")).toBeInTheDocument();
  mocks.signedIn = false;
  view.rerender(
    <MemoryRouter>
      <Row item={{ id: "s", title: "测试系列", objectType: "SERIES", commentCount: 4 }} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith("SERIES", "s"));
  expect(await screen.findByRole("link", { name: "登录查看全部评论" })).toBeInTheDocument();
});
