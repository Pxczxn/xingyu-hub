"use client";

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
      <form className="xy-editor-link-popover__form" onSubmit={handleSubmit}>
        <label className="xy-editor-link-popover__field" htmlFor={textId}>
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

        <label className="xy-editor-link-popover__field" htmlFor={urlId}>
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

        <div className="xy-editor-link-popover__actions">
          {draft.isEditingLink && onRemoveLink ? (
            <button
              type="button"
              className="xy-editor-link-popover__remove"
              disabled={disabled}
              onClick={onRemoveLink}
            >
              取消链接
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="xy-editor-link-popover__actions-main">
            <button
              type="button"
              className="xy-editor-link-popover__cancel"
              disabled={disabled}
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="xy-editor-link-popover__confirm"
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
