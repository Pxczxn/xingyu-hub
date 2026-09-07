export function isValidUsername(username: string | null | undefined) {
  const value = username?.trim();
  return Boolean(value && value !== "undefined");
}

/** Canonical user profile path (v4.1) */
export function userProfilePath(username: string) {
  return `/u/${encodeURIComponent(username)}`;
}

export const DEFAULT_AVATAR_URL = "/prototype-assets/home/greeting-avatar.png";

export function resolveUsernameFromPath(pathname: string) {
  const match = pathname.match(/^\/u\/([^/?#]+)/)?.[1];
  if (!match) return null;
  const username = decodeURIComponent(match);
  return isValidUsername(username) ? username : null;
}
