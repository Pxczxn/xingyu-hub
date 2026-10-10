/*
 * File-upload domain types (Phase 2A-2c).
 *
 * Shape read from `CommunityMessageController.uploadMessageAttachment`
 * (backend: xingyu-api/xingyu-community-api/.../CommunityMessageController.java)
 * and verified live on 2026-09-23 — see files.api.ts for the full contract.
 */
export type UploadedFile = {
  /** Root-relative display path, e.g. `/api/v1/admin/files/community/messages/<uuid>.png`. */
  url: string;
  /**
   * `sys_file.id` (2026-10-06).
   *
   * REQUIRED for message attachments: the message row stores it so downloads can be
   * authorized against conversation membership. `url` is display-only — the static
   * file controller refuses that directory, so it can no longer be fetched directly.
   */
  fileId: number | null;
  /** The client-supplied original file name, echoed back. */
  name: string;
  /** The multipart part's Content-Type, echoed back. NOT sniffed from the bytes. */
  mimeType: string;
};
