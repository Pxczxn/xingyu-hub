import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleEditorBodyController } from "@/lib/article-editor-body-controller";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";
import {
  insertMilkdownImage,
  runMilkdownFormatAction,
} from "@/lib/milkdown-editor-commands";
import { readMilkdownCaretAnchor } from "@/lib/milkdown-editor-caret-anchor";
import {
  applyMilkdownLink,
  readMilkdownLinkDraft,
  removeMilkdownLink,
} from "@/lib/milkdown-editor-link";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { syncMilkdownEditorUi } from "@/lib/milkdown-editor-format-state";
import { ArticleMarkdownBody } from "@/lib/article-markdown";
import {
  describeEditorImageUploadError,
  uploadEditorImage,
} from "./editor-image-upload";
import "@milkdown/crepe/theme/common/code-mirror.css";
import "@milkdown/crepe/theme/common/cursor.css";
import "@milkdown/crepe/theme/common/image-block.css";
import "@milkdown/crepe/theme/common/link-tooltip.css";
import "@milkdown/crepe/theme/common/list-item.css";
import "@milkdown/crepe/theme/common/placeholder.css";
import "@milkdown/crepe/theme/common/prosemirror.css";
import "@milkdown/crepe/theme/common/reset.css";
import "@milkdown/crepe/theme/frame.css";

/*
 * Migrated from Legacy components/studio/article-editor-milkdown-body.tsx.
 * Adaptations:
 *   1. CSS module / cn import paths.
 *   2. `@milkdown/react` added to V2 deps at the same 7.22.x series as
 *      @milkdown/kit and @milkdown/crepe (Legacy already used it; no major bump).
 *   3. Image upload (Crepe ImageBlock `onUpload` + the toolbar/drop path) goes
 *      through the local dev placeholder instead of
 *      communityApi.uploadMessageAttachment. No backend call, nothing inserted.
 *   4. `import "@/styles/milkdown-editor.css"` is gone: that Legacy stylesheet
 *      keyed off the READING domain's `--xy-article-*` tokens. The Crepe surface
 *      overrides now live in editor-workspace.module.css, scoped to
 *      `.xy-editor-milkdown`, so the editor no longer depends on the reader.
 * Crepe feature flags, listener wiring and controller contract are 1:1.
 */

type ArticleEditorMilkdownBodyProps = {
  value: string;
  previewEnabled?: boolean;
  onChange: (value: string) => void;
  onUploadError?: (message: string) => void;
  onRegister?: (controller: ArticleEditorBodyController | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  /**
   * Fired ONCE, right after the editor mounts, with the markdown the ProseMirror
   * serializer produces for the loaded document.
   *
   * Mounting a rich-text document is lossy in the harmless direction: the
   * serializer re-escapes plain-text specials (`[` -> `\[`, `_` -> `\_`), so the
   * first `markdownUpdated` differs from the stored body even though the user has
   * not typed anything. Without this signal the page would treat that
   * normalization as a user edit and open every RICH_TEXT draft already dirty.
   * The page uses it to adopt the normalized body into BOTH the fields and the
   * clean baseline.
   */
  onSettle?: (markdown: string) => void;
};

function MilkdownEditorInner({
  value,
  previewEnabled = false,
  onChange,
  onUploadError,
  onRegister,
  onUploadingChange,
  onSettle,
}: ArticleEditorMilkdownBodyProps) {
  const crepeRef = useRef<Crepe | null>(null);
  const editorReadyRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onUploadErrorRef = useRef(onUploadError);
  const onUploadingChangeRef = useRef(onUploadingChange);
  const onSettleRef = useRef(onSettle);
  const valueRef = useRef(value);
  const initialValueRef = useRef(ensureCanonicalMarkdownBody(value));
  const formatListenersRef = useRef(new Set<(state: EditorFormatState) => void>());
  const [dragging, setDragging] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  onChangeRef.current = onChange;
  onUploadErrorRef.current = onUploadError;
  onUploadingChangeRef.current = onUploadingChange;
  onSettleRef.current = onSettle;
  valueRef.current = value;

  const readMarkdownSnapshot = useCallback(() => {
    const fallback = ensureCanonicalMarkdownBody(valueRef.current);
    if (!editorReadyRef.current || !crepeRef.current) return fallback;
    try {
      return ensureCanonicalMarkdownBody(crepeRef.current.getMarkdown());
    } catch {
      return fallback;
    }
  }, []);

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
                const uploaded = await uploadEditorImage(file);
                return uploaded.url;
              } catch (error) {
                onUploadErrorRef.current?.(describeEditorImageUploadError(error));
                throw error instanceof Error ? error : new Error("upload failed");
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
        listener.mounted((ctx) => {
          editorReadyRef.current = true;
          notifyUi(ctx);
          // Report the serializer's canonical markdown once so the page can treat
          // mount-time normalization as part of loading, not as a user edit.
          try {
            onSettleRef.current?.(ensureCanonicalMarkdownBody(crepe.getMarkdown()));
          } catch {
            // The editor may not be serialisable this early; markdownUpdated will
            // still deliver the canonical value.
          }
        });
        listener.selectionUpdated((ctx) => {
          if (!editorReadyRef.current) return;
          notifyUi(ctx);
        });
        listener.updated((ctx) => {
          if (!editorReadyRef.current) return;
          notifyUi(ctx);
        });
        listener.focus(() => setEditorFocused(true));
        listener.blur((ctx) => {
          setEditorFocused(false);
          const view = ctx.get(editorViewCtx);
          view?.dom
            ?.querySelectorAll(".xy-editor-block-active")
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
        const uploaded = await uploadEditorImage(file);
        const alt = file.name.replace(/\.[^.]+$/, "");
        insertMilkdownImage(editor, uploaded.url, alt);
        onChangeRef.current(readMarkdownSnapshot());
      } catch (error) {
        onUploadErrorRef.current?.(describeEditorImageUploadError(error));
      } finally {
        onUploadingChangeRef.current?.(false);
        setDragging(false);
      }
    },
    [getInstance, readMarkdownSnapshot],
  );

  const handleFormat = useCallback(
    (action: Parameters<ArticleEditorBodyController["format"]>[0]) => {
      const editor = getInstance();
      if (!editor) return;
      runMilkdownFormatAction(editor, action);
    },
    [getInstance],
  );

  const readLinkDraft = useCallback(() => {
    const editor = getInstance();
    if (!editor) return null;
    return readMilkdownLinkDraft(editor);
  }, [getInstance]);

  const readCaretAnchor = useCallback(() => {
    const editor = getInstance();
    if (!editor) return null;
    return readMilkdownCaretAnchor(editor);
  }, [getInstance]);

  const focusEditor = useCallback(() => {
    const editor = getInstance();
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.focus();
    });
  }, [getInstance]);

  const applyLink = useCallback(
    (payload: Parameters<NonNullable<ArticleEditorBodyController["applyLink"]>>[0]) => {
      const editor = getInstance();
      if (!editor) return;
      applyMilkdownLink(editor, payload);
      onChangeRef.current(readMarkdownSnapshot());
    },
    [getInstance, readMarkdownSnapshot],
  );

  const removeLink = useCallback(() => {
    const editor = getInstance();
    if (!editor) return;
    removeMilkdownLink(editor);
    onChangeRef.current(readMarkdownSnapshot());
  }, [getInstance, readMarkdownSnapshot]);

  useEffect(() => {
    if (loading) return;

    onRegister?.({
      format: handleFormat,
      uploadImage: uploadAndInsert,
      getMarkdown: readMarkdownSnapshot,
      readLinkDraft,
      readCaretAnchor,
      focusEditor,
      applyLink,
      removeLink,
      subscribeFormatState: (listener) => {
        formatListenersRef.current.add(listener);
        return () => formatListenersRef.current.delete(listener);
      },
    });
    return () => {
      editorReadyRef.current = false;
      onRegister?.(null);
    };
  }, [
    applyLink,
    handleFormat,
    loading,
    onRegister,
    focusEditor,
    readCaretAnchor,
    readLinkDraft,
    readMarkdownSnapshot,
    removeLink,
    uploadAndInsert,
  ]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadAndInsert(file);
  }

  const previewMarkdown = ensureCanonicalMarkdownBody(value);

  return (
    <div
      className={cn(
        styles.bodyZone,
        dragging && styles.isDragging,
        previewEnabled && styles.isInlinePreview,
      )}
      onDragEnter={
        previewEnabled
          ? undefined
          : (event) => {
              event.preventDefault();
              setDragging(true);
            }
      }
      onDragOver={previewEnabled ? undefined : (event) => event.preventDefault()}
      onDragLeave={
        previewEnabled
          ? undefined
          : (event) => {
              if (event.currentTarget === event.target) setDragging(false);
            }
      }
      onDrop={previewEnabled ? undefined : handleDrop}
    >
      <div
        className={cn(
          styles.bodyInputWrap,
          styles.bodySourceRich,
          previewEnabled && styles.isInlinePreview,
        )}
      >
        {previewEnabled ? (
          <div
            className={cn(styles.bodyPreviewReadonly, styles.bodySurface, "xy-article-body")}
            aria-label="文章预览"
          >
            <ArticleMarkdownBody body={previewMarkdown} />
          </div>
        ) : null}

        <div
          className={cn(
            styles.bodySource,
            styles.bodySourceRich,
            previewEnabled && styles.isSourceHidden,
          )}
          aria-hidden={previewEnabled}
        >
          <div
            className={`xy-editor-milkdown${editorFocused ? " is-focused" : ""}`}
          >
            <Milkdown />
          </div>
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
