export type SettingsNavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

/** v3.2 §33.6 设置模块主导航 */
export const SETTINGS_MAIN_NAV: SettingsNavItem[] = [
  { label: "设置首页", href: "/settings", match: "exact" },
  { label: "公开资料", href: "/settings/profile", match: "exact" },
  { label: "隐私", href: "/settings/privacy", match: "prefix" },
  { label: "通知设置", href: "/settings/notifications", match: "exact" },
  { label: "账号安全", href: "/settings/security", match: "prefix" },
  { label: "数据与注销", href: "/settings/data", match: "prefix" },
  { label: "通用偏好", href: "/settings/preferences", match: "exact" },
  { label: "外观主题", href: "/settings/appearance", match: "exact" },
  { label: "屏蔽管理", href: "/settings/blocks", match: "exact" },
];

export const PRIVACY_SUB_NAV: SettingsNavItem[] = [
  { label: "主页隐私", href: "/settings/privacy/profile", match: "exact" },
  { label: "互动隐私", href: "/settings/privacy/interactions", match: "exact" },
  { label: "阅读与推荐", href: "/settings/privacy/activity", match: "exact" },
];

export const SECURITY_SUB_NAV: SettingsNavItem[] = [
  { label: "安全总览", href: "/settings/security", match: "exact" },
  { label: "修改密码", href: "/settings/security/password", match: "exact" },
  { label: "修改邮箱", href: "/settings/security/email", match: "exact" },
  { label: "设备与会话", href: "/settings/security/sessions", match: "exact" },
  { label: "安全事件", href: "/settings/security/events", match: "exact" },
];

export const DATA_SUB_NAV: SettingsNavItem[] = [
  { label: "数据概览", href: "/settings/data", match: "exact" },
  { label: "数据导出", href: "/settings/data/export", match: "exact" },
  { label: "注销账号", href: "/settings/data/delete-account", match: "exact" },
];

export function isSettingsNavActive(pathname: string, item: SettingsNavItem) {
  const mode = item.match ?? "exact";
  if (mode === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function settingsSubNav(pathname: string): SettingsNavItem[] | null {
  if (pathname.startsWith("/settings/privacy")) return PRIVACY_SUB_NAV;
  if (pathname.startsWith("/settings/security")) return SECURITY_SUB_NAV;
  if (pathname.startsWith("/settings/data")) return DATA_SUB_NAV;
  return null;
}
