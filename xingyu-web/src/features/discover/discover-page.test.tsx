import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import { topicsApi } from "@/api/topics/topics.api";
import { momentsApi } from "@/api/moments/moments.api";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { articlesApi } from "@/api/articles/articles.api";
import type { ContentSummary } from "@/api/common.types";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { DiscoverPage } from "./pages/DiscoverPage";

/*
 * Page-level contracts for /discover.
 *
 * The page is a sidebar of real filters plus the server's feed rendered as a
 * single reading list, in the order the server returned it. Interaction details
 * (switching filters, pagination, stale responses) belong to
 * discover-filters.test.tsx; this file keeps the page honest about loading,
 * topics, feed order and the loading / empty / error states.
 */

vi.mock("@/api/discover/discover.api", () => ({ discoverApi: { getDiscover: vi.fn() } }));
vi.mock("@/api/topics/topics.api", () => ({ topicsApi: { getTopics: vi.fn() } }));
vi.mock("@/api/moments/moments.api", () => ({ momentsApi: { getById: vi.fn() } }));
vi.mock("@/api/articles/articles.api", () => ({ articlesApi: { getArticle: vi.fn() } }));
vi.mock("@/api/interactions/interactions.api", () => ({
  interactionsApi: { getComments: vi.fn(), getCommentPreview: vi.fn() },
}));
vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true, username: "me_user" })),
  },
}));

const discover = vi.mocked(discoverApi.getDiscover);
const topics = vi.mocked(topicsApi.getTopics);
const getMoment = vi.mocked(momentsApi.getById);
const getComments = vi.mocked(interactionsApi.getComments);
const getArticle = vi.mocked(articlesApi.getArticle);

const article = (
  id: string,
  title: string,
  extra: Partial<ContentSummary> = {},
): ContentSummary => ({ id, title, objectType: "ARTICLE", ...extra });

function feed(...items: ContentSummary[]) {
  return { items, nextCursor: null };
}

function renderPage(url = "/discover") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider>
        <DiscoverPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  topics.mockResolvedValue([]);
  discover.mockResolvedValue(feed());
  getComments.mockResolvedValue([]);
});

describe("discover page", () => {
  it("shows the loading state while the feed is pending", () => {
    discover.mockReturnValue(new Promise(() => {}));
    topics.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    expect(discover).toHaveBeenCalledWith({ limit: 20 });
  });

  it("loads the feed through the discover API and renders it under the masthead", async () => {
    discover.mockResolvedValue(feed(article("c1", "真实发现内容")));

    renderPage();

    expect(await screen.findByText("真实发现内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /真实发现内容/ }).querySelector("img")).toBeNull();
    expect(discover).toHaveBeenCalledWith({ limit: 20 });
    expect(topics).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "发现", level: 1 })).toBeInTheDocument();
    const sections = screen.getByRole("navigation", { name: "发现" });
    expect(within(sections).getByRole("link", { name: "推荐" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(within(sections).getByRole("link", { name: "文章" })).toHaveAttribute(
      "href",
      "/discover?type=ARTICLE",
    );
    expect(within(sections).getByRole("link", { name: "系列" })).toHaveAttribute("href", "/series");
    expect(within(sections).getByRole("link", { name: "话题" })).toHaveAttribute("href", "/topics");
    expect(within(sections).getByRole("link", { name: "创作者" })).toHaveAttribute(
      "href",
      "/creators",
    );
  });

  it("renders every real topic as a filter button, including one with no content", async () => {
    topics.mockResolvedValue([
      { id: "t-design", slug: "design", name: "设计", contentCount: 3 },
      { id: "t-empty", slug: "zero", name: "空话题", contentCount: 0 },
      { id: "t-ai", slug: "ai", name: "AI", contentCount: 1 },
    ]);
    discover.mockResolvedValue(feed(article("c1", "初始列表内容")));

    renderPage();

    const allTopics = screen.getByRole("button", { name: "全部话题" });
    expect(allTopics).toHaveAttribute("aria-pressed", "true");
    const emptyTopic = await screen.findByRole("button", { name: /空话题/ });
    expect(emptyTopic).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /设计/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI/ })).toBeInTheDocument();
    // Topics are filters now, not editorial navigation links, and they do not
    // disappear because their content count is zero.
    expect(screen.queryByRole("link", { name: /空话题/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(await screen.findByText("初始列表内容")).toBeInTheDocument();

    discover.mockResolvedValue(feed(article("c2", "空话题内容")));
    fireEvent.click(emptyTopic);

    await waitFor(() => expect(discover).toHaveBeenLastCalledWith({ limit: 20, topic: "zero" }));
    expect(emptyTopic).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("空话题内容")).toBeInTheDocument();
  });

  it("keeps the server feed order and does not promote or regroup featured items", async () => {
    /*
     * Deliberately neither title order nor creation order. The page must render
     * `items` as delivered; picking featured rows out to build an editorial
     * block would reorder this fixture and is the regression this guards against.
     */
    discover.mockResolvedValue(
      feed(
        article("c3", "丙内容"),
        article("c1", "甲内容", { featured: true }),
        { id: "s2", title: "乙内容", objectType: "SERIES", featured: true },
        article("c2", "丁内容"),
      ),
    );

    renderPage();

    const titles = [
      await screen.findByText("丙内容"),
      screen.getByText("甲内容"),
      screen.getByText("乙内容"),
      screen.getByText("丁内容"),
    ];
    for (let index = 0; index < titles.length - 1; index += 1) {
      expect(
        titles[index].compareDocumentPosition(titles[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByRole("heading", { name: "更多内容" })).not.toBeInTheDocument();
  });

  it("shows the empty state when the feed has no content", async () => {
    discover.mockResolvedValue(feed());

    renderPage();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("社区还在生长中")).toBeInTheDocument();
  });

  it("shows the error state when the feed fails and recovers on retry", async () => {
    discover.mockRejectedValueOnce(new Error("boom"));

    renderPage();

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.queryByText("恢复后的内容")).not.toBeInTheDocument();

    discover.mockResolvedValueOnce(feed(article("c1", "恢复后的内容")));
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("恢复后的内容")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });

  it("keeps the feed visible and says so when topics fail", async () => {
    topics.mockRejectedValue(new Error("offline"));
    discover.mockResolvedValue(feed(article("c1", "内容仍然可见")));

    renderPage();

    expect(await screen.findByText("内容仍然可见")).toBeInTheDocument();
    expect(screen.getByText("话题暂时无法加载。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部话题" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a MOMENT as 动态 and expands its own body and comment object type", async () => {
    setStoredToken("tok");
    discover.mockResolvedValue(
      feed({
        id: "m1",
        title: "一条动态",
        objectType: "MOMENT",
        authorName: "林深",
        summary: "动态摘要",
      }),
    );
    getMoment.mockResolvedValue({
      id: "m1",
      body: "这是动态正文。",
      authorId: "u1",
      authorUsername: "lin",
      authorDisplayName: "林深",
      createdAt: "2026-10-30T00:00:00Z",
      likeCount: 2,
      commentCount: 1,
      liked: false,
    });

    renderPage();

    const title = await screen.findByText("一条动态");
    expect(within(title.closest("li")!).getByText("动态")).toBeInTheDocument();

    fireEvent.click(title);

    expect(await screen.findByText("这是动态正文。")).toBeInTheDocument();
    await waitFor(() => expect(getMoment).toHaveBeenCalledWith("m1"));
    expect(getComments).toHaveBeenCalledWith("MOMENT", "m1");
    expect(getArticle).not.toHaveBeenCalled();
  });

  it("lays the page out as a borderless reading list", async () => {
    discover.mockResolvedValue(
      feed(
        article("c1", "版式文章", {
          summary: "一行摘要",
          authorName: "林深",
          cover: "/cover.jpg",
          likeCount: 3,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "发现", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("顺着话题，把下一篇想读完的文章找出来。")).toBeInTheDocument();
    const page = document.querySelector(".bg-white");
    expect(page?.className).toContain("bg-white");
    expect(page?.className).toContain("max-w-[1200px]");
    expect(page?.className).toContain("text-slate-900");
    const nav = screen.getByRole("navigation", { name: "发现" });
    expect(nav.parentElement?.className).toContain("mt-8");
    expect(nav.closest("[class*='grid-cols']")).toBeNull();
    const layout = document.querySelector(".discover-layout");
    expect(layout?.contains(nav)).toBe(false);
    expect(nav.compareDocumentPosition(layout!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const heading = screen.getByRole("heading", { name: "发现", level: 1 });
    expect(heading.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(layout?.className).toContain("md:grid-cols-12");
    expect(layout?.className).toContain("gap-8");
    expect(layout?.querySelector("aside")?.className).toContain("md:col-span-3");
    expect(document.querySelector("[aria-label='发现内容']")?.className).toContain("md:col-span-9");
    const hero = document.querySelector("header");
    expect(hero?.className).toContain("pt-8");
    expect(hero?.className).toContain("pb-6");
    expect(hero?.className).not.toContain("from-sky");
    expect(hero?.className).not.toContain("border-b");
    expect(heading.className).toContain("text-3xl");
    expect(heading.className).toContain("font-bold");

    const selectedTab = screen.getByRole("link", { name: "推荐" });
    expect(selectedTab.className).toContain("bg-blue-50");
    expect(selectedTab.className).toContain("text-blue-600");
    expect(selectedTab.className).not.toContain("border-b-2");
    expect(screen.getByRole("link", { name: "文章" }).className).not.toContain("bg-blue-50");

    const sidebar = screen.getByRole("complementary", { name: "探索筛选" });
    expect(sidebar.className).toContain("overflow-visible");
    expect(sidebar.className).not.toContain("overflow-y-auto");
    expect(screen.getByRole("textbox", { name: "搜索话题" }).className).toContain("bg-slate-100");
    expect(screen.getByRole("textbox", { name: "搜索话题" }).className).toContain("rounded-lg");
    expect(screen.getByRole("button", { name: "全部话题" }).className).toContain("text-blue-600");

    const row = screen.getByRole("button", { name: /版式文章/ });
    expect(row.className).toContain("hover:bg-slate-50");
    expect(row.className).toContain("cursor-pointer");
    expect(row.className).not.toContain("border");
    const cover = row.querySelector("img");
    expect(cover?.className).toContain("w-[180px]");
    expect(cover?.className).toContain("h-[120px]");
    expect(cover?.className).toContain("rounded-lg");
    expect(cover?.className).toContain("object-cover");
    expect(screen.queryByRole("link", { name: /阅读全文/ })).not.toBeInTheDocument();
    expect(within(row).getByText("3 赞")).toBeInTheDocument();
  });
});
