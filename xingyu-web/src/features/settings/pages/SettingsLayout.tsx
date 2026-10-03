import { Outlet } from "react-router-dom";
import { SettingsNav } from "@/features/settings/components/SettingsNav";

/*
 * Settings shell (Phase 2A-1).
 *
 * Provides the shared frame — page title, section nav, responsive split layout —
 * so each settings page only renders its own content. Auth is enforced by the
 * route (RequireAuth), not here.
 *
 * 2026-10-03 — the h1 was `text-xl` (20px) while each inner page's h2 is the
 * `title` step (18px). Two pixels is not a hierarchy: the area title and the
 * section title read as the same level. The h1 is now the `display`-adjacent
 * utility step (24px), which restores the L1 / L2 gap the pages need.
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
        <h1 className="text-2xl font-semibold tracking-tight text-primary">设置</h1>
        <p className="lede mt-2 max-w-2xl">管理你的资料、隐私与登录会话。</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
