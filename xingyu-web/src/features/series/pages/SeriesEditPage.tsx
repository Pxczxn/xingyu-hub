import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail, SeriesStatus } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { SeriesLeaveGuard } from "../components/SeriesLeaveGuard";
import { SeriesStatusBadge } from "../components/SeriesStatusBadge";
import {
  apiErrorDetail,
  isConflictError,
  isNotFoundError,
  seriesStatusDescription,
} from "../series-labels";

type LoadState = "loading" | "error" | "notfound" | "ready";
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type ConflictReloadState = "idle" | "confirm" | "loading";

type Baseline = {
  title: string;
  description: string;
  status: SeriesStatus;
};

const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 1024;

export function SeriesEditPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SeriesStatus>("ACTIVE");
  const [lockVersion, setLockVersion] = useState(0);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflictReload, setConflictReload] = useState<ConflictReloadState>("idle");
  const [createdNotice, setCreatedNotice] = useState(searchParams.get("created") === "1");
  const [reloadKey, setReloadKey] = useState(0);

  const idRef = useRef(id);
  const revisionRef = useRef(0);
  const sessionRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const applyDetail = useCallback((detail: SeriesDetail) => {
    setTitle(detail.title);
    setSlug(detail.slug);
    setDescription(detail.description ?? "");
    setStatus(detail.status);
    setLockVersion(detail.lockVersion);
    setBaseline({
      title: detail.title,
      description: detail.description ?? "",
      status: detail.status,
    });
    setLoadedId(detail.id);
    setSaveState("idle");
    setSaveError(null);
    setSaveMessage(null);
    setFieldError(null);
    setConflictReload("idle");
    revisionRef.current += 1;
  }, []);

  useEffect(() => {
    if (!id) {
      setLoadState("notfound");
      return;
    }
    let active = true;
    savingRef.current = false;
    setLoadState("loading");
    setLoadedId(null);
    setSaveState("idle");
    setSaveError(null);
    setSaveMessage(null);
    setFieldError(null);
    setConflictReload("idle");
    revisionRef.current += 1;

    seriesApi
      .getMine(id)
      .then((detail) => {
        if (!active) return;
        applyDetail(detail);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadState(isNotFoundError(error) ? "notfound" : "error");
      });
    return () => {
      active = false;
      sessionRef.current += 1;
    };
  }, [id, reloadKey, applyDetail]);

  const dirty =
    baseline !== null &&
    (title !== baseline.title ||
      description !== baseline.description ||
      status !== baseline.status);

  function markEdited() {
    revisionRef.current += 1;
    setSaveError(null);
    setSaveMessage(null);
    setFieldError(null);
    setSaveState((current) => (current === "saving" || current === "conflict" ? current : "idle"));
    setConflictReload("idle");
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!id || !dirty || savingRef.current || saveState === "conflict") return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      setFieldError("请填写标题");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setFieldError("标题不能超过 256 个字符");
      return;
    }
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      setFieldError("简介不能超过 1024 个字符");
      return;
    }

    const requestSeriesId = id;
    const session = sessionRef.current;
    savingRef.current = true;
    const revisionAtStart = revisionRef.current;
    setSaveState("saving");
    setSaveError(null);
    setSaveMessage(null);
    setFieldError(null);
    setConflictReload("idle");

    let updated: SeriesDetail;
    try {
      updated = await seriesApi.update(requestSeriesId, {
        title: trimmedTitle,
        description: trimmedDescription,
        status,
        lockVersion,
      });
    } catch (error) {
      if (idRef.current !== requestSeriesId || sessionRef.current !== session) return;
      savingRef.current = false;
      if (isConflictError(error)) {
        setSaveState("conflict");
      } else {
        setSaveState("error");
        setSaveError(apiErrorDetail(error, "保存失败，请稍后重试。"));
      }
      return;
    }
    if (idRef.current !== requestSeriesId || sessionRef.current !== session) return;

    savingRef.current = false;
    const nextBaseline: Baseline = {
      title: updated.title,
      description: updated.description ?? "",
      status: updated.status,
    };
    setLockVersion(updated.lockVersion);
    setBaseline(nextBaseline);
    setSlug(updated.slug);

    if (revisionRef.current === revisionAtStart) {
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setStatus(updated.status);
      setSaveState("saved");
      setSaveMessage("已保存。");
    } else {
      /* Keep the newer local edits; only the version and saved baseline move. */
      setSaveState("idle");
      setSaveMessage("已保存上一版内容；保存期间的修改尚未提交。");
    }
  }

  async function reloadServerAfterConflict() {
    if (!id) return;
    const session = sessionRef.current;
    const revision = revisionRef.current;
    setConflictReload("loading");
    try {
      const detail = await seriesApi.getMine(id);
      if (idRef.current !== id || sessionRef.current !== session) return;
      if (revisionRef.current !== revision) {
        setConflictReload("idle");
        setSaveMessage("读取期间又有修改，已保留本地内容；请重新确认是否载入服务端版本。");
        return;
      }
      applyDetail(detail);
      setSaveState("saved");
      setSaveMessage("已载入服务端最新内容。");
    } catch (error) {
      if (idRef.current !== id || sessionRef.current !== session) return;
      setConflictReload("idle");
      setSaveState("conflict");
      setSaveError(apiErrorDetail(error, "重新读取失败，请稍后重试。"));
    }
  }

  if (loadState === "loading" || (loadState === "ready" && loadedId !== id)) {
    return <PageState kind="loading" />;
  }
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" description="系列信息加载失败，请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <BackLink />
        </p>
      </div>
    );
  }
  if (loadState === "notfound" || loadedId !== id) {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="系列不存在或无权编辑"
          description="地址可能有误，或该系列不属于当前账号。"
        />
        <BackLink />
      </div>
    );
  }

  const statusText =
    saveState === "saving"
      ? "保存中…"
      : saveState === "conflict"
        ? "版本冲突"
        : saveState === "error"
          ? "保存失败"
          : dirty
            ? "有未保存的修改"
            : saveState === "saved"
              ? "已保存"
              : "已是最新";

  return (
    <>
      <SeriesLeaveGuard
        when={dirty}
        title="有未保存的系列信息"
        description="离开当前页面会丢失尚未保存的标题、简介或状态修改，确定要离开吗？"
      />
      <div className="section-gap">
        <div>
          <BackLink />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-primary">编辑系列</h1>
                <SeriesStatusBadge status={status} />
              </div>
              <p className="mt-1 text-meta text-muted-foreground">
                修改系列信息，或前往章节编排调整文章顺序。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/studio/series/${encodeURIComponent(id)}/articles`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                管理章节
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              {status === "ACTIVE" ? (
                <Link
                  to={`/series/${encodeURIComponent(id)}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  查看公开页
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {createdNotice ? (
          <div
            role="status"
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-accent-line bg-accent-soft p-4"
          >
            <div>
              <p className="text-sm font-semibold text-primary">系列已创建</p>
              <p className="mt-1 text-meta leading-5 text-muted-foreground">
                下一步可以编排章节，也可以继续完善系列信息。新系列默认为公开中。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/studio/series/${encodeURIComponent(id)}/articles`}
                className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              >
                去编排章节
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreatedNotice(false)}
              >
                关闭提示
              </Button>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={(event) => void onSave(event)}
          className="space-y-5 rounded-xl border border-border/70 bg-card p-4 sm:p-5"
          noValidate
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-title">标题</Label>
              <span className="text-[11px] text-muted-foreground">必填 · 最多 256 个字符</span>
            </div>
            <Input
              id="series-title"
              name="title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              aria-invalid={fieldError?.includes("标题") || undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                markEdited();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-slug">别名</Label>
              <span className="text-[11px] text-muted-foreground">创建后不可修改</span>
            </div>
            <Input
              id="series-slug"
              name="slug"
              value={slug}
              readOnly
              className="bg-surface-sunken/60 text-muted-foreground focus-visible:ring-0"
              aria-describedby="series-slug-hint"
            />
            <p id="series-slug-hint" className="text-[11px] leading-4 text-muted-foreground">
              用于系列唯一性与公开链接；需要更换别名请创建新系列。
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-description">简介</Label>
              <span className="text-[11px] text-muted-foreground">可选 · 最多 1024 个字符</span>
            </div>
            <Textarea
              id="series-description"
              name="description"
              value={description}
              rows={4}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(event) => {
                setDescription(event.target.value);
                markEdited();
              }}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">状态</legend>
            {(["ACTIVE", "ARCHIVED"] as const).map((value) => {
              const active = value === "ACTIVE";
              return (
                <label
                  key={value}
                  htmlFor={`series-status-radio-${value}`}
                  aria-label={active ? "公开中" : "已归档"}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    status === value
                      ? "border-accent-line bg-accent-soft/60"
                      : "border-border/70 bg-card hover:bg-surface-sunken/50",
                  )}
                >
                  <input
                    id={`series-status-radio-${value}`}
                    type="radio"
                    name="status"
                    value={value}
                    checked={status === value}
                    className="mt-1 h-4 w-4 accent-[hsl(var(--accent-strong))]"
                    aria-describedby={`series-status-hint-${value}`}
                    onChange={() => {
                      setStatus(value);
                      markEdited();
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {active ? "公开中" : "已归档"}
                    </span>
                    <span
                      id={`series-status-hint-${value}`}
                      className="mt-0.5 block text-[11px] leading-4 text-muted-foreground"
                    >
                      {seriesStatusDescription(value)}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          {saveState === "conflict" ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <p className="text-sm font-medium text-destructive">
                版本冲突：这个系列已在其他页面被更新，本次保存没有生效。
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                你修改的标题、简介和状态仍保留在本页。载入服务端版本会覆盖这些未保存内容，因此需要你确认。
              </p>
              {conflictReload === "confirm" || conflictReload === "loading" ? (
                <div
                  role="group"
                  aria-label="确认载入服务端版本"
                  className="mt-2 rounded-lg border border-border bg-card p-3"
                >
                  <p className="text-xs leading-5 text-foreground">
                    载入会覆盖你当前未保存的修改。确定继续吗？
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={conflictReload === "loading"}
                      onClick={() => void reloadServerAfterConflict()}
                    >
                      {conflictReload === "loading" ? "读取中…" : "确认载入"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={conflictReload === "loading"}
                      onClick={() => setConflictReload("idle")}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setConflictReload("confirm")}
                >
                  载入服务端最新内容
                </Button>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <span role="status" aria-live="polite" className="text-meta text-muted-foreground">
              {statusText}
            </span>
            <div className="flex items-center gap-2">
              <Link
                to={`/studio/series/${encodeURIComponent(id)}/articles`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                去编排章节
              </Link>
              <Button
                type="submit"
                disabled={!dirty || saveState === "saving" || saveState === "conflict"}
                data-testid="series-save"
              >
                {saveState === "saving" ? "保存中…" : "保存修改"}
              </Button>
            </div>
          </div>
          {saveMessage ? (
            <p role="status" aria-live="polite" className="text-meta text-muted-foreground">
              {saveMessage}
            </p>
          ) : null}
        </form>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/studio/series"
      className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-accent-strong hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      返回系列管理
    </Link>
  );
}
