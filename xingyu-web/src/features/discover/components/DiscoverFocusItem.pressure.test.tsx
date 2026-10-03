import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ContentSummary } from "@/api/common.types";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { SeriesDirectoryItem } from "@/features/series/components/SeriesDirectoryItem";
import { TopicCard } from "@/features/topics/components/TopicCard";
import { DiscoverFocusItem } from "./DiscoverFocusItem";

const pressureItems: ContentSummary[] = [
  {
    id: "pressure-primary",
    objectType: "ARTICLE",
    title: "这是一个用于验证长标题换行和内容层级的极端合法测试标题，长度明显超过常规卡片宽度",
    summary:
      "这是一段较长的摘要，用于确认焦点内容在真实桌面宽度下仍然能够稳定截断、保持阅读节奏，并且不会让视觉区域被文字撑破。",
    authorName: "an-author-name-that-is-long-enough-to-test-truncation",
    cover: "https://example.test/wide-cover.jpg",
  },
  {
    id: "pressure-secondary",
    objectType: "SERIES",
    title: "次焦点内容标题也可能很长，但应该保持横向 media card 的稳定比例",
    summary: "次焦点摘要用于验证最多两行的截断行为。",
    authorName: "series_author",
    cover: "https://example.test/tall-cover.jpg",
  },
  {
    id: "pressure-secondary-fallback",
    objectType: "MOMENT",
    title: "没有摘要和封面的内容也应该自然降级",
  },
];

const topicPressureItems: TopicSummary[] = Array.from({ length: 20 }, (_, index) => ({
  id: `pressure-topic-${index}`,
  slug: `pressure-topic-${index}`,
  name: `超长话题名称 ${index} / community topic`,
  description: "一段较长的话题描述，用于验证目录条目在密集数据下仍然可以保持截断与间距。",
  contentCount: index,
  followerCount: index % 3 === 0 ? index : 0,
}));

const seriesPressureItems: PublicSeriesSummary[] = Array.from({ length: 24 }, (_, index) => ({
  id: `pressure-series-${index}`,
  slug: `pressure-series-${index}`,
  title: `连续阅读路径 ${index}：一个较长的系列标题`,
  description: "用于验证系列目录在 24 条数据和较长描述下不会出现布局溢出。",
  status: index % 2 === 0 ? "ACTIVE" : "ARCHIVED",
  chapterCount: index + 1,
  updatedAt: "2026-09-30T15:13:42Z",
}));

describe("DiscoverFocusItem pressure fixtures", () => {
  it("keeps long mixed content inside the intended focus variants", () => {
    render(
      <MemoryRouter>
        <DiscoverFocusItem item={pressureItems[0]} variant="primary" />
        <DiscoverFocusItem item={pressureItems[1]} variant="secondary" />
        <DiscoverFocusItem item={pressureItems[2]} variant="secondary" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("discover-focus-primary")).toBeInTheDocument();
    expect(screen.getAllByTestId("discover-focus-secondary")).toHaveLength(2);
    expect(screen.getAllByTestId("discover-focus-secondary")[0]).toHaveClass(
      "grid-cols-[128px_minmax(0,1fr)]",
    );
    expect(document.querySelector('img[src="https://example.test/tall-cover.jpg"]')).toHaveClass(
      "h-full",
      "w-full",
    );
    expect(screen.getByRole("link", { name: /极端合法测试标题/ })).toHaveClass("line-clamp-2");
    expect(screen.getByRole("link", { name: /没有摘要和封面的内容/ })).toBeInTheDocument();
  });

  it("keeps dense topic and series directories renderable", () => {
    render(
      <MemoryRouter>
        <ul>
          {topicPressureItems.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </ul>
        <ul>
          {seriesPressureItems.map((item, index) => (
            <SeriesDirectoryItem key={item.id} item={item} index={index} />
          ))}
        </ul>
      </MemoryRouter>,
    );

    expect(screen.getAllByTestId("topic-visual")).toHaveLength(20);
    expect(screen.getAllByTestId("generated-series-cover")).toHaveLength(24);
    expect(screen.getAllByText("暂无内容").length).toBeGreaterThan(0);
  });
});
