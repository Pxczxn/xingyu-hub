import { NavLink } from "react-router-dom";
import { MonitorSmartphone, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Settings navigation (Phase 2A-1, extended in 2A-2a).
 *
 * Only pages that genuinely exist this round are listed. Deliberately absent
 * (and NOT shown as disabled/"coming soon" entries — an entry that leads
 * nowhere is worse than no entry):
 *   - 修改密码      backend has no self-service endpoint (Phase 2-0 B10)
 *   - 修改邮箱      requires an email verification link (human gate)
 *   - 通知设置      backend has no notification-preferences endpoint
 *   - 安全事件      backend has no security-events endpoint
 *   - API Token / 数据导出   real capabilities, not part of 2A-2a
 *   - 头像          real capability via a side channel, deferred to its own stage
 */
const SETTINGS_NAV = [
  { label: "资料", to: "/settings/profile", icon: UserRound },
  { label: "隐私", to: "/settings/privacy", icon: ShieldCheck },
  { label: "登录会话", to: "/settings/sessions", icon: MonitorSmartphone },
  { label: "屏蔽", to: "/settings/blocks", icon: ShieldOff },
];

export function SettingsNav() {
  return (
    <nav aria-label="设置导航">
      {/* Horizontal tabs on small screens, a vertical rail from md up. */}
      <ul className="flex gap-1 overflow-x-auto border-b border-border pb-2 md:flex-col md:border-b-0 md:pb-0">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
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
