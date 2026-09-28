import type {
  AnnouncementSummary,
  ContentSummary,
  TopicSummary,
} from "@/lib/community-api";

/** 首页布局预览用：真实 API 无数据时填充，链接指向已有内容 */
export const HOME_MOCK_JOURNEY: ContentSummary[] = [
  {
    id: "4d198c39-47bf-4e41-84e2-1ac099d7e515",
    title: "如何用 Spring Boot 搭建可扩展的后端服务",
    summary: "从模块划分、接口契约到可观测性，梳理一套适合社区内容平台的后端工程实践。",
    authorName: "星语创作者",
    readMinutes: 12,
    objectType: "article",
  },
  {
    id: "5bd23a9d-c3e4-4850-a94a-5dd3d5f2fe8f",
    title: "分层架构下的接口设计：让前后端协作更顺畅",
    summary: "讨论 DTO、错误码、分页与幂等，减少联调时的来回沟通。",
    authorName: "星语创作者",
    readMinutes: 8,
    objectType: "article",
  },
];

export const HOME_MOCK_FOLLOW: ContentSummary[] = [
  {
    id: "025cef31-ef08-48ae-b653-890c78bba8dd",
    title: "产品设计师必须掌握的 5 个交互原则",
    summary: "一致性、反馈、容错、渐进披露与可逆操作。",
    authorName: "林设计",
    updatedAt: "2026-03-10T14:30:00Z",
    objectType: "article",
  },
  {
    id: "ac6aa3d1-140f-48a7-86c8-a90bbb24705e",
    title: "大语言模型在内容创作中的实践边界",
    authorName: "星语创作者",
    updatedAt: "2026-03-09T09:15:00Z",
    objectType: "article",
  },
  {
    id: "f59f6156-6137-45a5-beb0-215d3c53e8c2",
    title: "深夜读书：三本书带给我的思考",
    authorName: "夜读者",
    updatedAt: "2026-03-08T22:00:00Z",
    objectType: "article",
  },
];

export const HOME_MOCK_RECOMMENDATIONS: ContentSummary[] = [
  {
    id: "4d198c39-47bf-4e41-84e2-1ac099d7e515",
    title: "如何用 Spring Boot 搭建可扩展的后端服务",
    summary: "从模块划分、接口契约到可观测性，梳理一套适合社区内容平台的后端工程实践。",
    authorName: "星语创作者",
    readMinutes: 12,
    objectType: "article",
  },
  {
    id: "025cef31-ef08-48ae-b653-890c78bba8dd",
    title: "产品设计师必须掌握的 5 个交互原则",
    summary: "一致性、反馈、容错、渐进披露与可逆操作，是内容社区里最常见的体验底座。",
    authorName: "星语创作者",
    readMinutes: 6,
    objectType: "article",
  },
  {
    id: "ac6aa3d1-140f-48a7-86c8-a90bbb24705e",
    title: "大语言模型在内容创作中的实践边界",
    summary: "AI 可以加速草稿与润色，但主题判断、事实核对与表达立场仍应属于作者。",
    authorName: "星语创作者",
    readMinutes: 9,
    objectType: "article",
  },
  {
    id: "f59f6156-6137-45a5-beb0-215d3c53e8c2",
    title: "深夜读书：三本书带给我的思考",
    summary: "关于方法、写作与长期主义的三本小书，以及它们如何影响内容创作。",
    authorName: "星语创作者",
    readMinutes: 7,
    objectType: "article",
  },
  {
    id: "c88f060d-0e78-4c1c-b60d-3415b893e57f",
    title: "后端工程入门",
    summary: "面向社区平台的后端工程实践，从架构到接口协作。",
    authorName: "星语创作者",
    objectType: "series",
  },
  {
    id: "ca3236f7-04d9-45ea-a6b8-cd5db9072e18",
    title: "独立创作者手记",
    summary: "关于产品、写作与社区反馈的连续记录。",
    authorName: "星语创作者",
    objectType: "series",
  },
  {
    id: "d39b1f13-858f-4106-9501-93c8114504f3",
    title: "从 0 到 1：独立开发者的第一年",
    authorName: "星语创作者",
    readMinutes: 15,
    objectType: "article",
  },
  {
    id: "b24f32db-e5d1-469b-9d95-6da257cd8335",
    title: "我为什么开始写开源项目",
    authorName: "星语创作者",
    readMinutes: 5,
    objectType: "article",
  },
];

export const HOME_MOCK_TOPICS: TopicSummary[] = [
  {
    id: "topic-ai",
    slug: "ai",
    name: "AI",
    description: "人工智能与应用探索",
    contentCount: 12,
    followerCount: 48,
  },
  {
    id: "topic-design",
    slug: "design",
    name: "设计",
    contentCount: 8,
    followerCount: 23,
  },
  {
    id: "topic-general",
    slug: "general",
    name: "综合",
    contentCount: 15,
    followerCount: 31,
  },
  {
    id: "topic-life",
    slug: "life",
    name: "生活",
    contentCount: 6,
    followerCount: 19,
  },
  {
    id: "topic-announcement",
    slug: "announcement",
    name: "公告",
    contentCount: 3,
    followerCount: 102,
  },
];

export const HOME_MOCK_ANNOUNCEMENTS: AnnouncementSummary[] = [
  {
    id: "mock-announce-1",
    title: "星语社区内容规范更新说明",
    publishedAt: "2026-03-08T10:00:00Z",
  },
  {
    id: "mock-announce-2",
    title: "创作中心编辑器体验优化已上线",
    publishedAt: "2026-03-05T16:00:00Z",
  },
];

export function withHomeMock<T>(items: T[], mock: T[]): T[] {
  return items.length > 0 ? items : mock;
}
