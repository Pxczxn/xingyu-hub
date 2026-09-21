import { Link, Outlet } from "react-router-dom";
import { Compass, Hash, Home, LogOut, PenLine, User as UserIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";

/*
 * App shell for Web V2.
 * Follows docs/design-system/MASTER.md "Shell": global nav, search,
 * 创作 -> /studio, user entry -> profile. Navigation uses React Router <Link>.
 * Icons come from lucide-react (no emoji used as real icons).
 * Message/notification panels are deliberately NOT implemented this round.
 */

const NAV_ITEMS = [
  { label: "首页", to: "/", icon: Home },
  { label: "发现", to: "/discover", icon: Compass },
  { label: "话题", to: "/topics", icon: Hash },
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
        <div className="content-shell py-4 text-xs text-muted-foreground">
          星语 · Web V2 Phase 1A
        </div>
      </footer>
    </div>
  );
}
