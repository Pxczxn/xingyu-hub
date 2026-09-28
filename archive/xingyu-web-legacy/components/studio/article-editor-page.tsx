"use client";
import styles from "./studio-workspace.module.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { ArticleEditorBody } from "@/components/studio/article-editor-body";
import { ArticleEditorOutline } from "@/components/studio/article-editor-outline";
import { ArticleEditorSettings } from "@/components/studio/article-editor-settings";
import {
  ConflictModal,
  PublishModal,
  RecoveryModal,
  SubmitModal,
} from "@/components/studio/studio-modals";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { inferBodyMode, type ArticleBodyMode } from "@/lib/article-body-convert";
import { ensureCanonicalMarkdownBody, isHtmlPollutedBody } from "@/lib/article-body-markdown";
import type { ArticleEditorBodyController } from "@/components/studio/article-editor-body-controller";
import { extractEditorOutline } from "@/lib/article-markdown";
import {
  communityApi,
  type ArticleDraft,
  type CreationCategory,
  type TopicSummary,
} from "@/lib/community-api";
import { resolveArticleIdFromPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

type SaveState = "saved" | "saving" | "error" | "idle";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatSavedTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localBackupKey(articleId: string) {
  return `xingyu-draft-backup:${articleId}`;
}

export default function ArticleEditorPage() {
  const params = useParams<{ articleId: string }>();
  const pathname = usePathname();
  const articleId = params.articleId ?? resolveArticleIdFromPath(pathname) ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [categories, setCategories] = useState<CreationCategory[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [body, setBody] = useState("");
  const [bodyMode, setBodyMode] = useState<ArticleBodyMode>("MARKDOWN");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOutline, setActiveOutline] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyControllerRef = useRef<ArticleEditorBodyController | null>(null);
  const lockVersion = useRef(0);
  const pendingRecoverySave = useRef(false);
  const latestPayload = useRef({
    title,
    summary,
    coverUrl,
    body,
    bodyMode,
    visibility,
    categoryId,
    topicIds,
    scheduledPublishAt,
  });

  const outline = useMemo(() => extractEditorOutline(body), [body]);

  useEffect(() => {
    latestPayload.current = {
      title,
      summary,
      coverUrl,
      body,
      bodyMode,
      visibility,
      categoryId,
      topicIds,
      scheduledPublishAt,
    };
  }, [title, summary, coverUrl, body, bodyMode, visibility, categoryId, topicIds, scheduledPublishAt]);

  useEffect(() => {
    const backup = {
      title,
      summary,
      coverUrl,
      body,
      bodyMode,
      visibility,
      categoryId,
      topicIds,
      scheduledPublishAt,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(localBackupKey(articleId), JSON.stringify(backup));
    } catch {
      // ignore quota errors
    }
  }, [articleId, title, summary, coverUrl, body, bodyMode, visibility, categoryId, topicIds, scheduledPublishAt]);

  useEffect(() => {
    if (!articleId) {
      setError("文章地址无效");
      return;
    }

    Promise.all([
      communityApi.getArticleDraft(articleId),
      communityApi.listCategories().catch(() => []),
      communityApi.getTopics().catch(() => []),
    ])
      .then(([data, categoryList, topicList]) => {
        setDraft(data);
        setCategories(categoryList);
        setTopics(topicList);
        setTitle(data.title ?? "");
        setSummary(data.summary ?? "");
        setCoverUrl(data.coverUrl ?? null);
        const rawBody = data.body ?? "";
        const canonicalBody = ensureCanonicalMarkdownBody(rawBody);
        setBody(canonicalBody);
        pendingRecoverySave.current = isHtmlPollutedBody(rawBody);
        setBodyMode(inferBodyMode(canonicalBody, data.bodyMode));
        setVisibility(data.visibility ?? "PUBLIC");
        setCategoryId(data.categoryId);
        setTopicIds(data.topicIds ?? []);
        setScheduledPublishAt(toDatetimeLocalValue(data.scheduledPublishAt));
        lockVersion.current = data.lockVersion;
        setSaveState("saved");
        setLastSavedAt(data.updatedAt ? new Date(data.updatedAt) : new Date());
      })
      .catch((err) => {
        if (err instanceof ApiError && err.problem.status === 404) {
          setError("文章不存在或无权编辑");
        } else {
          setError("加载失败，请稍后重试");
        }
      });
  }, [articleId]);

  useEffect(() => {
    if (action === "preview") setPreviewEnabled(true);
    if (action === "publish") setPublishOpen(true);
    if (action === "submit") setSubmitOpen(true);
    if (action === "conflict") setConflictOpen(true);
    if (action === "recovery") setRecoveryOpen(true);
  }, [action]);

  const closeModal = () => {
    setPublishOpen(false);
    setSubmitOpen(false);
    setSubmitError(null);
    setConflictOpen(false);
    setRecoveryOpen(false);
    router.replace(`/studio/content/${articleId}`);
  };

  const resolveBodyForSave = useCallback(() => {
    const payload = latestPayload.current;
    let liveBody = payload.body;
    if (payload.bodyMode === "RICH_TEXT" && bodyControllerRef.current?.getMarkdown) {
      try {
        liveBody = bodyControllerRef.current.getMarkdown();
      } catch {
        liveBody = payload.body;
      }
    }
    return ensureCanonicalMarkdownBody(liveBody);
  }, []);

  const saveDraft = useCallback(async () => {
    const payload = latestPayload.current;
    const bodyToSave = resolveBodyForSave();
    if (bodyToSave !== payload.body) {
      setBody(bodyToSave);
      latestPayload.current = { ...payload, body: bodyToSave };
    }
    setSaveState("saving");
    try {
      const updated = await communityApi.saveArticleDraft(articleId, {
        title: payload.title,
        body: bodyToSave,
        summary: payload.summary,
        coverUrl: payload.coverUrl,
        bodyMode: payload.bodyMode,
        visibility: payload.visibility,
        categoryId: payload.categoryId,
        topicIds: payload.topicIds,
        scheduledPublishAt: fromDatetimeLocalValue(payload.scheduledPublishAt),
        lockVersion: lockVersion.current,
      });
      lockVersion.current = updated.lockVersion;
      setSaveState("saved");
      setLastSavedAt(new Date());
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [articleId, resolveBodyForSave]);

  useEffect(() => {
    if (!draft || !pendingRecoverySave.current) return;
    pendingRecoverySave.current = false;
    void saveDraft();
  }, [draft, saveDraft]);

  const flushSaveDraft = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return saveDraft();
  }, [saveDraft]);

  const visibilityLabel =
    visibility === "PUBLIC"
      ? "公开（所有人可见）"
      : visibility === "UNLISTED"
        ? "不公开收录"
        : "私密";

  function validateForSubmit(): string | null {
    const payload = latestPayload.current;
    if (!payload.title.trim()) return "提交审核前必须填写标题";
    if (!payload.body.trim()) return "提交审核前必须填写正文";
    if (!payload.visibility) return "提交审核前必须设置可见范围";
    return null;
  }

  async function handleSubmitReview() {
    const validationError = validateForSubmit();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await flushSaveDraft();
      if (!saved) {
        setSubmitError("草稿保存失败，请稍后重试");
        return;
      }

      const result = await communityApi.submitArticle(articleId);
      if (!result?.submissionId) {
        setSubmitError("提交成功但未返回审核单号，请到创作中心查看");
        return;
      }
      setSubmitOpen(false);
      setSubmitError(null);
      router.push(`/studio/submissions/${result.submissionId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.problem.status === 409) {
          setConflictOpen(true);
          setSubmitOpen(false);
        } else {
          setSubmitError(err.problem.detail || "提交失败，请稍后重试");
        }
      } else {
        setSubmitError("提交失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const scheduleSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraft();
    }, 1500);
  }, [saveDraft]);

  function handleFieldChange<T extends string>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T,
  ) {
    setter(value);
    scheduleSave();
  }

  async function handleCoverSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("只能上传图片文件");
      return;
    }
    setCoverUploading(true);
    setUploadError(null);
    try {
      const uploaded = await communityApi.uploadMessageAttachment(file);
      setCoverUrl(uploaded.url);
      scheduleSave();
    } catch {
      setUploadError("封面上传失败，请稍后重试");
    } finally {
      setCoverUploading(false);
    }
  }

  function handleCoverRemove() {
    setCoverUrl(null);
    scheduleSave();
  }

  function toggleTopic(topicId: string) {
    setTopicIds((prev) => {
      const next = prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId];
      return next;
    });
    scheduleSave();
  }

  async function handleTrash() {
    if (!confirm("确定将文章移入回收站？")) return;
    try {
      await communityApi.trashArticle(articleId);
      router.push("/studio/content?tab=trash");
    } catch {
      setSaveState("error");
    }
  }

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

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Alert variant="destructive">{error}</Alert>
        <Link href="/studio" className="mt-4 inline-block text-sm underline">
          返回创作控制台
        </Link>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="px-4 py-8 text-sm text-muted-foreground sm:px-6">
        加载中…
      </main>
    );
  }

  return (
    <div className={cn(styles.editorPage)} data-editor-root>
      <header className={cn(styles.toolbar)}>
        <Link href="/studio/content" className={cn(styles.toolbarBack)}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>

        <input
          className={cn(styles.toolbarTitle)}
          value={title}
          onChange={(e) => handleFieldChange(setTitle, e.target.value)}
          placeholder="输入文章标题"
          aria-label="文章标题"
        />

        <div className={cn(styles.toolbarActions)}>
          <ToolbarSaveStatus state={saveState} lastSavedAt={lastSavedAt} />
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
            className="cursor-pointer"
            onClick={() => {
              setSubmitError(null);
              setSubmitOpen(true);
            }}
          >
            提交审核
          </Button>
        </div>
      </header>

      <PublishModal open={publishOpen} onClose={closeModal} actions={<Button onClick={closeModal}>知道了</Button>} />
      <SubmitModal
        open={submitOpen}
        onClose={closeModal}
        articleTitle={title}
        visibilityLabel={visibilityLabel}
        submitting={submitting}
        error={submitError}
        onConfirm={() => void handleSubmitReview()}
      />
      <ConflictModal open={conflictOpen} onClose={closeModal} />
      <RecoveryModal open={recoveryOpen} onClose={closeModal} />

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
            <Alert variant="destructive" className={cn(styles.uploadAlert)}>
              {uploadError}
            </Alert>
          ) : null}

          <div className={cn(styles.canvas)}>
            <ArticleEditorBody
              bodyMode={bodyMode}
              title={title}
              summary={summary}
              value={body}
              previewEnabled={previewEnabled}
              onTitleChange={(value) => handleFieldChange(setTitle, value)}
              onSummaryChange={(value) => handleFieldChange(setSummary, value)}
              onChange={(value) =>
                handleFieldChange(setBody, ensureCanonicalMarkdownBody(value))
              }
              onModeChange={(mode, nextBody) => {
                const canonicalBody = ensureCanonicalMarkdownBody(nextBody);
                setBodyMode(mode);
                setBody(canonicalBody);
                latestPayload.current = {
                  ...latestPayload.current,
                  bodyMode: mode,
                  body: canonicalBody,
                };
                scheduleSave();
              }}
              onControllerChange={(controller) => {
                bodyControllerRef.current = controller;
              }}
              onUploadError={setUploadError}
            />
          </div>

        </main>

        <ArticleEditorSettings
          categories={categories}
          topics={topics}
          categoryId={categoryId}
          topicIds={topicIds}
          visibility={visibility}
          scheduledPublishAt={scheduledPublishAt}
          coverUrl={coverUrl}
          coverUploading={coverUploading}
          onCoverSelect={(file) => void handleCoverSelect(file)}
          onCoverRemove={handleCoverRemove}
          onCategoryChange={(id) => {
            setCategoryId(id);
            scheduleSave();
          }}
          onToggleTopic={toggleTopic}
          onVisibilityChange={(value) => handleFieldChange(setVisibility, value)}
          onScheduleChange={(value) => {
            setScheduledPublishAt(value);
            scheduleSave();
          }}
          onTrash={() => void handleTrash()}
        />
      </div>
    </div>
  );
}

function ToolbarSaveStatus({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
  if (state === "saving") {
    return (
      <span className={cn(styles.toolbarStatus)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在保存…
      </span>
    );
  }
  if (state === "error") {
    return <span className={cn(styles.toolbarStatus, styles.isError)}>保存失败</span>;
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span className={cn(styles.toolbarStatus, styles.isSaved)}>
        已保存 {formatSavedTime(lastSavedAt)}
      </span>
    );
  }
  return null;
}

