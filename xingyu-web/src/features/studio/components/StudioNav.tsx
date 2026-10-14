import { NavLink } from "react-router-dom";
import { BarChart3, FolderTree, Gauge, Layers, Library, Send, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Studio navigation (批次 06, 2026-10-13).
 *
 * The studio is one AREA with seven destinations, and it was navigated by going
 * back to /studio and picking a card. That works for a hub and fails the moment
 * you are two levels deep (a submission detail, a series' article order): the
 * only way to the next destination is a round trip through the hub. This rail
 * makes every destination one click from anywhere in the area — the same reason
 * Settings has one.
 *
 * ORDER IS FREQUENCY, not hierarchy. 概览 first because it is the landing page,
 * then the three things a writer touches while working (内容 / 系列 / 投稿),
 * then the three that are opened occasionally. The order is the only priority
 * signal here — see the note on grouping below.
 *
 * ⚠️ NO GROUPING, deliberately. Settings splits off its danger item with a rule
 * because one entry there is irreversible. Nothing in the studio is; adding
 * separators would imply a distinction that does not exist, and seven items do
 * not need to be chunked to be scannable.
 *
 * ⚠️ LABEL CONSTRAINTS — these are pinned by tests, not preferences.
 * `content-list-page.test.tsx` and `studio-content-routes.test.tsx` both query a
 * SINGLE link by name, so a rail entry with the same accessible name would make
 * those queries ambiguous and fail with "found multiple elements":
 *   - 新建文章   (the content list's primary action)
 *   - 编辑 / 版本历史  (row actions on that page)
 *   - 查看文章 / 去编辑 / 去编辑稿件  (submission row actions)
 * 「我的投稿」is also avoided: `studio-analytics-page.test.tsx` queries a single
 * link by that exact name. 「投稿记录」names the same destination without the
 * collision, and it is still what the page is.
 *
 * ⚠️ The `end` flag on 概览 is load-bearing. `/studio` is a PREFIX of every other
 * entry, so without it the rail would light up 概览 on all seven pages at once.
 * The other six need no flag: their subpaths (a submission detail, a series'
 * article list, a version history) genuinely belong to the section above them.
 *
 * Every entry points at a route that exists. An entry that leads nowhere is
 * worse than no entry — the same rule SettingsNav follows.
 */
const STUDIO_NAV = [
  { label: "概览", to: "/studio", icon: Gauge, end: true },
  { label: "我的内容", to: "/studio/content", icon: Library, end: false },
  { label: "我的系列", to: "/studio/series", icon: Layers, end: false },
  { label: "投稿记录", to: "/studio/submissions", icon: Send, end: false },
  { label: "数据分析", to: "/studio/analytics", icon: BarChart3, end: false },
  { label: "创作空间分类", to: "/studio/categories", icon: FolderTree, end: false },
  { label: "邀请协作", to: "/studio/collaboration", icon: UserPlus, end: false },
];

export function StudioNav() {
  return (
    <nav aria-label="创作中心导航" className="min-w-0">
      {/* Horizontal strip on small screens, a vertical rail from md up — the same
          responsive shape Settings uses, for the same two reasons:
          `min-w-0` is load-bearing (without it the grid item takes its
          max-content width and the tabs push the document wider than a 375px
          viewport), and the strip WRAPS rather than scrolling, because a scroll
          container with no affordance is a hidden nav. */}
      <ul className="flex flex-wrap gap-1 border-b border-border pb-2 md:flex-col md:flex-nowrap md:border-b-0 md:pb-0">
        {STUDIO_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
