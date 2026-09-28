export type InterestDomain = {
  id: string;
  label: string;
  interests: string[];
};

/** 入门引导推荐兴趣，按领域分组；运营端可后续维护为动态配置。 */
export const INTEREST_DOMAINS: InterestDomain[] = [
  {
    id: "tech",
    label: "技术与开发",
    interests: [
      "前端开发",
      "后端开发",
      "移动开发",
      "DevOps",
      "数据库",
      "云计算",
      "网络安全",
      "系统架构",
      "编程语言",
      "性能优化",
    ],
  },
  {
    id: "design",
    label: "设计与创意",
    interests: [
      "UI 设计",
      "UX 设计",
      "平面设计",
      "插画",
      "品牌设计",
      "动效设计",
      "产品设计",
      "字体排版",
      "配色",
      "设计系统",
    ],
  },
  {
    id: "ai",
    label: "人工智能",
    interests: [
      "机器学习",
      "深度学习",
      "大语言模型",
      "AI 应用",
      "提示工程",
      "计算机视觉",
      "自然语言处理",
      "AI 伦理",
      "智能体",
      "数据科学",
    ],
  },
  {
    id: "business",
    label: "创业与商业",
    interests: [
      "创业",
      "产品经理",
      "增长黑客",
      "市场营销",
      "商业模式",
      "融资",
      "运营策略",
      "项目管理",
      "用户研究",
      "商业分析",
    ],
  },
  {
    id: "writing",
    label: "阅读与写作",
    interests: [
      "阅读",
      "写作",
      "散文",
      "小说",
      "诗歌",
      "非虚构",
      "书评",
      "翻译",
      "编辑",
      "连载创作",
    ],
  },
  {
    id: "life",
    label: "生活与成长",
    interests: [
      "生活方式",
      "心理健康",
      "效率工具",
      "健身",
      "旅行",
      "美食",
      "摄影",
      "音乐",
      "电影",
      "个人成长",
    ],
  },
  {
    id: "opensource",
    label: "开源与协作",
    interests: [
      "开源",
      "Git",
      "代码审查",
      "技术文档",
      "社区协作",
      "远程协作",
      "知识分享",
      "技术演讲",
      "开源治理",
      "开发者关系",
    ],
  },
  {
    id: "community",
    label: "社区与文化",
    interests: [
      "社区运营",
      "内容策展",
      "在线社区",
      "文化评论",
      "社会观察",
      "教育",
      "历史",
      "哲学",
      "人文",
      "科学科普",
    ],
  },
];

export const MAX_CUSTOM_INTERESTS = 10;
export const MAX_INTEREST_LABEL_LENGTH = 20;

const PREDEFINED_INTERESTS = new Set(INTEREST_DOMAINS.flatMap((domain) => domain.interests));

export function isPredefinedInterest(interest: string): boolean {
  return PREDEFINED_INTERESTS.has(interest);
}

export function splitInterests(interests: string[]): { predefined: string[]; custom: string[] } {
  const predefined: string[] = [];
  const custom: string[] = [];
  for (const interest of interests) {
    if (isPredefinedInterest(interest)) {
      predefined.push(interest);
    } else {
      custom.push(interest);
    }
  }
  return { predefined, custom };
}

export function normalizeCustomInterestLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
