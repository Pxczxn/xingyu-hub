/*
 * Editor image upload — DEVELOPMENT PLACEHOLDER (Phase 1C-1).
 *
 * Legacy wired the editor's image button / drop zone / Crepe ImageBlock to
 * `communityApi.uploadMessageAttachment(file)` (POST /api/v1/attachments).
 * Phase 1C-1 explicitly forbids backend image upload, so this module replaces
 * that call with an honest failure.
 *
 * It DELIBERATELY DOES NOT resolve:
 *   - no fake URL, no blob: URL, no object URL, no base64 stand-in
 *   - nothing is inserted into the document
 * The UI hook (toolbar button + hidden file input + drag & drop + Crepe
 * ImageBlock onUpload) stays wired so Phase 1C-2 only has to swap this module
 * for the real API call.
 */

export const EDITOR_IMAGE_UPLOAD_IS_PLACEHOLDER = true;

export const EDITOR_IMAGE_UPLOAD_PLACEHOLDER_MESSAGE =
  "开发态占位：本轮未接入图片上传后端，图片不会被上传，也不会插入正文。";

export class EditorImageUploadUnavailableError extends Error {
  constructor() {
    super(EDITOR_IMAGE_UPLOAD_PLACEHOLDER_MESSAGE);
    this.name = "EditorImageUploadUnavailableError";
  }
}

/** Drop-in replacement for `communityApi.uploadMessageAttachment`. Always rejects. */
export async function uploadEditorImage(_file: File): Promise<{ url: string }> {
  throw new EditorImageUploadUnavailableError();
}

/** Map an upload failure to the message shown in the editor's upload alert. */
export function describeEditorImageUploadError(error: unknown): string {
  if (error instanceof EditorImageUploadUnavailableError) return error.message;
  return "图片上传失败，请稍后重试";
}
