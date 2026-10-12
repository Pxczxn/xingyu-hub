import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { filesApi } from "@/api/files/files.api";
import {
  AVATAR_ACCEPT_ATTR,
  AVATAR_FORMAT_ERROR,
  validateAvatarFile,
} from "@/features/settings/avatar-file";

import type { TopicSummary } from "@/api/topics/topics.types";
import type { ArticleVisibility } from "@/api/articles/articles.types";
import { VISIBILITY_OPTIONS } from "@/lib/article-editor-draft";

type ArticleEditorSettingsProps = {
  topics: TopicSummary[];
  topicIds: string[];
  visibility: ArticleVisibility;
  coverUrl: string;
  /** Real article id when known; omitted on `/studio/content/new` before first save. */
  articleId?: string;
  readOnly?: boolean;
  onToggleTopic: (topicId: string) => void;
  onVisibilityChange: (value: ArticleVisibility) => void;
  onCoverUrlChange: (url: string) => void;
  onCoverUploadError?: (message: string | null) => void;
};

export function ArticleEditorSettings({
  topics,
  topicIds,
  visibility,
  coverUrl,
  articleId,
  readOnly = false,
  onToggleTopic,
  onVisibilityChange,
  onCoverUrlChange,
  onCoverUploadError,
}: ArticleEditorSettingsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverPick = async (file: File) => {
    const validationError = validateAvatarFile(file);
    if (validationError) {
      onCoverUploadError?.(validationError);
      return;
    }
    onCoverUploadError?.(null);
    setCoverUploading(true);
    try {
      const uploaded = await filesApi.uploadArticleCover(file, articleId);
      onCoverUrlChange(uploaded.url);
    } catch {
      onCoverUploadError?.("封面上传失败，请稍后重试");
    } finally {
      setCoverUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <aside className={cn(styles.settings)} aria-label="发布设置">
      <section className={cn(styles.settingsCard)}>
        <h2>封面</h2>
        <div className={cn(styles.settingsGroup)}>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="mb-2 w-full rounded-lg object-cover aspect-[2.15/1]"
            />
          ) : (
            <p className={cn(styles.settingsHint)}>未设置封面（可选）</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT_ATTR}
            className="sr-only"
            disabled={readOnly || coverUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleCoverPick(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(styles.settingsPills, "cursor-pointer text-sm")}
              disabled={readOnly || coverUploading}
              onClick={() => inputRef.current?.click()}
            >
              {coverUploading ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  上传中…
                </>
              ) : (
                "上传封面"
              )}
            </button>
            {coverUrl ? (
              <button
                type="button"
                className={cn(styles.settingsPills, "cursor-pointer text-sm")}
                disabled={readOnly || coverUploading}
                onClick={() => onCoverUrlChange("")}
              >
                移除封面
              </button>
            ) : null}
          </div>
          <p className={cn(styles.settingsHint)}>{AVATAR_FORMAT_ERROR}</p>
        </div>
      </section>

      <section className={cn(styles.settingsCard)}>
        <h2>话题分类</h2>
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>话题</p>
          <div className={cn(styles.settingsPills)}>
            {topics.length ? (
              topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={topicIds.includes(topic.id)}
                  className={cn("cursor-pointer", topicIds.includes(topic.id) && styles.isActive)}
                  onClick={() => onToggleTopic(topic.id)}
                >
                  #{topic.name}
                </button>
              ))
            ) : (
              <span className={cn(styles.settingsHint)}>暂无可选话题</span>
            )}
          </div>
        </div>
      </section>

      <section className={cn(styles.settingsCard)}>
        <h2>发布选项</h2>
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>可见范围</p>
          <div className={cn(styles.settingsPills)}>
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={readOnly}
                aria-pressed={visibility === option.value}
                className={cn("cursor-pointer", visibility === option.value && styles.isActive)}
                onClick={() => onVisibilityChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
