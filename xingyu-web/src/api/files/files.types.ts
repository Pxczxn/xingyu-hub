/*
 * File-upload domain types (Phase 2A-2c).
 *
 * Shape read from `CommunityMessageController.uploadMessageAttachment`
 * (backend: xingyu-api/xingyu-community-api/.../CommunityMessageController.java)
 * and verified live on 2026-09-23 — see files.api.ts for the full contract.
 */
export type UploadedFile = {
  /** Root-relative path, e.g. `/api/v1/admin/files/community/messages/<uuid>.png`. */
  url: string;
  /** The client-supplied original file name, echoed back. */
  name: string;
  /** The multipart part's Content-Type, echoed back. NOT sniffed from the bytes. */
  mimeType: string;
};
