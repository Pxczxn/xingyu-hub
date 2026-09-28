"use client";
import styles from "./studio-workspace.module.css";
import { cn } from "@/lib/utils";

import { useEffect, useId, useState } from "react";
import type { EditorLinkDraft, EditorLinkPayload } from "@/components/studio/article-editor-body-controller";
import { isLinkUrlEmpty } from "@/lib/article-editor-link-url";

type ArticleEditorLinkPopoverProps = {
  draft: EditorLinkDraft;
  disabled?: boolean;
  onConfirm: (payload: EditorLinkPayload) => void;
  onCancel: () => void;
  onRemoveLink?: () => void;
};

export function ArticleEditorLinkPopover({
  draft,
  disabled = false,
  onConfirm,
  onCancel,
  onRemoveLink,
}: ArticleEditorLinkPopoverProps) {
  const textId = useId();
  const urlId = useId();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setText(draft.text);
    setUrl(draft.url);
  }, [draft]);

  const confirmDisabled = disabled || isLinkUrlEmpty(url);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (confirmDisabled) return;
    onConfirm({ text, url });
  }

  return (
    <div role="dialog" aria-label="编辑链接" onMouseDown={(event) => event.stopPropagation()}>
      <form className={cn(styles.linkPopoverForm)} onSubmit={handleSubmit}>
        <label className={cn(styles.linkPopoverField)} htmlFor={textId}>
          <span>显示文本</span>
          <input
            id={textId}
            type="text"
            value={text}
            disabled={disabled}
            placeholder="链接文字"
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <label className={cn(styles.linkPopoverField)} htmlFor={urlId}>
          <span>链接地址</span>
          <input
            id={urlId}
            type="text"
            value={url}
            disabled={disabled}
            placeholder="https:// 或 /articles/..."
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </label>

        <div className={cn(styles.linkPopoverActions)}>
          {draft.isEditingLink && onRemoveLink ? (
            <button
              type="button"
              className={cn(styles.linkPopoverRemove)}
              disabled={disabled}
              onClick={onRemoveLink}
            >
              取消链接
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className={cn(styles.linkPopoverActions-main)}>
            <button
              type="button"
              className={cn(styles.linkPopoverCancel)}
              disabled={disabled}
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className={cn(styles.linkPopoverConfirm)}
              disabled={confirmDisabled}
            >
              确认
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
