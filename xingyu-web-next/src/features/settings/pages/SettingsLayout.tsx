import { Outlet } from "react-router-dom";
import { SettingsNav } from "@/features/settings/components/SettingsNav";

/*
 * Settings shell (Phase 2A-1).
 *
 * Provides the shared frame — page title, section nav, responsive split layout —
 * so each settings page only renders its own form. Auth is enforced by the
 * route (RequireAuth), not here.
 */
export function SettingsLayout() {
  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的资料、隐私与登录会话。</p>
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
