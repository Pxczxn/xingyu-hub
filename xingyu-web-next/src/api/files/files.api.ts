/*
 * File domain API (Phase 2A-2c).
 *
 * This module exists so the avatar upload does not have to reach into another
 * feature's API surface. It deliberately exposes ONE capability — the upload
 * transport the avatar flow needs — and nothing else (no library, no delete,
 * no file manager).
 *
 * ── The real upload contract ────────────────────────────────────────────────
 * Verified live on 2026-09-23 against the local backend (isolated test DB):
 *
 *   POST /api/v1/messages/upload          (multipart/form-data, field `file`)
 *     - requires the community `satoken` header -> otherwise 401 AUTH_REQUIRED
 *     - 200 -> { url, name, mimeType }
 *     - `url` is ROOT-RELATIVE: /api/v1/admin/files/community/messages/<uuid>.<ext>
 *       It is served publicly (no auth) by the admin FileAccessController, which
 *       is on Sa-Token's exclude list. Verified: plain GET -> 200 image/png.
 *     - extension whitelist (lower-cased) is enforced by the controller:
 *       jpg jpeg png gif webp pdf doc docx xls xlsx ppt pptx txt md csv zip
 *     - size limit is 100 MB (storage maxSize). Verified: 100 MB -> 200,
 *       101 MB -> 500.
 *
 * ── Why /messages/upload and not a dedicated avatar endpoint ────────────────
 * There is no community-facing avatar upload endpoint. The two candidates:
 *   - `POST /api/v1/app/auth/upload-avatar` (AppAuthController) is the only
 *     "dedicated" one, but it is Sa-Token-guarded under /api/v1/app/** and
 *     writes `sys_user.avatar` — which the community profile NEVER reads.
 *     Verified: called with a valid community session it returns 500.
 *   - `/api/v1/messages/upload` is the only file transport a community session
 *     can actually use. It is message-*scoped* on the backend, but it is a
 *     plain "store this file, give me a URL" endpoint — it creates no message,
 *     touches no conversation, and its response is exactly the URL we need.
 *     We therefore reuse it as the transport and do not pretend it is an
 *     avatar-specific API.
 *
 * ── What the backend does NOT do (do not claim otherwise in UI copy) ────────
 *   - it does not sniff magic bytes; a `.png` holding JPEG bytes is accepted
 *   - a rejected extension / oversized file / missing `file` part returns
 *     500 INTERNAL_ERROR, not 400 — the frontend must pre-validate because the
 *     error the user would otherwise see is an opaque "系统繁忙"
 *   - SVG is NOT accepted (not in the whitelist) -> 500
 *   - nothing deletes the previous file, so replacing an avatar leaves the old
 *     object behind (recorded as a backend gap, not compensated here)
 */
import { apiUpload } from "@/api/client";
import type { UploadedFile } from "./files.types";

export const filesApi = {
  /**
   * Store one file and return its public URL.
   *
   * `apiUpload` already builds the multipart body with the field name the
   * backend requires (`file`) and injects the `satoken` header.
   *
   * Callers MUST validate the file first (see features/settings/avatar-file.ts):
   * the backend answers a bad file with a 500, so a pre-flight check is the
   * only way to give the user a real reason.
   */
  uploadFile: (file: File): Promise<UploadedFile> =>
    apiUpload<UploadedFile>("/api/v1/messages/upload", file),
};
