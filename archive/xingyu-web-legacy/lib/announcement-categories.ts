import type { AnnouncementSummary } from "@/lib/community-api";

export type AnnouncementCategory = "RULES" | "UPDATE" | "EVENT" | "MAINTENANCE";

export type AnnouncementTabId = "ALL" | AnnouncementCategory;

export const ANNOUNCEMENT_TABS: { id: AnnouncementTabId; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "RULES", label: "社区规则" },
  { id: "UPDATE", label: "版本更新" },
  { id: "EVENT", label: "活动公告" },
  { id: "MAINTENANCE", label: "维护通知" },
];

const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  RULES: "社区规则",
  UPDATE: "版本更新",
  EVENT: "活动公告",
  MAINTENANCE: "维护通知",
};

export function getAnnouncementCategoryLabel(category: AnnouncementCategory) {
  return CATEGORY_LABELS[category];
}

/** 后端暂无 category 字段，按标题与摘要关键词推断；未命中时仅出现在「全部」。 */
export function classifyAnnouncement(item: AnnouncementSummary): AnnouncementCategory | null {
  const text = `${item.title} ${item.body ?? ""}`;

  if (/规则|规范|行为|公约|守则/.test(text)) return "RULES";
  if (/版本|更新|上线|新功能|发布说明|变更/.test(text)) return "UPDATE";
  if (/活动|报名|赛事|征集|投稿|主题周/.test(text)) return "EVENT";
  if (/维护|停机|升级|故障|恢复|通知/.test(text)) return "MAINTENANCE";

  return null;
}

export function countAnnouncementsByCategory(items: AnnouncementSummary[]) {
  const counts: Record<AnnouncementTabId, number> = {
    ALL: items.length,
    RULES: 0,
    UPDATE: 0,
    EVENT: 0,
    MAINTENANCE: 0,
  };

  for (const item of items) {
    const category = classifyAnnouncement(item);
    if (category) counts[category] += 1;
  }

  return counts;
}

export function filterAnnouncements(
  items: AnnouncementSummary[],
  tab: AnnouncementTabId,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      `${item.title} ${item.body ?? ""}`.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (tab === "ALL") return true;

    return classifyAnnouncement(item) === tab;
  });
}
