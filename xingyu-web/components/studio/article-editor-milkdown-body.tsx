"use client";

import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleEditorBodyController } from "@/components/studio/article-editor-body-controller";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";
import { communityApi } from "@/lib/community-api";
import {
  insertMilkdownImage,
  runMilkdownFormatAction,
} from "@/lib/milkdown-editor-commands";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { syncMilkdownEditorUi } from "@/lib/milkdown-editor-format-state";
import "@milkdown/crepe/theme/common/code-mirror.css";
import "@milkdown/crepe/theme/common/cursor.css";
import "@milkdown/crepe/theme/common/image-block.css";
import "@milkdown/crepe/theme/common/link-tooltip.css";
import "@milkdown/crepe/theme/common/list-item.css";
import "@milkdown/crepe/theme/common/placeholder.css";
import "@milkdown/crepe/theme/common/prosemirror.css";
import "@milkdown/crepe/theme/common/reset.css";
import "@milkdown/crepe/theme/frame.css";
import "@/styles/milkdown-editor.css";

type ArticleEditorMilkdownBodyProps = {
  value: string;
  onChange: (value: string) => void;
  onUploadError?: (message: string) => void;
  onRegister?: (controller: ArticleEditorBodyController | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

function MilkdownEditorInner({
  value,
  onChange,
  onUploadError,
  onRegister,
  onUploadingChange,
}: ArticleEditorMilkdownBodyProps) {
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const onUploadErrorRef = useRef(onUploadError);
  const onUploadingChangeRef = useRef(onUploadingChange);
  const initialValueRef = useRef(ensureCanonicalMarkdownBody(value));
  const formatListenersRef = useRef(new Set<(state: EditorFormatState) => void>());
  const [dragging, setDragging] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  onChangeRef.current = onChange;
  onUploadErrorRef.current = onUploadError;
  onUploadingChangeRef.current = onUploadingChange;

  useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue: initialValueRef.current,
        features: {
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.TopBar]: false,
          [CrepeFeature.Table]: false,
          [CrepeFeature.Latex]: false,
          [CrepeFeature.AI]: false,
          [CrepeFeature.BlockEdit]: false,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: "开始写作。可用上方工具栏排版，也可以把图片拖进来。",
            mode: "block",
          },
          [CrepeFeature.ImageBlock]: {
            onUpload: async (file) => {
              onUploadingChangeRef.current?.(true);
              try {
                const uploaded = await communityApi.uploadMessageAttachment(file);
                return uploaded.url;
              } catch {
                onUploadErrorRef.current?.("图片上传失败，请稍后重试");
                throw new Error("upload failed");
              } finally {
                onUploadingChangeRef.current?.(false);
                setDragging(false);
              }
            },
          },
        },
      });

      crepe.on((listener) => {
        const notifyUi = (ctx: Parameters<typeof syncMilkdownEditorUi>[0]) => {
          const state = syncMilkdownEditorUi(ctx);
          formatListenersRef.current.forEach((notify) => notify(state));
        };

        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown === prevMarkdown) return;
          onChangeRef.current(ensureCanonicalMarkdownBody(markdown));
        });
        listener.mounted((ctx) => notifyUi(ctx));
        listener.selectionUpdated((ctx) => notifyUi(ctx));
        listener.updated((ctx) => notifyUi(ctx));
        listener.focus(() => setEditorFocused(true));
        listener.blur((ctx) => {
          setEditorFocused(false);
          const view = ctx.get(editorViewCtx);
          view.dom
            .querySelectorAll(".xy-editor-block-active")
            .forEach((element) => element.classList.remove("xy-editor-block-active"));
        });
      });

      crepeRef.current = crepe;
      return crepe;
    },
    [],
  );

  const [loading, getInstance] = useInstance();

  const uploadAndInsert = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        onUploadErrorRef.current?.("只能上传图片文件");
        return;
      }
      const editor = getInstance();
      if (!editor) return;

      onUploadingChangeRef.current?.(true);
      try {
        const uploaded = await communityApi.uploadMessageAttachment(file);
        const alt = file.name.replace(/\.[^.]+$/, "");
        insertMilkdownImage(editor, uploaded.url, alt);
        onChangeRef.current(
          ensureCanonicalMarkdownBody(crepeRef.current?.getMarkdown() ?? ""),
        );
      } catch {
        onUploadErrorRef.current?.("图片上传失败，请稍后重试");
      } finally {
        onUploadingChangeRef.current?.(false);
        setDragging(false);
      }
    },
    [getInstance],
  );

  const handleFormat = useCallback(
    (action: Parameters<ArticleEditorBodyController["format"]>[0]) => {
      const editor = getInstance();
      if (!editor) return;
      runMilkdownFormatAction(editor, action);
    },
    [getInstance],
  );

  useEffect(() => {
    if (loading) return;

    onRegister?.({
      format: handleFormat,
      uploadImage: uploadAndInsert,
      getMarkdown: () =>
        ensureCanonicalMarkdownBody(crepeRef.current?.getMarkdown() ?? value),
      subscribeFormatState: (listener) => {
        formatListenersRef.current.add(listener);
        return () => formatListenersRef.current.delete(listener);
      },
    });
    return () => onRegister?.(null);
  }, [handleFormat, loading, onRegister, uploadAndInsert, value]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadAndInsert(file);
  }

  return (
    <div
      className={`xy-editor-body-zone${dragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div className="xy-editor-body-input-wrap xy-editor-body-input-wrap--rich">
        <div className={`xy-editor-milkdown${editorFocused ? " is-focused" : ""}`}>
          <Milkdown />
        </div>
      </div>
    </div>
  );
}

export function ArticleEditorMilkdownBody(props: ArticleEditorMilkdownBodyProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner {...props} />
    </MilkdownProvider>
  );
}
