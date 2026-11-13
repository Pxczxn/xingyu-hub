import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/cn";

/*
 * 发现分类入口。推荐/文章留在 /discover（用 type 查询区分），
 * 系列、话题、创作者进入各自的列表页。四个页面共用这一排胶囊。
 */
const ITEMS = [
  { id: "recommend", label: "推荐", to: "/discover" },
  { id: "articles", label: "文章", to: "/discover?type=ARTICLE" },
  { id: "series", label: "系列", to: "/series" },
  { id: "topics", label: "话题", to: "/topics" },
  { id: "creators", label: "创作者", to: "/creators" },
] as const;

function currentId(pathname: string, search: string): (typeof ITEMS)[number]["id"] | null {
  if (pathname === "/series") return "series";
  if (pathname === "/topics") return "topics";
  if (pathname === "/creators") return "creators";
  if (pathname === "/discover") {
    const type = new URLSearchParams(search).get("type");
    if (type === "ARTICLE") return "articles";
    if (!type) return "recommend";
  }
  return null;
}

export function DiscoverTabs() {
  const { pathname, search } = useLocation();
  const current = currentId(pathname, search);

  return (
    <nav aria-label="发现" className="flex flex-wrap items-center gap-1">
      {ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring rounded-full px-4 py-1.5 text-sm",
              active
                ? "bg-blue-50 font-medium text-blue-600"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
