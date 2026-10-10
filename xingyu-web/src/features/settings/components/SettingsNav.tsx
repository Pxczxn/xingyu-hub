import { NavLink } from "react-router-dom";
import {
  Database,
  KeyRound,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Settings navigation (Phase 2A-1, extended in 2A-2a / 2A-2b, corrected in 3H).
 *
 * Only pages that genuinely exist are listed. Deliberately absent (and NOT shown
 * as disabled/"coming soon" entries — an entry that leads nowhere is worse than
 * no entry):
 *   - 修改密码      backend has NO self-service set-password endpoint. Only
 *                  `/me/password/force-change`, which is the forced-change path
 *                  shown when `mustChangePassword` is set, and the
 *                  `password-recovery` / `password-reset` mail flow. Neither is a
 *                  "change my password from settings" endpoint.
 *   - 通知设置      backend has no notification-preferences endpoint.
 *   - 安全事件      backend WRITES `auth_security_event` rows but exposes no
 *                  endpoint to READ them back.
 *
 * ⚠️ CORRECTED in Phase 3H: this comment previously claimed that 修改邮箱 is
 * gated behind "an email verification link (human gate)" and that 数据导出 has
 * "no backend capability". BOTH WERE WRONG — `POST /me/email/change` and
 * `GET /me/data-export` are real self-service endpoints, and the account
 * deactivation endpoint exists too. Those three pages are now built.
 *
 * ⚠️ CORRECTED again in the 2026-10-08 audit: this comment still listed 头像 as
 * "real capability via a side channel, deferred to its own stage". It is NOT
 * deferred — avatar upload and display already work and are covered by
 * SettingsProfilePage's tests. The claim was simply stale.
 *
 * 2026-10-08 (Settings Contract Recovery): 停用账号 is now reachable from here.
 * The audit found it had NO entry anywhere in the product — grep found zero links
 * to `/settings/data/delete-account`, so the page could only be reached by typing
 * the URL. An irreversible action being unreachable is not a safety property.
 *
 * It is placed LAST and, on the vertical rail, given a top border plus muted
 * (not red) styling on purpose: discoverable, but visually not competing with the
 * seven routine destinations above it. Making it red would shout at everyone on
 * every visit to Settings; the page it leads to is where the danger lives.
 */
const SETTINGS_NAV = [
  { label: "资料", to: "/settings/profile", icon: UserRound },
  { label: "邮箱", to: "/settings/security/email", icon: Mail },
  { label: "隐私", to: "/settings/privacy", icon: ShieldCheck },
  { label: "登录会话", to: "/settings/sessions", icon: MonitorSmartphone },
  { label: "屏蔽", to: "/settings/blocks", icon: ShieldOff },
  { label: "API Token", to: "/settings/api-tokens", icon: KeyRound },
  { label: "数据导出", to: "/settings/data/export", icon: Database },
  { label: "停用账号", to: "/settings/data/delete-account", icon: ShieldOff, danger: true },
];

export function SettingsNav() {
  return (
    <nav aria-label="设置导航" className="min-w-0">
      {/* Horizontal strip on small screens, a vertical rail from md up.
          `min-w-0` is load-bearing: without it the grid item takes its
          max-content width, so the tabs push the whole document wider than a
          375px viewport.

          2026-10-03: the strip used `overflow-x-auto`, which made the last two
          destinations (API Token / 数据导出) reachable only by an invisible
          horizontal scroll — and the active item sat half-clipped at the right
          edge. A scroll container with no scroll affordance is a hidden nav. It
          now WRAPS instead, so every destination is visible without a gesture. */}
      <ul className="flex flex-wrap gap-1 border-b border-border pb-2 md:flex-col md:flex-nowrap md:border-b-0 md:pb-0">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.to}
              className={cn("shrink-0", item.danger && "md:mt-2 md:border-t md:border-border md:pt-2")}
            >
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? cn("bg-muted font-medium text-primary", item.danger && "text-destructive")
                      : cn(
                          "text-muted-foreground hover:bg-muted hover:text-foreground",
                          item.danger && "hover:text-destructive",
                        ),
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
