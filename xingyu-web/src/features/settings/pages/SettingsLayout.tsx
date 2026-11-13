import { Outlet } from "react-router-dom";
import { SettingsNav } from "@/features/settings/components/SettingsNav";

/*
 * Settings shell (Phase 2A-1).
 *
 * Provides the shared frame — page title, section nav, responsive split layout —
 * so each settings page only renders its own content. Auth is enforced by the
 * route (RequireAuth), not here.
 *
 * 2026-11-12 — the h1 was `text-2xl` (24px), the same size as an h2, so the
 * area title and the section title read as one level. It now uses `text-h1`
 * (page title). The lede is body size (`text-base`), not the 14px `.lede`.
 *
 * The shell is intentionally SHARED across all nine settings pages: settings is
 * one area, and a reader moving between its pages should not have to re-locate
 * the navigation. What must differ per page is the CONTENT block below this
 * shell — see each page's own header comment for why its structure is what it is.
 */
export function SettingsLayout() {
  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-h1 text-primary">设置</h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-muted-foreground">
          管理你的资料、隐私与登录会话。
        </p>
      </header>

      {/*
        The 200px rail waits for `lg`, the same point the shell swaps the
        hamburger for the desktop nav. At 768–1023 the content box is only
        ~630–860px; a fixed 200px column leaves the form about 406px at 768.
        Below `lg` the nav wraps (SettingsNav) and the form keeps the full box.
      */}
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
