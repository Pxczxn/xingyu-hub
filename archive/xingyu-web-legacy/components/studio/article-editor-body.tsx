"use client";
import styles from "./studio-workspace.module.css";
import { cn } from "@/lib/utils";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { ArticleEditorMarkdownBody } from "@/components/studio/article-editor-markdown-body";
import { ArticleEditorMilkdownBody } from "@/components/studio/article-editor-milkdown-body";
import type {
  ArticleEditorBodyController,
  EditorCaretAnchor,
  EditorLinkDraft,
} from "@/components/studio/article-editor-body-controller";
import { ArticleEditorLinkPortal } from "@/components/studio/article-editor-link-portal";
import { ArticleEditorToolbar } from "@/components/studio/article-editor-toolbar";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";

type ArticleEditorBodyProps = {
  bodyMode: ArticleBodyMode;
  title: string;
  summary: string;
  value: string;
  previewEnabled?: boolean;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onChange: (value: string) => void;
  onModeChange: (mode: ArticleBodyMode, nextBody: string) => void;
  onControllerChange?: (controller: ArticleEditorBodyController | null) => void;
  onUploadError?: (message: string) => void;
};

type LinkOverlayState = {
  draft: EditorLinkDraft;
  anchor: EditorCaretAnchor;
};

function EditorField({
  label,
  htmlFor,
  meta,
  variant = "default",
  children,
}: {
  label: string;
  htmlFor?: string;
  meta?: ReactNode;
  variant?: "default" | "title" | "summary";
  children: ReactNode;
}) {
  const labelNode = htmlFor ? (
    <label className={cn(styles.fieldLabel)} htmlFor={htmlFor}>
      {label}
    </label>
  ) : (
    <p className={cn(styles.fieldLabel)}>{label}</p>
  );

  if (variant === "default") {
    return (
      <section className={cn(styles.field)}>
        {labelNode}
        {children}
      </section>
    );
  }

  return (
    <section
      className={cn(
        styles.field,
        variant === "title" && styles.fieldTitle,
        variant === "summary" && styles.fieldSummary,
      )}
    >
      <div className={cn(styles.fieldHead)}>
        {labelNode}
        {meta ? <div className={cn(styles.fieldMeta)}>{meta}</div> : null}
      </div>
      <div className={cn(styles.fieldSurface)}>{children}</div>
    </section>
  );
}

export function ArticleEditorBody({
  bodyMode,
  title,
  summary,
  value,
  previewEnabled = false,
  onTitleChange,
  onSummaryChange,
  onChange,
  onModeChange,
  onControllerChange,
  onUploadError,
}: ArticleEditorBodyProps) {
  const controllerRef = useRef<ArticleEditorBodyController | null>(null);
  const formatUnsubRef = useRef<(() => void) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formatState, setFormatState] = useState<EditorFormatState | null>(null);
  const [linkOverlay, setLinkOverlay] = useState<LinkOverlayState | null>(null);

  const registerController = useCallback(
    (controller: ArticleEditorBodyController | null) => {
      controllerRef.current = controller;
      onControllerChange?.(controller);
      formatUnsubRef.current?.();
      formatUnsubRef.current = controller?.subscribeFormatState?.(setFormatState) ?? null;
      if (!controller) setLinkOverlay(null);
    },
    [onControllerChange],
  );

  const closeLinkPopover = useCallback(() => {
    setLinkOverlay(null);
    requestAnimationFrame(() => controllerRef.current?.focusEditor?.());
  }, []);

  const openLinkPopover = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller?.readLinkDraft || !controller.readCaretAnchor) return;

    if (linkOverlay) {
      closeLinkPopover();
      return;
    }

    const draft = controller.readLinkDraft();
    const anchor = controller.readCaretAnchor();
    if (!draft || !anchor) return;

    setLinkOverlay({ draft, anchor });
    requestAnimationFrame(() => controller.focusEditor?.());
  }, [closeLinkPopover, linkOverlay]);

  useEffect(() => {
    return () => formatUnsubRef.current?.();
  }, []);

  useEffect(() => {
    setLinkOverlay(null);
  }, [bodyMode]);

  function switchMode(next: ArticleBodyMode) {
    if (next === bodyMode) return;

    if (bodyMode === "RICH_TEXT") {
      let markdown = value;
      try {
        markdown = ensureCanonicalMarkdownBody(
          controllerRef.current?.getMarkdown?.() ?? value,
        );
      } catch {
        markdown = ensureCanonicalMarkdownBody(value);
      }
      onModeChange(next, markdown);
      return;
    }

    onModeChange(next, ensureCanonicalMarkdownBody(value));
  }

  return (
    <div className={cn(styles.body)}>
      <ArticleEditorToolbar
        bodyMode={bodyMode}
        formatState={formatState}
        onModeChange={switchMode}
        onFormat={(action) => controllerRef.current?.format(action)}
        onImageSelect={(file) => void controllerRef.current?.uploadImage(file)}
        linkPopoverOpen={Boolean(linkOverlay)}
        onLinkOpen={openLinkPopover}
        disabled={uploading}
      />

      <EditorField label="标题" htmlFor="article-editor-title" variant="title">
        <input
          id="article-editor-title"
          className={cn(styles.titleInput)}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="输入文章标题"
          maxLength={120}
        />
      </EditorField>

      <EditorField
        label="摘要"
        htmlFor="article-editor-summary"
        variant="summary"
        meta={<span className={cn(styles.fieldBadge)}>选填</span>}
      >
        <textarea
          id="article-editor-summary"
          className={cn(styles.summaryInput)}
          value={summary}
          onChange={(event) => onSummaryChange(event.target.value)}
          placeholder="用一两句话概括文章要点，会展示在列表与分享卡片中"
          rows={3}
          maxLength={280}
        />
      </EditorField>

      <EditorField label="正文">
        {bodyMode === "MARKDOWN" ? (
          <ArticleEditorMarkdownBody
            key="markdown"
            value={value}
            previewEnabled={previewEnabled}
            onChange={onChange}
            onUploadError={onUploadError}
            onRegister={registerController}
            onUploadingChange={setUploading}
          />
        ) : (
          <ArticleEditorMilkdownBody
            key="rich"
            value={value}
            previewEnabled={previewEnabled}
            onChange={onChange}
            onUploadError={onUploadError}
            onRegister={registerController}
            onUploadingChange={setUploading}
          />
        )}
      </EditorField>

      {linkOverlay ? (
        <ArticleEditorLinkPortal
          open
          draft={linkOverlay.draft}
          anchor={linkOverlay.anchor}
          disabled={uploading}
          onConfirm={(payload) => {
            controllerRef.current?.applyLink?.(payload);
            closeLinkPopover();
          }}
          onCancel={closeLinkPopover}
          onRemoveLink={
            linkOverlay.draft.isEditingLink
              ? () => {
                  controllerRef.current?.removeLink?.();
                  closeLinkPopover();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
