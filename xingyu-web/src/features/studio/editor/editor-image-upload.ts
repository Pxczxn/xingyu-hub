import { filesApi } from "@/api/files/files.api";

export const EDITOR_IMAGE_UPLOAD_IS_PLACEHOLDER = false;

export class EditorImageUploadUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorImageUploadUnavailableError";
  }
}

export async function uploadEditorImage(
  file: File,
  articleId?: string,
): Promise<{ url: string }> {
  const uploaded = await filesApi.uploadArticleBodyImage(file, articleId);
  return { url: uploaded.url };
}

export function describeEditorImageUploadError(error: unknown): string {
  if (error instanceof EditorImageUploadUnavailableError) return error.message;
  return "图片上传失败，请稍后重试";
}
