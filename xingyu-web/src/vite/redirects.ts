/**
 * Central route redirects for v4.1 migration.
 * Matched before page resolution in router.tsx.
 */
export type RedirectRule = {
  /** Pathname pattern; :param for dynamic segments */
  from: string;
  to: string;
  permanent?: boolean;
};

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const pv = pathParts[i];
    if (pp.startsWith(":")) params[pp.slice(1)] = decodeURIComponent(pv);
    else if (pp !== pv) return null;
  }
  return params;
}

function expandTarget(target: string, params: Record<string, string>) {
  return target.replace(/:([a-zA-Z]+)/g, (_, key) => encodeURIComponent(params[key] ?? ""));
}

export const REDIRECT_RULES: RedirectRule[] = [
  { from: "/users/:username", to: "/u/:username", permanent: true },
  { from: "/users/:username/works", to: "/u/:username", permanent: true },
  { from: "/users/:username/works/settings/categories", to: "/studio/settings", permanent: true },
  { from: "/hot", to: "/discover?domain=tech&sort=hot", permanent: true },
  { from: "/me/profile", to: "/settings/profile", permanent: true },
  { from: "/me/insights", to: "/studio/analytics", permanent: true },
  { from: "/studio/published", to: "/studio/content?tab=published", permanent: true },
  { from: "/studio/drafts", to: "/studio/content?tab=drafts", permanent: true },
  { from: "/studio/reviewing", to: "/studio/content?tab=reviewing", permanent: true },
  { from: "/studio/returned", to: "/studio/content?tab=returned", permanent: true },
  { from: "/studio/trash", to: "/studio/content?tab=trash", permanent: true },
  { from: "/studio/featured", to: "/studio/content", permanent: true },
  { from: "/studio/categories", to: "/studio/settings", permanent: true },
  { from: "/studio/articles", to: "/studio/content", permanent: true },
  { from: "/studio/articles/new", to: "/studio/content", permanent: true },
  { from: "/studio/articles/:articleId/edit", to: "/studio/content/:articleId", permanent: true },
  { from: "/studio/articles/:articleId/preview", to: "/studio/content/:articleId?action=preview", permanent: true },
  { from: "/studio/articles/:articleId/publish", to: "/studio/content/:articleId?action=publish", permanent: true },
  { from: "/studio/articles/:articleId/submit", to: "/studio/content/:articleId?action=submit", permanent: true },
  { from: "/studio/articles/:articleId/conflict", to: "/studio/content/:articleId?action=conflict", permanent: true },
  { from: "/studio/articles/:articleId/recovery", to: "/studio/content/:articleId?action=recovery", permanent: true },
  { from: "/studio/articles/:articleId/review", to: "/studio/content/:articleId?action=review", permanent: true },
  { from: "/studio/articles/:articleId/preflight", to: "/studio/content/:articleId?action=publish", permanent: true },
  { from: "/studio/articles/:articleId/publish-result", to: "/studio/content/:articleId", permanent: true },
  { from: "/studio/articles/:articleId/versions", to: "/studio/content/:articleId/versions", permanent: true },
  { from: "/messages/direct/:conversationId", to: "/messages/:conversationId", permanent: true },
  { from: "/messages/group/:conversationId", to: "/messages/:conversationId", permanent: true },
  { from: "/messages/group/:conversationId/members", to: "/messages/:conversationId?drawer=members", permanent: true },
  { from: "/messages/group/:conversationId/settings", to: "/messages/:conversationId?drawer=settings", permanent: true },
  { from: "/messages/group/:conversationId/info", to: "/messages/:conversationId?drawer=info", permanent: true },
  { from: "/messages/group/:conversationId/invite", to: "/messages/:conversationId?drawer=invite", permanent: true },
  { from: "/messages/group/:conversationId/requests", to: "/messages/:conversationId?drawer=requests", permanent: true },
  { from: "/messages/group/:conversationId/applications", to: "/messages/:conversationId?drawer=requests", permanent: true },
  { from: "/messages/group/:conversationId/announcement", to: "/messages/:conversationId?drawer=announcement", permanent: true },
  { from: "/messages/group/:conversationId/announcements", to: "/messages/:conversationId?drawer=announcement", permanent: true },
  { from: "/messages/group/:conversationId/ownership", to: "/messages/:conversationId?drawer=settings", permanent: true },
  { from: "/messages/group/:conversationId/join", to: "/messages/:conversationId", permanent: true },
  { from: "/messages/favorites", to: "/messages/saved", permanent: true },
  // Legacy alias pages (removed stubs)
  { from: "/tags", to: "/topics", permanent: true },
  { from: "/tags/:slug", to: "/topics/:slug", permanent: true },
  { from: "/guides", to: "/guide", permanent: true },
  { from: "/articles", to: "/discover", permanent: true },
  { from: "/me/appeals", to: "/appeals", permanent: true },
  { from: "/me/reports", to: "/reports", permanent: true },
  { from: "/verify-email/change", to: "/settings/security/email", permanent: true },
  { from: "/rules/enforcement", to: "/rules", permanent: true },
  { from: "/status/:code", to: "/system/error", permanent: true },
  { from: "/share/:shareId", to: "/discover", permanent: true },
  { from: "/policies/:type/history", to: "/rules", permanent: true },
  { from: "/policies/:type", to: "/rules", permanent: true },
  { from: "/studio/collaboration/submissions", to: "/studio/collaboration", permanent: true },
  { from: "/studio/collaboration/invitations", to: "/studio/collaboration", permanent: true },
  { from: "/register/success", to: "/login", permanent: true },
  { from: "/onboarding/welcome", to: "/onboarding", permanent: true },
  { from: "/moments/new", to: "/studio/moments/new", permanent: true },
  { from: "/settings/account", to: "/settings/profile", permanent: true },
  { from: "/settings/privacy", to: "/settings/privacy/profile", permanent: true },
  { from: "/blocks", to: "/settings/blocks", permanent: true },
  { from: "/u/undefined", to: "/me", permanent: false },
];

export function resolveRedirect(pathname: string): string | null {
  for (const rule of REDIRECT_RULES) {
    const params = matchPattern(rule.from, pathname);
    if (params) return expandTarget(rule.to, params);
  }
  return null;
}
