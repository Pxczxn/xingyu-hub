/*
 * Display helpers shared by the Phase 2H galaxy pages.
 *
 * The backend exposes no label text for any of these enums, so every mapping
 * lives here (and is unit-tested) rather than being inlined per page.
 */

/** `GalaxySummary.official` drives the badge text. */
export function galaxyKindLabel(official: boolean): string {
  return official ? "官方星系" : "社区星系";
}

/**
 * `GalaxyMember.role` is a raw enum ("OWNER" / "MEMBER") in the DTO.
 * Unknown values fall through unchanged so an backend-added role still renders.
 */
export function galaxyMemberRoleLabel(role: string | null | undefined): string {
  const normalized = (role ?? "").trim().toUpperCase();
  if (normalized === "OWNER") return "创建者";
  if (normalized === "ADMIN") return "管理员";
  if (normalized === "MEMBER") return "成员";
  return normalized || "成员";
}

/** `objectType` on galaxy content: SERIES / ARTICLE / MOMENT / USER. */
export function galaxyContentTypeLabel(objectType: string | null | undefined): string {
  const normalized = (objectType ?? "").trim().toUpperCase();
  if (normalized === "SERIES") return "系列";
  if (normalized === "ARTICLE") return "文章";
  if (normalized === "MOMENT") return "动态";
  if (normalized === "USER") return "用户";
  return normalized || "内容";
}

/**
 * The three content filters mirror the Legacy tabs. `null` means "no filter".
 * TOPIC is deliberately absent — the backend never associates one.
 */
export type GalaxyContentFilter = "ARTICLE" | "SERIES" | "MOMENT" | null;

export const GALAXY_CONTENT_FILTERS: { value: GalaxyContentFilter; label: string }[] = [
  { value: null, label: "全部" },
  { value: "ARTICLE", label: "文章" },
  { value: "SERIES", label: "系列" },
  { value: "MOMENT", label: "动态" },
];

export function galaxyContentFilterLabel(filter: GalaxyContentFilter): string {
  return GALAXY_CONTENT_FILTERS.find((item) => item.value === filter)?.label ?? "全部";
}

/** ISO timestamp -> local date; a malformed value is echoed rather than "Invalid Date". */
export function formatJoinedAt(value: string | null | undefined): string {
  if (!value) return "加入时间暂未提供";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN");
}
