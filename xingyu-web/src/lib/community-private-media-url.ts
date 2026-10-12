import { getStoredToken } from "@/lib/storage";

/**
 * `<img src>` 无法带 satoken 请求头；私有媒体 GET 允许 query satoken（见 CommunityAuthInterceptor）。
 * 仅用于作者预览等受控场景，勿把带 token 的 URL 持久化到正文。
 */
export function withPrivateMediaAuth(url: string): string {
  if (!url.includes("/api/v1/media/private/")) {
    return url;
  }
  const token = getStoredToken();
  if (!token) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}satoken=${encodeURIComponent(token)}`;
}
