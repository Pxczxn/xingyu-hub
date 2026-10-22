import { AUTH_PATHS, sanitizeInAppPath } from "@/features/onboarding/post-login-routing";

/**
 * 互动入口的登录引导要带回跳路径。
 *
 * 游客在文章页点赞/收藏/评论、在个人页或话题页关注、或在任意页面点顶部「登录」时，
 * 登录页已经支持 `?returnTo=` 并在登录成功后回跳（`LoginPage` →
 * `resolvePostLoginPath`）。入口此前写成裸 `/login`，登录成功后落到首页，
 * 正在读的正文和刚才想做的操作一起丢失。
 *
 * 认证页自身不作为回跳目标：登录页上的「注册」等互链若带回跳，会绕回登录页。
 * 非站内路径回落到 `/login`，避免开放重定向。
 */
export function buildLoginPath(currentPath: string): string {
  const safe = sanitizeInAppPath(currentPath, "/");
  if (safe === "/") return "/login";
  const isAuthPage = AUTH_PATHS.some(
    (path) => safe === path || safe.startsWith(`${path}?`) || safe.startsWith(`${path}/`),
  );
  if (isAuthPage) return "/login";
  return `/login?returnTo=${encodeURIComponent(safe)}`;
}
