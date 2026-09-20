import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";

/*
 * App shell for Web V2.
 * Follows docs/design-system/MASTER.md "Shell": global nav, centre search,
 * 创作 -> /studio, notification/message placeholders, avatar -> profile or login.
 * All navigation uses React Router <Link> (no Next.js shim, no Legacy custom router).
 */

const NAV_ITEMS = [
  { label: "首页", to: "/" },
  { label: "发现", to: "/discover" },
  { label: "话题", to: "/topics" },
  { label: "系列", to: "/series" },
  { label: "星系", to: "/galaxies" },
  { label: "指南", to: "/guide" },
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
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mx-auto hidden max-w-sm flex-1 lg:block">
            {/* Phase 0 placeholder: search is not wired to any API yet. */}
            <input
              type="search"
              placeholder="搜索文章、话题、用户"
              aria-label="搜索"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification & message placeholders (not implemented in Phase 0). */}
            <span
              aria-hidden
              className="hidden rounded-md px-2 py-2 text-sm text-muted-foreground sm:inline"
            >
              通知
            </span>
            <span
              aria-hidden
              className="hidden rounded-md px-2 py-2 text-sm text-muted-foreground sm:inline"
            >
              消息
            </span>

            <Link
              to="/studio"
              className="hidden rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 sm:inline-flex"
            >
              创作
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {user?.username ? (
                  <Link
                    to={`/u/${user.username}`}
                    className="rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    {user.username}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  退出
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-sm text-primary hover:bg-muted"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="content-shell flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="content-shell py-4 text-xs text-muted-foreground">
          星语 · Web V2 Phase 0 地基
        </div>
      </footer>
    </div>
  );
}
