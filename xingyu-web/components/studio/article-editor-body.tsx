"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { ArticleEditorMarkdownBody } from "@/components/studio/article-editor-markdown-body";
import { ArticleEditorMilkdownBody } from "@/components/studio/article-editor-milkdown-body";
import type { ArticleEditorBodyController } from "@/components/studio/article-editor-body-controller";
import { ArticleEditorToolbar } from "@/components/studio/article-editor-toolbar";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";

type ArticleEditorBodyProps = {
  bodyMode: ArticleBodyMode;
  value: string;
  onChange: (value: string) => void;
  onModeChange: (mode: ArticleBodyMode, nextBody: string) => void;
  onControllerChange?: (controller: ArticleEditorBodyController | null) => void;
  onUploadError?: (message: string) => void;
};

export function ArticleEditorBody({
  bodyMode,
  value,
  onChange,
  onModeChange,
  onControllerChange,
  onUploadError,
}: ArticleEditorBodyProps) {
  const controllerRef = useRef<ArticleEditorBodyController | null>(null);
  const formatUnsubRef = useRef<(() => void) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formatState, setFormatState] = useState<EditorFormatState | null>(null);

  const registerController = useCallback(
    (controller: ArticleEditorBodyController | null) => {
      controllerRef.current = controller;
      onControllerChange?.(controller);
      formatUnsubRef.current?.();
      formatUnsubRef.current = controller?.subscribeFormatState?.(setFormatState) ?? null;
    },
    [onControllerChange],
  );

  useEffect(() => {
    if (bodyMode === "MARKDOWN") {
      formatUnsubRef.current?.();
      formatUnsubRef.current = null;
      setFormatState(null);
    }
  }, [bodyMode]);

  useEffect(() => {
    return () => formatUnsubRef.current?.();
  }, []);

  function switchMode(next: ArticleBodyMode) {
    if (next === bodyMode) return;

    if (bodyMode === "RICH_TEXT") {
      const markdown = ensureCanonicalMarkdownBody(
        controllerRef.current?.getMarkdown?.() ?? value,
      );
      onModeChange(next, markdown);
      return;
    }

    onModeChange(next, ensureCanonicalMarkdownBody(value));
  }

  return (
    <div className="xy-editor-body">
      <ArticleEditorToolbar
        bodyMode={bodyMode}
        formatState={bodyMode === "RICH_TEXT" ? formatState : null}
        onModeChange={switchMode}
        onFormat={(action) => controllerRef.current?.format(action)}
        onImageSelect={(file) => void controllerRef.current?.uploadImage(file)}
        disabled={uploading}
      />

      {bodyMode === "MARKDOWN" ? (
        <ArticleEditorMarkdownBody
          key="markdown"
          value={value}
          onChange={onChange}
          onUploadError={onUploadError}
          onRegister={registerController}
          onUploadingChange={setUploading}
        />
      ) : (
        <ArticleEditorMilkdownBody
          key="rich"
          value={value}
          onChange={onChange}
          onUploadError={onUploadError}
          onRegister={registerController}
          onUploadingChange={setUploading}
        />
      )}
    </div>
  );
}
