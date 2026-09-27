import { Link, Outlet } from "react-router-dom";
import { BookOpen, Compass, Hash, Home, LogOut, Map, MessageCircle, Orbit, PenLine, User as UserIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";

/*
 * App shell for Web V2.
 * Follows docs/design-system/MASTER.md "Shell": global nav, search,
 * 创作 -> /studio, user entry -> profile. Navigation uses React Router <Link>.
 * Icons come from lucide-react (no emoji used as real icons).
 * Message/notification panels are deliberately NOT implemented this round.
 */

/*
 * Phase 2H: seven nav items, one more than the six MASTER.md lists.
 *
 * MASTER.md "Shell" specifies 首页 / 发现 / 话题 / 系列 / 星系 / 指南, but 动态
 * (/moments, shipped in Phase 2D) is a real, guest-readable feed — dropping it
 * from the nav would leave it with no entry point at all. Rather than choose,
 * both are shown: the design system's six plus 动态. MASTER.md carries a note
 * recording this deliberate deviation.
 *
 * Icons: 指南 uses Map (a book/compass metaphor would collide with 系列's
 * BookOpen and 发现's Compass); 星系 uses Orbit.
 */
const NAV_ITEMS = [
  { label: "首页", to: "/", icon: Home },
  { label: "发现", to: "/discover", icon: Compass },
  { label: "话题", to: "/topics", icon: Hash },
  { label: "系列", to: "/series", icon: BookOpen },
  { label: "星系", to: "/galaxies", icon: Orbit },
  { label: "动态", to: "/moments", icon: MessageCircle },
  { label: "指南", to: "/guide", icon: Map },
];

export function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="content-shell flex items-center gap-4 py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            星语
          </Link>

          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors",
                    "hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action="/search" method="get" className="mx-auto hidden max-w-sm flex-1 lg:block">
            <input
              type="search"
              name="q"
              placeholder="搜索文章、话题、用户"
              aria-label="搜索"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/studio"
              className="hidden items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 sm:inline-flex"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              创作
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {/* /api/v1/me does not expose a username, so link to /me, which
                    resolves the real username via /api/v1/me/profile. Never hardcode. */}
                <Link
                  to="/me"
                  className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" aria-hidden />
                  {user?.username ?? "我的主页"}
                </Link>
                <Link to="/me/collections" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  收藏夹
                </Link>
                <Link to="/me/bookshelf" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  书架
                </Link>
                {/* Phase 2I-1: the follow graph. Kept next to the other /me
                    shortcuts; both are RequireAuth, so they only appear here
                    (this whole block is the signed-in branch). */}
                <Link to="/me/following" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                  关注
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="rounded-md px-3 py-2 text-sm text-primary hover:bg-muted">
                  登录
                </Link>
                <Link
                  to="/register"
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="content-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-xs text-muted-foreground">
          <span>星语</span>
          <nav aria-label="站点信息" className="flex flex-wrap gap-x-4">
            <Link to="/announcements" className="hover:text-foreground hover:underline">
              公告
            </Link>
            <Link to="/guide" className="hover:text-foreground hover:underline">
              指南
            </Link>
            <Link to="/rules" className="hover:text-foreground hover:underline">
              社区规则
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
