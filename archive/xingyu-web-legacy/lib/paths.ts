export function isValidUsername(username: string | null | undefined) {
  const value = username?.trim();
  return Boolean(value && value !== "undefined");
}

/** Canonical user profile path (v4.1) */
export function userProfilePath(username: string) {
  return `/u/${encodeURIComponent(username)}`;
}

export const DEFAULT_AVATAR_URL = "/prototype-assets/home/greeting-avatar.png";

const PROFILE_WORK_COVERS = [
  "/prototype-assets/profile/article-earth.png",
  "/prototype-assets/profile/article-night.png",
  "/prototype-assets/profile/featured-city.png",
  "/prototype-assets/profile/featured-galaxy.png",
  "/prototype-assets/profile/featured-moon.png",
] as const;

export function resolveProfileWorkCover(index: number) {
  return PROFILE_WORK_COVERS[Math.abs(index) % PROFILE_WORK_COVERS.length];
}

export function resolveUsernameFromPath(pathname: string) {
  const match = pathname.match(/^\/u\/([^/?#]+)/)?.[1];
  if (!match) return null;
  const username = decodeURIComponent(match);
  return isValidUsername(username) ? username : null;
}

/** 从 /studio/content/:articleId 路径解析文章 ID */
export function resolveArticleIdFromPath(pathname: string) {
  const match = pathname.match(/^\/studio\/content\/([^/?#]+)/)?.[1];
  if (!match || match === "new" || match === "versions") return null;
  const articleId = decodeURIComponent(match);
  return articleId && articleId !== "undefined" ? articleId : null;
}
