/**
 * 社区私有媒体路径识别（仅同源根相对路径）。
 * 禁止用 substring 匹配：外部 URL 可能包含相似片段，绝不能据此拼接会话凭据。
 */
const PRIVATE_MEDIA_PATH = /^\/api\/v1\/media\/private\/(\d+)$/;

export function parseCommunityPrivateMediaPath(
  url: string,
): `/api/v1/media/private/${number}` | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("://") || trimmed.startsWith("//")) {
    return null;
  }
  const pathOnly = trimmed.split(/[?#]/)[0];
  const match = PRIVATE_MEDIA_PATH.exec(pathOnly);
  if (!match) {
    return null;
  }
  return `/api/v1/media/private/${match[1]}`;
}

export function isCommunityPrivateMediaPath(url: string): boolean {
  return parseCommunityPrivateMediaPath(url) !== null;
}
