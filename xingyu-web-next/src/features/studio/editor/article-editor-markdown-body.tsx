import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArticleEditorBodyController } from "@/lib/article-editor-body-controller";
import type { EditorFormatAction } from "@/lib/article-editor-body-controller";
import { getTextareaCaretAnchor } from "@/lib/article-editor-caret-anchor";
import {
  applyMarkdownLink,
  readMarkdownLinkDraft,
  removeMarkdownLink,
} from "@/lib/article-editor-markdown-link";
import {
  applyMarkdownFormatAction,
  insertAtCursor,
} from "@/lib/article-editor-markdown-insert";
import { readMarkdownFormatState } from "@/lib/article-editor-markdown-format-state";
import {
  MarkdownFormatHistory,
  type MarkdownEditorSnapshot,
} from "@/lib/article-editor-markdown-history";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { ArticleMarkdownBody } from "@/lib/article-markdown";
import { extractMarkdownImages } from "@/lib/article-editor-images";
import {
  describeEditorImageUploadError,
  uploadEditorImage,
} from "./editor-image-upload";

/*
 * Migrated from Legacy components/studio/article-editor-markdown-body.tsx.
 * Adaptations:
 *   1. CSS module / cn import paths.
 *   2. `next/image` -> plain <img>. Sizing already comes from the stylesheet
 *      (`.bodyImage img { width: min(100%, 560px); height: auto }`), so no
 *      layout change. V2 has no Next image optimizer to opt out of.
 *   3. Image upload goes through the local dev placeholder
 *      (./editor-image-upload) instead of communityApi.uploadMessageAttachment.
 *      No backend call is made and nothing is inserted.
 *   4. extractMarkdownImages now comes from the editor core instead of the
 *      reading module.
 * Editing behaviour (format actions, history, link draft/apply/remove, caret
 * anchoring, line numbers, drag & drop) is 1:1 with Legacy.
 */

type ArticleEditorMarkdownBodyProps = {
  value: string;
  previewEnabled?: boolean;
  /** Phase 1C-3: IN_REVIEW drafts are not editable — the backend rejects saves. */
  readOnly?: boolean;
  onChange: (value: string) => void;
  onUploadError?: (message: string) => void;
  onRegister?: (controller: ArticleEditorBodyController | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

function readSnapshot(textarea: HTMLTextAreaElement): MarkdownEditorSnapshot {
  return {
    value: textarea.value,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
  };
}

export function ArticleEditorMarkdownBody({
  value,
  previewEnabled = false,
  readOnly = false,
  onChange,
  onUploadError,
  onRegister,
  onUploadingChange,
}: ArticleEditorMarkdownBodyProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef(new MarkdownFormatHistory());
  const formatListenersRef = useRef(new Set<(state: EditorFormatState) => void>());
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const images = useMemo(() => extractMarkdownImages(value), [value]);
  const lineCount = useMemo(() => Math.max(1, value.split("\n").length), [value]);

  const notifyFormatState = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const state = readMarkdownFormatState(readSnapshot(textarea), historyRef.current);
    formatListenersRef.current.forEach((listener) => listener(state));
  }, []);

  const syncLineNumberScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (!textarea || !lineNumbers) return;
    lineNumbers.scrollTop = textarea.scrollTop;
  }, []);

  const applyChange = useCallback(
    (next: string, cursorStart: number, cursorEnd: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
        notifyFormatState();
      });
    },
    [notifyFormatState, onChange],
  );

  const runAction = useCallback(
    (action: (textarea: HTMLTextAreaElement) => { next: string; cursorStart: number; cursorEnd: number }) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      historyRef.current.recordBefore(readSnapshot(textarea));
      const result = action(textarea);
      applyChange(result.next, result.cursorStart, result.cursorEnd);
    },
    [applyChange],
  );

  const handleFormat = useCallback(
    (action: EditorFormatAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const snapshot = readSnapshot(textarea);

      if (action === "undo") {
        const previous = historyRef.current.undo(snapshot);
        if (previous) {
          applyChange(previous.value, previous.selectionStart, previous.selectionEnd);
        }
        return;
      }

      if (action === "redo") {
        const next = historyRef.current.redo(snapshot);
        if (next) {
          applyChange(next.value, next.selectionStart, next.selectionEnd);
        }
        return;
      }

      historyRef.current.recordBefore(snapshot);
      const result = applyMarkdownFormatAction(snapshot, action);
      if (result) applyChange(result.next, result.cursorStart, result.cursorEnd);
    },
    [applyChange],
  );

  const uploadAndInsert = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onUploadError?.("只能上传图片文件");
        return;
      }
      setUploading(true);
      onUploadingChange?.(true);
      try {
        const uploaded = await uploadEditorImage(file);
        const alt = file.name.replace(/\.[^.]+$/, "");
        const snippet = `\n\n![${alt}](${uploaded.url})\n\n`;
        runAction((textarea) =>
          insertAtCursor(
            {
              value: textarea.value,
              selectionStart: textarea.selectionStart,
              selectionEnd: textarea.selectionEnd,
            },
            snippet,
          ),
        );
      } catch (error) {
        onUploadError?.(describeEditorImageUploadError(error));
      } finally {
        setUploading(false);
        onUploadingChange?.(false);
        setDragging(false);
      }
    },
    [onUploadError, onUploadingChange, runAction],
  );

  const readLinkDraft = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    return readMarkdownLinkDraft(readSnapshot(textarea));
  }, []);

  const readCaretAnchor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    return getTextareaCaretAnchor(textarea);
  }, []);

  const focusEditor = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const applyLink = useCallback(
    (payload: { text: string; url: string }) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const snapshot = readSnapshot(textarea);
      historyRef.current.recordBefore(snapshot);
      const result = applyMarkdownLink(snapshot, payload);
      if (result) applyChange(result.next, result.cursorStart, result.cursorEnd);
    },
    [applyChange],
  );

  const removeLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const snapshot = readSnapshot(textarea);
    historyRef.current.recordBefore(snapshot);
    const result = removeMarkdownLink(snapshot);
    if (result) applyChange(result.next, result.cursorStart, result.cursorEnd);
  }, [applyChange]);

  useEffect(() => {
    onRegister?.({
      format: handleFormat,
      uploadImage: uploadAndInsert,
      readLinkDraft,
      readCaretAnchor,
      focusEditor,
      applyLink,
      removeLink,
      subscribeFormatState: (listener) => {
        formatListenersRef.current.add(listener);
        notifyFormatState();
        return () => formatListenersRef.current.delete(listener);
      },
    });
    return () => onRegister?.(null);
  }, [
    applyLink,
    handleFormat,
    notifyFormatState,
    onRegister,
    focusEditor,
    readCaretAnchor,
    readLinkDraft,
    removeLink,
    uploadAndInsert,
  ]);

  useEffect(() => {
    syncLineNumberScroll();
    notifyFormatState();
  }, [value, lineCount, notifyFormatState, syncLineNumberScroll]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (readOnly) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadAndInsert(file);
  }

  return (
    <div
      className={cn(
        styles.bodyZone,
        dragging && styles.isDragging,
        previewEnabled && styles.isInlinePreview,
      )}
      onDragEnter={
        readOnly
          ? undefined
          : (event) => {
              event.preventDefault();
              setDragging(true);
            }
      }
      onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
      onDragLeave={
        readOnly
          ? undefined
          : (event) => {
              if (event.currentTarget === event.target) setDragging(false);
            }
      }
      onDrop={handleDrop}
    >
      <div
        className={cn(styles.bodyInputWrap, previewEnabled && styles.isInlinePreview)}
      >
        {previewEnabled ? (
          <div
            className={cn(styles.bodyPreviewReadonly, styles.bodySurface, "xy-article-body")}
            aria-label="文章预览"
          >
            <ArticleMarkdownBody body={value} />
          </div>
        ) : null}

        <div
          className={cn(styles.bodySource, previewEnabled && styles.isSourceHidden)}
          aria-hidden={previewEnabled}
        >
          <div
            ref={lineNumbersRef}
            className={cn(styles.bodyLineNumbers)}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <span key={index + 1}>{index + 1}</span>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            data-editor-body-input
            className={cn(styles.bodySurface, styles.bodyInput)}
            value={value}
            readOnly={readOnly}
            placeholder="开始写作。可用上方工具栏排版，也可以把图片拖进来。"
            onChange={(event) => onChange(event.target.value)}
            onSelect={notifyFormatState}
            onKeyUp={notifyFormatState}
            onClick={notifyFormatState}
            onScroll={syncLineNumberScroll}
            tabIndex={previewEnabled ? -1 : undefined}
          />
        </div>
      </div>

      {!previewEnabled && images.length ? (
        <div className={cn(styles.bodyImages)} aria-label="文中图片预览">
          {images.map((image) => (
            <figure key={`${image.lineIndex}-${image.url}`} className={cn(styles.bodyImage)}>
              <img
                src={image.url}
                alt={image.alt || "文中插图"}
                width={560}
                height={320}
              />
            </figure>
          ))}
        </div>
      ) : null}

      {dragging || uploading ? (
        <div className={cn(styles.bodyDropHint)} aria-live="polite">
          {uploading ? "图片上传中…" : "松开即可插入图片"}
        </div>
      ) : null}
    </div>
  );
}
