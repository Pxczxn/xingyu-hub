import styles from "@/features/studio/editor/editor-workspace.module.css";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleEditorBody } from "@/features/studio/editor/article-editor-body";
import { ArticleEditorOutline } from "@/features/studio/editor/article-editor-outline";
import { extractEditorOutline } from "@/lib/article-editor-outline";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import { createEditorDevDocument } from "@/features/studio/editor/editor-dev-fixture";

/*
 * EditorPage (Phase 1C-1) — Editor UI + local editing only.
 *
 * Scope of this page, deliberately:
 *   editor shell | local editor state | toolbar | outline | title | body | layout
 *
 * NOT here (and not anywhere in V2 this round):
 *   fetch draft / save draft / autosave / publish / submit review / trash /
 *   version history / image upload to the backend / category & series persistence.
 *   Legacy's ArticleEditorSettings and the four studio modals are backend-bound
 *   components and are therefore not migrated (see report).
 *
 * Consequence: a page refresh loses the content. That is accepted and stated
 * in the dev banner — no fake persistence, no fake "已保存".
 *
 * Route: /studio/content/:articleId  (articleId === "new" starts a blank doc,
 * exactly like Legacy's magic `new` id, so one route covers both cases).
 *
 * Local editing state: plain React useState, mirroring Legacy's local
 * controller. No new global store, no second editor model.
 */

type LoadState = {
  title: string;
  summary: string;
  body: string;
  bodyMode: ArticleBodyMode;
};

export function EditorPage() {
  const { articleId = "" } = useParams<{ articleId: string }>();

  // Local initial document — development fixture, never backend data.
  const [editorDocument, setEditorDocument] = useState<LoadState>(() => {
    const dev = createEditorDevDocument(articleId);
    return {
      title: dev.title,
      summary: dev.summary,
      body: dev.body,
      bodyMode: dev.bodyMode,
    };
  });

  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeOutline, setActiveOutline] = useState(0);

  const { title, summary, body, bodyMode } = editorDocument;

  const outline = useMemo(() => extractEditorOutline(body), [body]);

  const setTitle = useCallback((value: string) => {
    setEditorDocument((current) => ({ ...current, title: value }));
  }, []);

  const setSummary = useCallback((value: string) => {
    setEditorDocument((current) => ({ ...current, summary: value }));
  }, []);

  const setBody = useCallback((value: string) => {
    setEditorDocument((current) => ({ ...current, body: ensureCanonicalMarkdownBody(value) }));
  }, []);

  const handleModeChange = useCallback((mode: ArticleBodyMode, nextBody: string) => {
    setEditorDocument((current) => ({
      ...current,
      bodyMode: mode,
      body: ensureCanonicalMarkdownBody(nextBody),
    }));
  }, []);

  const scrollToOutlineItem = useCallback(
    (lineIndex: number) => {
      if (bodyMode === "RICH_TEXT") {
        const headings = document.querySelectorAll(
          ".xy-editor-milkdown .ProseMirror h1, .xy-editor-milkdown .ProseMirror h2, .xy-editor-milkdown .ProseMirror h3",
        );
        const target = headings[lineIndex] as HTMLElement | undefined;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const textarea = document.querySelector<HTMLTextAreaElement>("[data-editor-body-input]");
      if (!textarea) return;
      const lines = body.split("\n");
      let charIndex = 0;
      for (let i = 0; i < lineIndex; i += 1) {
        charIndex += lines[i].length + 1;
      }
      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex);
      const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 28;
      textarea.scrollTop = Math.max(0, lineIndex * lineHeight - textarea.clientHeight / 3);
    },
    [body, bodyMode],
  );

  // Active outline item follows the textarea caret (Legacy behaviour, Markdown mode only).
  useEffect(() => {
    if (!outline.length || bodyMode !== "MARKDOWN") {
      setActiveOutline(0);
      return;
    }
    const textarea = document.querySelector<HTMLTextAreaElement>("[data-editor-body-input]");
    if (!textarea) return;

    const updateActive = () => {
      const caretLine = textarea.value.slice(0, textarea.selectionStart).split("\n").length - 1;
      let nextActive = 0;
      outline.forEach((item, index) => {
        if (item.lineIndex <= caretLine) nextActive = index;
      });
      setActiveOutline(nextActive);
    };

    textarea.addEventListener("keyup", updateActive);
    textarea.addEventListener("click", updateActive);
    textarea.addEventListener("scroll", updateActive);
    updateActive();
    return () => {
      textarea.removeEventListener("keyup", updateActive);
      textarea.removeEventListener("click", updateActive);
      textarea.removeEventListener("scroll", updateActive);
    };
  }, [outline, bodyMode]);

  return (
    <div className={cn(styles.editorPage)} data-editor-root>
      <header className={cn(styles.toolbar)}>
        <Link to="/studio" className={cn(styles.toolbarBack)}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>

        <input
          className={cn(styles.toolbarTitle)}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="输入文章标题"
          aria-label="文章标题"
        />

        <div className={cn(styles.toolbarActions)}>
          <Button
            variant="outline"
            type="button"
            className={cn(
              styles.toolbarPreviewBtn,
              "cursor-pointer",
              previewEnabled &&
                "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-pressed={previewEnabled}
            onClick={() => setPreviewEnabled((current) => !current)}
          >
            <Eye className="h-4 w-4" />
            {previewEnabled ? "关闭预览" : "预览"}
          </Button>
        </div>
      </header>

      <p className={cn(styles.devNotice)} data-editor-dev-notice>
        开发态：本轮仅实现本地编辑，未接入草稿保存 / 自动保存 / 发布接口，刷新页面后内容会丢失。
      </p>

      <div className={cn(styles.shell)}>
        <ArticleEditorOutline
          items={outline}
          activeIndex={activeOutline}
          onSelect={(item, index) => {
            setActiveOutline(index);
            scrollToOutlineItem(item.lineIndex);
          }}
        />

        <main className={cn(styles.main)}>
          {uploadError ? (
            <p className={cn(styles.uploadAlert)} role="alert">
              {uploadError}
            </p>
          ) : null}

          <div className={cn(styles.canvas)}>
            <ArticleEditorBody
              bodyMode={bodyMode}
              title={title}
              summary={summary}
              value={body}
              previewEnabled={previewEnabled}
              onTitleChange={setTitle}
              onSummaryChange={setSummary}
              onChange={setBody}
              onModeChange={handleModeChange}
              onUploadError={setUploadError}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
