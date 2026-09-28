import type {
  ContentSummary,
  FollowUser,
  GalaxySummary,
  SeriesSummary,
  TopicSummary,
} from "@/lib/community-api";
import {
  HOME_MOCK_RECOMMENDATIONS,
  HOME_MOCK_TOPICS,
  withHomeMock,
} from "./home-page-mock-data";

export { withHomeMock };

export const DISCOVER_MOCK_CREATORS: FollowUser[] = [
  { userId: "pxczxn", username: "pxczxn", displayName: "pxczxn" },
  { userId: "xingyu-dev", username: "xingyu-dev", displayName: "星语开发者" },
  { userId: "creator-01", username: "creator-01", displayName: "独立创作者" },
  { userId: "design-lab", username: "design-lab", displayName: "设计实验室" },
  { userId: "backend-note", username: "backend-note", displayName: "后端笔记" },
];

export const DISCOVER_MOCK_GALAXIES: GalaxySummary[] = [
  { id: "g1", slug: "backend", name: "后端工程", official: true, memberCount: 128 },
  { id: "g2", slug: "product", name: "产品设计", official: true, memberCount: 96 },
  { id: "g3", slug: "writing", name: "写作与表达", official: false, memberCount: 74 },
  { id: "g4", slug: "opensource", name: "开源实践", official: false, memberCount: 52 },
  { id: "g5", slug: "career", name: "职业成长", official: false, memberCount: 41 },
];

export const DISCOVER_MOCK_SERIES: SeriesSummary[] = [
  {
    id: "c88f060d-0e78-4c1c-b60d-3415b893e57f",
    slug: "backend-intro",
    title: "后端工程入门",
    status: "PUBLISHED",
    chapterCount: 2,
    updatedAt: "2026-03-08T14:17:00Z",
  },
  {
    id: "ca3236f7-04d9-45ea-a6b8-cd5db9072e18",
    slug: "creator-notes",
    title: "独立创作者手记",
    status: "PUBLISHED",
    chapterCount: 4,
    updatedAt: "2026-03-07T10:30:00Z",
  },
];

export function buildDiscoverMockStream(
  articles: ContentSummary[],
  more: ContentSummary[],
  series: SeriesSummary[],
  topics: TopicSummary[],
) {
  const mockArticles = articles.length
    ? articles
    : HOME_MOCK_RECOMMENDATIONS.filter(
        (item) => !item.objectType || item.objectType.toUpperCase() === "ARTICLE",
      ).slice(0, 6);
  const mockMore = more.length ? more : [];
  const mockSeries = series.length ? series : DISCOVER_MOCK_SERIES;
  const mockTopics = topics.length ? topics : HOME_MOCK_TOPICS;

  return { mockArticles, mockMore, mockSeries, mockTopics };
}
