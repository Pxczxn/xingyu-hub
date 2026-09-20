import { Link, Outlet } from "react-router-dom";

/**
 * Minimal centered layout for auth screens (Phase 0: login only).
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border">
        <div className="content-shell flex items-center py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            星语
          </Link>
        </div>
      </header>
      <main className="content-shell flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
