/*
 * File-upload domain types (Phase 2A-2c).
 *
 * Shape from `CommunityFileController` / legacy message upload — see `files.api.ts`.
 */
export type UploadedFile = {
  /** Root-relative URL, e.g. `/api/v1/media/public/{fileId}` or `/api/v1/media/private/{fileId}`. */
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
