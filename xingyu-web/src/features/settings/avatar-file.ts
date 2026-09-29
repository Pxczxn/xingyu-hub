/*
 * Avatar file rules (Phase 2A-2c) — pure, no React, directly unit-testable.
 *
 * Every constant here mirrors a limit the backend actually enforces. Nothing
 * is aspirational, and nothing is stricter than the truth in a way that would
 * make the copy wrong.
 *
 * ── Where the numbers come from (verified live 2026-09-23) ──────────────────
 *
 * Accepted image formats. The upload transport
 * (`POST /api/v1/messages/upload` -> CommunityMessageController) whitelists
 * extensions: jpg jpeg png gif webp pdf doc docx xls xlsx ppt pptx txt md csv
 * zip. Of those, only these five are images, so only these five are offered:
 *
 *     png  jpg  jpeg  gif  webp
 *
 * Explicitly NOT supported, each verified with a real upload:
 *   - svg  -> 500   (also a stored-XSS vector; the backend is right to refuse)
 *   - bmp  -> 500
 *   - ico  -> 500
 *   - tiff -> 500
 * So the picker must not claim them. `accept` below matches this list exactly.
 *
 * Size limit: 100 MB. `SystemConfigHelper.validateFileSize` compares against
 * `sys_config_group.storage.maxSize` (100 in this environment) and the check is
 * `size > max`, so exactly 100 MB is accepted. Verified: 100 MB -> 200,
 * 101 MB -> 500.
 *
 * ── What validation here is and is not ──────────────────────────────────────
 * It is a UX guard: the backend answers a rejected extension, an oversized
 * file or a missing `file` part with 500 INTERNAL_ERROR ("系统繁忙"), which
 * tells the user nothing. Catching it here produces a real reason.
 *
 * It is NOT a security boundary. The backend does not sniff magic bytes — a
 * `.png` whose bytes are a JPEG is accepted and stored as `image/png`. This
 * module only mirrors the extension/MIME/size checks the browser and the
 * transport expose; it cannot make an upload safe, and no UI copy may imply
 * that it does.
 */

/** Image formats the upload transport really accepts. Keep in sync with the backend. */
export const AVATAR_ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

/** The MIME types those extensions map to in a browser. */
export const AVATAR_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/**
 * `accept` for the file input. Listing the real formats means the OS picker
 * filters to them instead of letting the user choose a file that will 500.
 */
export const AVATAR_ACCEPT_ATTR = AVATAR_ACCEPTED_MIME_TYPES.join(",");

/** `sys_config_group.storage.maxSize`, in MB, converted to bytes. */
export const AVATAR_MAX_BYTES = 100 * 1024 * 1024;

/** Human-readable mirror of AVATAR_MAX_BYTES for the hint text. */
export const AVATAR_MAX_LABEL = "100 MB";

/** One message for every format rejection — the reason is the same either way. */
export const AVATAR_FORMAT_ERROR = "仅支持 PNG、JPG、GIF、WebP 格式的图片";

/** Lower-cased extension of a file name, or "" when there is none. */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Validate a candidate avatar.
 *
 * Returns an error message to show the user, or `null` when the file is
 * acceptable. Order matters: format first (it is the most common mistake),
 * then emptiness, then size.
 *
 * The extension is authoritative because the backend only looks at the
 * extension. `file.type` is a secondary signal — some platforms hand back an
 * empty type for a perfectly good file, so an empty type is allowed through
 * rather than blocking a legitimate upload.
 */
export function validateAvatarFile(file: File): string | null {
  const extension = fileExtension(file.name ?? "");
  if (!(AVATAR_ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    return AVATAR_FORMAT_ERROR;
  }

  const mime = (file.type ?? "").toLowerCase();
  if (mime !== "" && !(AVATAR_ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)) {
    return AVATAR_FORMAT_ERROR;
  }

  /*
   * The transport happily stores a 0-byte file, which would leave the profile
   * pointing at a broken image. That is a real outcome we can prevent, so we
   * do — this is our own guard, not a claim about the backend.
   */
  if (file.size <= 0) {
    return "文件内容为空，请重新选择";
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return `图片不能超过 ${AVATAR_MAX_LABEL}`;
  }

  return null;
}

/**
 * Resolve a stored avatar value into something an `<img src>` can use.
 *
 * The backend stores whatever the upload transport returned: a root-relative
 * path (`/api/v1/admin/files/...`). Root-relative works unchanged from the SPA
 * (same origin, and the dev proxy forwards /api/v1), so it is returned as-is.
 * Anything that is not a usable non-empty string yields `null` so the caller
 * renders the initial-letter fallback rather than a broken image.
 */
export function resolveAvatarSrc(stored: unknown): string | null {
  if (typeof stored !== "string") return null;
  const trimmed = stored.trim();
  return trimmed === "" ? null : trimmed;
}
