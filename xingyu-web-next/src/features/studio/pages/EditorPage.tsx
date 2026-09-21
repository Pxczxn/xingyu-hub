import styles from "@/features/studio/editor/editor-workspace.module.css";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageState } from "@/components/shared/PageState";
import { ArticleEditorBody } from "@/features/studio/editor/article-editor-body";
import { ArticleEditorOutline } from "@/features/studio/editor/article-editor-outline";
import { ArticleEditorSettings } from "@/features/studio/editor/article-editor-settings";
import { EditorLeaveGuard } from "@/features/studio/editor/editor-leave-guard";
import { EditorSubmitConfirm } from "@/features/studio/editor/editor-submit-confirm";
import { extractEditorOutline } from "@/lib/article-editor-outline";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import type { ArticleEditorBodyController } from "@/lib/article-editor-body-controller";
import type {
  ArticleLifecycleStatus,
  ArticleVisibility,
} from "@/api/articles/articles.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { articlesApi } from "@/api/articles/articles.api";
import { topicsApi } from "@/api/topics/topics.api";
import { ApiError } from "@/api/client";
import {
  buildDraftSavePayload,
  isDraftDirty,
  NEW_DRAFT_ROUTE_ID,
  toEditorDraftFields,
  validateForReview,
  type EditorDraftFields,
} from "@/lib/article-editor-draft";

/*
 * EditorPage (Phase 1C-2 + 1C-3) — draft load, manual save, settings, leave
 * guard, and the creator-side lifecycle action.
 *
 * Data lifecycle (verified against the real backend contract):
 *   /studio/content/:articleId -> GET /api/v1/me/articles/{id} on entry
 *   /studio/content/new        -> LOCAL BLANK EDITOR ONLY, no request on entry.
 *                                 The shell is created by the FIRST MANUAL SAVE:
 *                                 POST /api/v1/me/articles, then PUT .../{id}/draft,
 *                                 then replace the URL with the real id.
 *
 * LIFECYCLE (Phase 1C-3) — the backend has NO creator-facing publish endpoint
 * (POST/PUT /api/v1/me/articles/{id}/publish -> 404, verified live). The only
 * creator-side action is POST /api/v1/me/articles/{id}/submit, which moves the
 * article DRAFT -> IN_REVIEW. Publication (IN_REVIEW -> PUBLISHED) requires the
 * ADMIN review decision. The UI therefore says 「已提交审核」 and never claims the
 * article is published.
 *
 * Once IN_REVIEW the backend rejects every save with 409 「文章当前不可编辑」, so the
 * editing surface is disabled in that state instead of offering a control that
 * can only fail.
 *
 * Still explicitly NOT here: autosave, scheduled publish, revision history,
 * trash, delete, backend image upload, series management, studio content list,
 * collaboration, review back-office.
 */

type LoadState = "loading" | "ready" | "notfound" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

function describeSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.problem.status === 409) return "草稿已被他人更新，请刷新后重试";
    if (error.problem.status === 404) return "草稿不存在或无权编辑";
    return error.problem.detail || "保存失败，请稍后重试";
  }
  return "保存失败，请稍后重试";
}

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.problem.status === 409) {
      // The only 409 sources are "文章已在审核中" and "文章当前不可编辑".
      return error.problem.detail || "文章当前不可提交审核";
    }
    if (error.problem.status === 404) return "草稿不存在或无权编辑";
    if (error.problem.status === 401) return "登录状态已失效，请重新登录";
    return error.problem.detail || "提交审核失败，请稍后重试";
  }
  return "提交审核失败，请稍后重试";
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className={cn(styles.toolbarStatus)} data-editor-save-status="saving">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在保存…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn(styles.toolbarStatus, styles.isError)} data-editor-save-status="error">
        保存失败
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className={cn(styles.toolbarStatus, styles.isSaved)} data-editor-save-status="saved">
        已保存
      </span>
    );
  }
  return null;
}

export function EditorPage() {
  const { articleId = "" } = useParams<{ articleId: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [fields, setFields] = useState<EditorDraftFields | null>(null);
  const [baseline, setBaseline] = useState<EditorDraftFields | null>(null);
  const [lockVersion, setLockVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeOutline, setActiveOutline] = useState(0);
  /** Editorial status; the draft DTO does not expose it (see articlesApi.getMyArticleStatus). */
  const [lifecycle, setLifecycle] = useState<ArticleLifecycleStatus>("DRAFT");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  /**
   * Id of a shell created by this page's own first save on /studio/content/new.
   * It is set as soon as POST succeeds — before the PUT — so a failed PUT can be
   * retried without creating a second draft.
   */
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  /** Set after a successful first save; the URL is adopted once the editor is clean. */
  const [adoptDraftId, setAdoptDraftId] = useState<string | null>(null);

  const bodyControllerRef = useRef<ArticleEditorBodyController | null>(null);
  /** Guards the post-save `replace` navigation from re-fetching and clobbering local state. */
  const adoptedIdRef = useRef<string | null>(null);
  /** One mount-time normalization per load is treated as loading, not as an edit. */
  const richTextSettledRef = useRef(false);
  const creating = articleId === NEW_DRAFT_ROUTE_ID;
  const readOnly = lifecycle === "IN_REVIEW";

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    // After the first save of a brand-new draft we already hold the authoritative
    // local state (and the "已保存" status). Adopting the new URL must not re-fetch
    // and overwrite it.
    if (adoptedIdRef.current && adoptedIdRef.current === articleId) {
      adoptedIdRef.current = null;
      return;
    }

    let active = true;
    setLoadState("loading");
    setFields(null);
    setBaseline(null);
    setSaveStatus("idle");
    setSaveError(null);
    setSubmitError(null);
    setSubmitting(false);
    setSubmitConfirmOpen(false);
    setSubmissionId(null);
    setLifecycle("DRAFT");
    richTextSettledRef.current = false;

    if (creating) {
      /*
       * /studio/content/new — LOCAL BLANK EDITOR ONLY. No POST here.
       *
       * Creating the shell on entry would mint an orphan empty draft for every
       * visit. The shell is created by the first manual save instead, which is
       * the same backend contract, just deferred. Defaults mirror what
       * POST /me/articles returns (bodyMode MARKDOWN, visibility PRIVATE,
       * lockVersion 0) so the first PUT is contract-correct.
       */
      const blank = toEditorDraftFields({
        articleId: "",
        title: null,
        summary: null,
        coverUrl: null,
        bodyMode: "MARKDOWN",
        body: null,
        slug: null,
        visibility: "PRIVATE",
        categoryId: null,
        topicIds: [],
        lockVersion: 0,
        updatedAt: "",
        scheduledPublishAt: null,
      });
      setFields(blank);
      setBaseline(blank);
      setLockVersion(0);
      setCreatedDraftId(null);
      setLoadState("ready");
      return () => {
        active = false;
      };
    }

    // Status lookup runs alongside the draft read and never blocks it.
    const statusPromise = articlesApi.getMyArticleStatus(articleId).catch(() => null);

    articlesApi
      .getDraft(articleId)
      .then((draft) => {
        if (!active) return;
        const mapped = toEditorDraftFields(draft);
        setFields(mapped);
        setBaseline(mapped);
        setLockVersion(draft.lockVersion);
        setCreatedDraftId(draft.articleId);
        setLoadState("ready");
        void statusPromise.then((status) => {
          if (active && status) setLifecycle(status);
        });
      })
      .catch((error) => {
        if (!active) return;
        // The backend answers 404 for "missing" AND for "not mine" — there is no
        // distinct 403, so there is no separate forbidden state to show.
        const status = error instanceof ApiError ? error.problem.status : 0;
        setLoadState(status === 404 ? "notfound" : "error");
      });

    return () => {
      active = false;
    };
  }, [articleId, creating]);

  // Topics feed the settings panel only; a failure must never block the editor.
  useEffect(() => {
    let active = true;
    topicsApi
      .getTopics()
      .then((list) => {
        if (active) setTopics(list);
      })
      .catch(() => {
        if (active) setTopics([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const isDirty = isDraftDirty(fields, baseline);

  const updateFields = useCallback((patch: Partial<EditorDraftFields>) => {
    setFields((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const handleTitleChange = useCallback(
    (value: string) => updateFields({ title: value }),
    [updateFields],
  );

  const handleSummaryChange = useCallback(
    (value: string) => updateFields({ summary: value }),
    [updateFields],
  );

  const handleBodyChange = useCallback(
    (value: string) => updateFields({ body: ensureCanonicalMarkdownBody(value) }),
    [updateFields],
  );

  const handleModeChange = useCallback(
    (mode: ArticleBodyMode, nextBody: string) =>
      updateFields({ bodyMode: mode, body: ensureCanonicalMarkdownBody(nextBody) }),
    [updateFields],
  );

  const handleToggleTopic = useCallback((topicId: string) => {
    setFields((current) => {
      if (!current) return current;
      const next = current.topicIds.includes(topicId)
        ? current.topicIds.filter((id) => id !== topicId)
        : [...current.topicIds, topicId];
      return { ...current, topicIds: next };
    });
  }, []);

  const handleVisibilityChange = useCallback(
    (value: ArticleVisibility) => updateFields({ visibility: value }),
    [updateFields],
  );

  /**
   * The rich-text editor re-serializes the loaded document on mount, which can
   * differ from the stored body (plain-text `[` / `_` get escaped). That first
   * report is part of LOADING, not an edit: adopt it into the fields AND the
   * clean baseline so a freshly opened RICH_TEXT draft is not born dirty.
   */
  const handleRichTextSettle = useCallback((markdown: string) => {
    if (richTextSettledRef.current) return;
    richTextSettledRef.current = true;
    setFields((current) => (current ? { ...current, body: markdown } : current));
    setBaseline((current) => (current ? { ...current, body: markdown } : current));
  }, []);

  /** In rich-text mode the live ProseMirror document is the source of truth. */
  const resolvePayloadFields = useCallback((): EditorDraftFields | null => {
    if (!fields) return null;
    if (fields.bodyMode === "RICH_TEXT" && bodyControllerRef.current?.getMarkdown) {
      try {
        const live = ensureCanonicalMarkdownBody(bodyControllerRef.current.getMarkdown());
        return live === fields.body ? fields : { ...fields, body: live };
      } catch {
        return fields;
      }
    }
    return fields;
  }, [fields]);

  /**
   * Creates the shell if needed, then PUTs the draft. Returns the article id.
   * Throws on failure — callers decide how to surface it.
   *
   * The id is remembered the moment POST succeeds, BEFORE the PUT, so a failed
   * PUT is retried against the same draft instead of minting a second one.
   */
  const persistDraft = useCallback(
    async (payloadFields: EditorDraftFields): Promise<string> => {
      let targetId = creating ? createdDraftId : articleId;
      let expectedLockVersion = lockVersion;

      if (!targetId) {
        const created = await articlesApi.createDraft();
        targetId = created.articleId;
        expectedLockVersion = created.lockVersion;
        setCreatedDraftId(targetId);
      }

      const saved = await articlesApi.saveDraft(
        targetId,
        buildDraftSavePayload(payloadFields, expectedLockVersion),
      );
      setLockVersion(saved.lockVersion);
      // The current values become the new clean baseline.
      setBaseline(payloadFields);
      // Adopt the real id in the URL (see the effect below).
      if (creating) setAdoptDraftId(targetId);
      return targetId;
    },
    [articleId, creating, createdDraftId, lockVersion],
  );

  // --- manual save ---------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!fields || saveStatus === "saving" || submitting || readOnly) return;
    const payloadFields = resolvePayloadFields();
    if (!payloadFields) return;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      await persistDraft(payloadFields);
      setSaveStatus("saved");
    } catch (error) {
      // A failed save must NOT touch the local content — it stays editable and
      // the user can press save again.
      setSaveStatus("error");
      setSaveError(describeSaveError(error));
    }
  }, [fields, persistDraft, readOnly, resolvePayloadFields, saveStatus, submitting]);

  // --- submit for review (the real creator-side lifecycle action) ----------
  const handleRequestSubmit = useCallback(() => {
    if (!fields || submitting || readOnly) return;
    // Local check mirrors the backend rule exactly, so the user gets the same
    // message without a round-trip. The backend stays authoritative.
    const invalid = validateForReview(fields);
    if (invalid) {
      setSubmitError(invalid);
      return;
    }
    setSubmitError(null);
    setSubmitConfirmOpen(true);
  }, [fields, readOnly, submitting]);

  const handleConfirmSubmit = useCallback(async () => {
    if (!fields || submitting || readOnly) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      let targetId = creating ? createdDraftId : articleId;
      const payloadFields = resolvePayloadFields();
      if (!payloadFields) throw new Error("editor not ready");

      // Never submit a stale body: persist first when there is no draft yet or
      // when the editor is dirty. A failed save aborts the submit entirely.
      if (!targetId || isDraftDirty(payloadFields, baseline)) {
        targetId = await persistDraft(payloadFields);
        setSaveStatus("saved");
      }

      const result = await articlesApi.submitForReview(targetId);
      setSubmissionId(result.submissionId);
      setLifecycle("IN_REVIEW");
      setSaveStatus("idle");
      setSubmitConfirmOpen(false);
    } catch (error) {
      // Stay on the page, keep the local content, allow a retry.
      setSubmitError(describeSubmitError(error));
      setSubmitConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [
    articleId,
    baseline,
    creating,
    createdDraftId,
    fields,
    persistDraft,
    readOnly,
    resolvePayloadFields,
    submitting,
  ]);

  /*
   * Adopt the created draft's id in the URL once the editor has gone clean.
   *
   * The wait matters: `navigate()` consults the leave guard, and `useBlocker`
   * still holds the pre-save predicate in the same tick as `setBaseline`. By
   * deferring to an effect we guarantee the clean state has rendered and the
   * blocker is released before we navigate ourselves.
   */
  useEffect(() => {
    if (!adoptDraftId || isDraftDirty(fields, baseline)) return;
    adoptedIdRef.current = adoptDraftId;
    setAdoptDraftId(null);
    navigate(`/studio/content/${adoptDraftId}`, { replace: true });
  }, [adoptDraftId, fields, baseline, navigate]);

  const title = fields?.title ?? "";
  const summary = fields?.summary ?? "";
  const body = fields?.body ?? "";
  const bodyMode = fields?.bodyMode ?? "MARKDOWN";
  const visibility = fields?.visibility ?? "PRIVATE";
  const topicIds = fields?.topicIds ?? [];

  const outline = useMemo(() => extractEditorOutline(body), [body]);

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

  if (loadState === "loading") {
    return <PageState kind="loading" />;
  }

  if (loadState === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="草稿不存在或无权编辑"
          description="它可能已被删除，或不属于当前账号。"
        />
        <Link to="/studio" className="text-sm text-accent hover:underline">
          返回创作中心
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" description="草稿加载失败，请稍后重试。" />
        <Link to="/studio" className="text-sm text-accent hover:underline">
          返回创作中心
        </Link>
      </div>
    );
  }

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
          readOnly={readOnly}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="输入文章标题"
          aria-label="文章标题"
        />

        <div className={cn(styles.toolbarActions)}>
          <SaveStatusLabel status={saveStatus} />
          {isDirty ? (
            <span className={cn(styles.toolbarStatus)} data-editor-dirty>
              有未保存的修改
            </span>
          ) : null}
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
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={saveStatus === "saving" || submitting || readOnly}
            onClick={() => void handleSave()}
          >
            保存草稿
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={submitting || readOnly}
            data-editor-submit
            onClick={handleRequestSubmit}
          >
            {readOnly ? "已提交审核" : submitting ? "提交中…" : "提交审核"}
          </Button>
        </div>
      </header>

      {readOnly ? (
        <p className={cn(styles.lifecycleNotice)} data-editor-lifecycle="IN_REVIEW">
          已提交审核，等待审核处理。审核期间文章不可编辑。
          {submissionId ? `（审核单号 ${submissionId}）` : ""}
        </p>
      ) : null}

      {saveError ? (
        <p className={cn(styles.uploadAlert)} role="alert" data-editor-save-error>
          {saveError}
        </p>
      ) : null}

      {submitError ? (
        <p className={cn(styles.uploadAlert)} role="alert" data-editor-submit-error>
          {submitError}
        </p>
      ) : null}

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
              readOnly={readOnly}
              previewEnabled={previewEnabled}
              onTitleChange={handleTitleChange}
              onSummaryChange={handleSummaryChange}
              onChange={handleBodyChange}
              onModeChange={handleModeChange}
              onControllerChange={(controller) => {
                bodyControllerRef.current = controller;
              }}
              onUploadError={setUploadError}
              onRichTextSettle={handleRichTextSettle}
            />
          </div>
        </main>

        <ArticleEditorSettings
          topics={topics}
          topicIds={topicIds}
          visibility={visibility}
          readOnly={readOnly}
          onToggleTopic={handleToggleTopic}
          onVisibilityChange={handleVisibilityChange}
        />
      </div>

      <EditorSubmitConfirm
        open={submitConfirmOpen}
        busy={submitting}
        onCancel={() => setSubmitConfirmOpen(false)}
        onConfirm={() => void handleConfirmSubmit()}
      />

      <EditorLeaveGuard when={isDirty} />
    </div>
  );
}
