"use client";
import styles from "./studio-workspace.module.css";
import { cn } from "@/lib/utils";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/api-client";
import type { CreationCategory, TopicSummary } from "@/lib/community-api";

type ArticleEditorSettingsProps = {
  categories: CreationCategory[];
  topics: TopicSummary[];
  categoryId: string | null;
  topicIds: string[];
  visibility: string;
  scheduledPublishAt: string;
  coverUrl: string | null;
  coverUploading?: boolean;
  onCategoryChange: (id: string | null) => void;
  onToggleTopic: (topicId: string) => void;
  onVisibilityChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
  onCoverSelect: (file: File) => void;
  onCoverRemove: () => void;
  onTrash: () => void;
};

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "公开" },
  { value: "UNLISTED", label: "不收录" },
  { value: "PRIVATE", label: "私密" },
] as const;

const COVER_PLACEHOLDER = "/prototype-assets/article-editor/cover-preview.png";

export function ArticleEditorSettings({
  categories,
  topics,
  categoryId,
  topicIds,
  visibility,
  scheduledPublishAt,
  coverUrl,
  coverUploading = false,
  onCategoryChange,
  onToggleTopic,
  onVisibilityChange,
  onScheduleChange,
  onCoverSelect,
  onCoverRemove,
  onTrash,
}: ArticleEditorSettingsProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);
  const previewSrc = coverUrl ? resolveMediaUrl(coverUrl) : COVER_PLACEHOLDER;

  useEffect(() => {
    if (!coverPreviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const editorPage = document.querySelector<HTMLElement>("[data-editor-root]");
    document.body.classList.add("xy-editor-cover-lightbox-open");
    document.body.style.overflow = "hidden";
    editorPage?.setAttribute("inert", "");
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCoverPreviewOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.classList.remove("xy-editor-cover-lightbox-open");
      document.body.style.overflow = previousOverflow;
      editorPage?.removeAttribute("inert");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [coverPreviewOpen]);

  useEffect(() => {
    if (!coverUrl) setCoverPreviewOpen(false);
  }, [coverUrl]);

  function handleCoverFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onCoverSelect(file);
  }

  return (
    <aside className={cn(styles.settings)} aria-label="发布设置">
      <section className={cn(styles.settingsCard)}>
        <h2>封面图</h2>
        <div className={cn(styles.settingsCover)}>
          {coverUrl ? (
            <div className={cn(styles.settingsCoverPreview, styles.isClickable)}>
              <button
                type="button"
                className={cn(styles.settingsCoverPreviewOpen)}
                aria-label="查看封面大图"
                disabled={coverUploading}
                onClick={() => setCoverPreviewOpen(true)}
              >
                <img src={previewSrc} alt="文章封面" />
                <span className={cn(styles.settingsCoverZoomHint)}>点击查看大图</span>
              </button>
              <button
                type="button"
                className={cn(styles.settingsCoverRemove)}
                aria-label="移除封面"
                disabled={coverUploading}
                onClick={onCoverRemove}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className={cn(styles.settingsCoverPreview)}>
              <img src={previewSrc} alt="封面占位图" />
            </div>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleCoverFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={coverUploading}
            onClick={() => coverInputRef.current?.click()}
          >
            {coverUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {coverUploading ? "上传中…" : coverUrl ? "更换封面" : "上传封面"}
          </Button>
        </div>
      </section>

      {coverPreviewOpen && coverUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(styles.coverLightbox)}
              role="dialog"
              aria-modal="true"
              aria-label="封面预览"
              onClick={() => setCoverPreviewOpen(false)}
            >
              <button
                type="button"
                className={cn(styles.coverLightboxClose)}
                aria-label="关闭预览"
                onClick={() => setCoverPreviewOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={resolveMediaUrl(coverUrl)}
                alt="文章封面大图"
                className={cn(styles.coverLightboxImage)}
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}

      <section className={cn(styles.settingsCard)}>
        <h2>话题分类</h2>
        {categories.length ? (
          <div className={cn(styles.settingsGroup)}>
            <p className={cn(styles.settingsSubhead)}>个人分类</p>
            <div className={cn(styles.settingsPills)}>
              <button
                type="button"
                className={!categoryId ? "is-active" : ""}
                onClick={() => onCategoryChange(null)}
              >
                未分类
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={categoryId === category.id ? "is-active" : ""}
                  onClick={() => onCategoryChange(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>话题</p>
          <div className={cn(styles.settingsPills)}>
            {topics.length ? (
              topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={topicIds.includes(topic.id) ? "is-active" : ""}
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
                className={visibility === option.value ? "is-active" : ""}
                onClick={() => onVisibilityChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className={cn(styles.settingsGroup)}>
          <p className={cn(styles.settingsSubhead)}>
            <Calendar className="h-3.5 w-3.5" />
            定时发布
          </p>
          <input
            type="datetime-local"
            className={cn(styles.settingsDatetime)}
            value={scheduledPublishAt}
            onChange={(e) => onScheduleChange(e.target.value)}
          />
        </div>
      </section>

      <section className={cn(styles.settingsCard, styles.settingsCardDanger)}>
        <h2>删除草稿</h2>
        <p className={cn(styles.settingsHint)}>移入回收站后仍可在内容列表找回。</p>
        <Button
          type="button"
          variant="outline"
          className={cn(styles.settingsTrash)}
          onClick={onTrash}
        >
          <Trash2 className="h-4 w-4" />
          删除草稿
        </Button>
      </section>
    </aside>
  );
}
