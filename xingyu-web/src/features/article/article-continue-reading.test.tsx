import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { ContentSummary } from "@/api/common.types";
import { seriesApi } from "@/api/series/series.api";
import { topicsApi } from "@/api/topics/topics.api";
import { ArticleContinueReading } from "./components/ArticleContinueReading";

/*
 * 「继续阅读」— the exit at the end of an article.
 *
 * These tests pin the two things the walkthrough found missing: a series
 * chapter offers its neighbours, and an article outside a series offers other
 * articles from its topic. Both are silent-failure paths, so the failure cases
 * are tested as hard as the success ones — an addition to a page must never be
 * able to turn a successful read into an error state.
 */

vi.mock("@/api/series/series.api", () => ({
  seriesApi: { getPublicById: vi.fn() },
}));

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: { getTopicContent: vi.fn() },
}));

const mockedSeries = vi.mocked(seriesApi);
const mockedTopics = vi.mocked(topicsApi);

function article(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
  return {
    id: "a2",
    title: "第二章 星图的走向",
    summary: "摘要",
    body: "正文",
    slug: null,
    visibility: "PUBLIC",
    spaceSlug: "default",
    ownerUsername: "pxczxn",
    publishedAt: "2026-09-09T16:29:00Z",
    owner: false,
    seriesContexts: [],
    ...overrides,
  };
}

function topicItem(id: string, title: string, objectType = "ARTICLE"): ContentSummary {
  return { id, title, objectType };
}

function renderBlock(value: ArticleDetail) {
  return render(
    <MemoryRouter>
      <ArticleContinueReading article={value} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  /* Each case sets the two lookups it needs; clearing call history only keeps
     the "was this endpoint asked at all?" assertions honest. */
  vi.clearAllMocks();
});

describe("article continue-reading block", () => {
  it("links to the previous and next chapter of the series the article belongs to", async () => {
    mockedSeries.getPublicById.mockResolvedValue({
      id: "s1",
      title: "星图验收系列",
      slug: "starmap",
      description: null,
      status: "ACTIVE",
      lockVersion: 1,
      updatedAt: "2026-09-30T00:00:00Z",
      chapters: [
        { id: "c1", articleId: "a1", title: "第一章", position: 1 },
        { id: "c2", articleId: "a2", title: "第二章", position: 2 },
        { id: "c3", articleId: "a3", title: "第三章", position: 3 },
      ],
    } as never);

    renderBlock(
      article({
        seriesContexts: [{ id: "s1", slug: "starmap", title: "星图验收系列", position: 2 }],
      }),
    );

    expect(await screen.findByRole("link", { name: /第一章/ })).toHaveAttribute(
      "href",
      "/series/s1/read?chapter=a1",
    );
    expect(screen.getByRole("link", { name: /第三章/ })).toHaveAttribute(
      "href",
      "/series/s1/read?chapter=a3",
    );
    /* The reader stays inside the work: the series reader, not /articles/{id}. */
    expect(screen.queryByRole("link", { name: /第二章 星图的走向/ })).not.toBeInTheDocument();
  });

  it("offers only the next chapter for the first chapter of a series", async () => {
    mockedSeries.getPublicById.mockResolvedValue({
      id: "s1",
      title: "星图验收系列",
      slug: "starmap",
      description: null,
      status: "ACTIVE",
      lockVersion: 1,
      updatedAt: "2026-09-30T00:00:00Z",
      chapters: [
        { id: "c1", articleId: "a1", title: "第一章", position: 1 },
        { id: "c2", articleId: "a2", title: "第二章", position: 2 },
      ],
    } as never);

    renderBlock(
      article({
        id: "a1",
        seriesContexts: [{ id: "s1", slug: "starmap", title: "星图验收系列", position: 1 }],
      }),
    );

    expect(await screen.findByRole("link", { name: /第二章/ })).toBeInTheDocument();
    expect(screen.queryByText("上一章")).not.toBeInTheDocument();
    expect(screen.getByText("下一章")).toBeInTheDocument();
  });

  it("lists other articles from the first topic and skips the article being read", async () => {
    mockedTopics.getTopicContent.mockResolvedValue([
      topicItem("a2", "第二章 星图的走向"),
      topicItem("a9", "分层架构下的接口设计"),
      topicItem("a8", "如何用 Spring Boot 搭建可扩展的后端服务"),
      topicItem("s9", "某个系列", "SERIES"),
    ]);

    renderBlock(article({ topicSlugs: ["tech"] }));

    expect(await screen.findByRole("link", { name: /分层架构下的接口设计/ })).toHaveAttribute(
      "href",
      "/articles/a9",
    );
    expect(screen.getByRole("link", { name: /Spring Boot/ })).toHaveAttribute(
      "href",
      "/articles/a8",
    );
    /* Itself is never offered as "read next". */
    expect(screen.queryByRole("link", { name: /第二章 星图的走向/ })).not.toBeInTheDocument();
    /* A series hit is not an article row; the block only offers articles. */
    expect(screen.queryByRole("link", { name: /某个系列/ })).not.toBeInTheDocument();
    expect(mockedTopics.getTopicContent).toHaveBeenCalledWith("tech", "latest", 6);
  });

  it("still offers topic articles when the series lookup fails", async () => {
    mockedSeries.getPublicById.mockRejectedValue(new Error("boom"));
    mockedTopics.getTopicContent.mockResolvedValue([topicItem("a9", "分层架构下的接口设计")]);

    renderBlock(
      article({
        seriesContexts: [{ id: "s1", slug: "starmap", title: "系列", position: 1 }],
        topicSlugs: ["tech"],
      }),
    );

    expect(await screen.findByRole("link", { name: /分层架构下的接口设计/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never shows an error when every lookup fails, and keeps one exit open", async () => {
    mockedSeries.getPublicById.mockRejectedValue(new Error("boom"));
    mockedTopics.getTopicContent.mockRejectedValue(new Error("boom"));

    renderBlock(
      article({
        seriesContexts: [{ id: "s1", slug: "starmap", title: "系列", position: 1 }],
        topicSlugs: ["tech"],
      }),
    );

    expect(await screen.findByRole("link", { name: "去探索更多内容" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("继续阅读")).toBeInTheDocument();
  });

  it("never offers the same destination twice — the chapter wins over the topic row", async () => {
    mockedSeries.getPublicById.mockResolvedValue({
      id: "s1",
      title: "后端工程入门",
      slug: "backend",
      description: null,
      status: "ACTIVE",
      lockVersion: 1,
      updatedAt: "2026-09-30T00:00:00Z",
      chapters: [
        { id: "c1", articleId: "a1", title: "第一章", position: 1 },
        { id: "c2", articleId: "a2", title: "第二章", position: 2 },
      ],
    } as never);
    mockedTopics.getTopicContent.mockResolvedValue([
      topicItem("a1", "第一章"),
      topicItem("a9", "分层架构下的接口设计"),
    ]);

    renderBlock(
      article({
        id: "a2",
        seriesContexts: [{ id: "s1", slug: "backend", title: "后端工程入门", position: 2 }],
        topicSlugs: ["tech"],
      }),
    );

    expect(await screen.findByRole("link", { name: /第一章/ })).toHaveAttribute(
      "href",
      "/series/s1/read?chapter=a1",
    );
    expect(screen.getByRole("link", { name: /分层架构下的接口设计/ })).toHaveAttribute(
      "href",
      "/articles/a9",
    );
    /* One destination, one label: /articles/a1 must not also be listed. */
    expect(screen.queryByRole("link", { name: /第一章/ })).toHaveAttribute(
      "href",
      "/series/s1/read?chapter=a1",
    );
    expect(screen.queryAllByRole("link", { name: /第一章/ })).toHaveLength(1);
  });

  it("asks the network nothing when the article is neither in a series nor in a topic", async () => {
    renderBlock(article());

    expect(await screen.findByRole("link", { name: "去探索更多内容" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(mockedSeries.getPublicById).not.toHaveBeenCalled();
    expect(mockedTopics.getTopicContent).not.toHaveBeenCalled();
  });
});
