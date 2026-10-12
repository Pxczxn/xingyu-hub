import { apiUpload } from "@/api/client";
import type { UploadedFile } from "./files.types";

export type CommunityFilePurpose =
  | "USER_AVATAR"
  | "USER_BANNER"
  | "ARTICLE_COVER"
  | "ARTICLE_BODY_IMAGE"
  | "SERIES_COVER"
  | "GALAXY_COVER"
  | "MOMENT_MEDIA"
  | "MESSAGE_ATTACHMENT"
  | "DRAFT_IMAGE"
  | "DRAFT_ATTACHMENT"
  | "TEMP_UPLOAD";

export type CommunityUploadOptions = {
  purpose: CommunityFilePurpose;
  draftId?: string;
  articleId?: string;
  seriesId?: string;
  galaxyId?: string;
  momentId?: string;
};

/**
 * 社区统一上传：POST /api/v1/files/upload?purpose=...
 * 公开资源返回 `/api/v1/media/public/{fileId}`，私有资源返回 `/api/v1/media/private/{fileId}`。
 */
export const filesApi = {
  uploadFile: (file: File, options: CommunityUploadOptions): Promise<UploadedFile> => {
    const params = new URLSearchParams({ purpose: options.purpose });
    if (options.draftId) params.set("draftId", options.draftId);
    if (options.articleId) params.set("articleId", options.articleId);
    if (options.seriesId) params.set("seriesId", options.seriesId);
    if (options.galaxyId) params.set("galaxyId", options.galaxyId);
    if (options.momentId) params.set("momentId", options.momentId);
    return apiUpload<UploadedFile>(`/api/v1/files/upload?${params.toString()}`, file);
  },

  uploadAvatar: (file: File): Promise<UploadedFile> =>
    filesApi.uploadFile(file, { purpose: "USER_AVATAR" }),

  uploadArticleBodyImage: (file: File, articleId?: string): Promise<UploadedFile> =>
    filesApi.uploadFile(file, { purpose: "ARTICLE_BODY_IMAGE", articleId }),

  uploadArticleCover: (file: File, articleId?: string): Promise<UploadedFile> =>
    filesApi.uploadFile(file, { purpose: "ARTICLE_COVER", articleId }),

  uploadMessageAttachment: (file: File): Promise<UploadedFile> =>
    filesApi.uploadFile(file, { purpose: "MESSAGE_ATTACHMENT" }),
};
