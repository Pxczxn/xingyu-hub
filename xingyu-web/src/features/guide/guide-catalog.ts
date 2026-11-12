/*
 * The public guide catalog.
 *
 * The index and the detail pager share this list so "下一篇" follows the same
 * order the directory shows. Community rules live at /rules, not under
 * /guide/:slug — the href is the route the reader should actually open.
 */
export const GUIDE_ENTRIES = [
  {
    slug: "getting-started",
    title: "快速上手",
    description: "了解浏览、创作和参与社区的基本路径。",
    href: "/guide/getting-started",
  },
  {
    slug: "community-rules",
    title: "社区规则",
    description: "了解社区规范，以及举报与申诉相关规则。",
    href: "/rules",
  },
] as const;

export type GuideCatalogEntry = (typeof GUIDE_ENTRIES)[number];

export function adjacentGuides(slug: string): {
  previous?: GuideCatalogEntry;
  next?: GuideCatalogEntry;
} {
  const index = GUIDE_ENTRIES.findIndex((entry) => entry.slug === slug);
  if (index < 0) return {};
  return {
    previous: GUIDE_ENTRIES[index - 1],
    next: GUIDE_ENTRIES[index + 1],
  };
}
