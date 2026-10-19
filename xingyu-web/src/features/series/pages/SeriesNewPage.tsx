import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Wand2 } from "lucide-react";
import { seriesApi } from "@/api/series/series.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { SeriesLeaveGuard } from "../components/SeriesLeaveGuard";
import { apiErrorDetail } from "../series-labels";
import { isValidSeriesSlug, suggestSeriesSlug } from "../series-slug";

const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 1024;

type FieldErrors = {
  title?: string;
  slug?: string;
  description?: string;
};

export function SeriesNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  /* `pending` is state (drives the label); the ref closes the tiny window
     between two clicks in the same tick. */
  const pendingRef = useRef(false);

  const dirty = Boolean(title.trim() || slug.trim() || description.trim());

  useEffect(() => {
    if (!createdId) return;
    navigate(`/studio/series/${encodeURIComponent(createdId)}/edit?created=1`, {
      replace: true,
    });
  }, [createdId, navigate]);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function onTitleChange(value: string) {
    setTitle(value);
    clearFieldError("title");
    if (!slugTouched) {
      setSlug(suggestSeriesSlug(value));
      clearFieldError("slug");
    }
  }

  function regenerateSlug() {
    setSlugTouched(false);
    setSlug(suggestSeriesSlug(title));
    clearFieldError("slug");
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedTitle = title.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedTitle) {
      errors.title = "请填写标题";
    } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      errors.title = "标题不能超过 256 个字符";
    }
    if (!trimmedSlug) {
      errors.slug = "请填写别名";
    } else if (!isValidSeriesSlug(trimmedSlug)) {
      errors.slug = "别名需为 2–64 位小写字母、数字或连字符";
    }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      errors.description = "简介不能超过 1024 个字符";
    }
    return errors;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pendingRef.current) return;
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError(null);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setFieldErrors({});
    setSubmitError(null);
    try {
      const created = await seriesApi.create({
        title: title.trim(),
        slug: slug.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      /* The guard turns off through `createdId` before the effect navigates —
         otherwise the leave prompt would block our own redirect. */
      setCreatedId(created.id);
    } catch (error) {
      setSubmitError(apiErrorDetail(error, "创建失败，请稍后重试。"));
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <SeriesLeaveGuard
        when={dirty && !createdId}
        title="有未保存的系列信息"
        description="离开当前页面会丢失尚未创建的系列内容，确定要离开吗？"
      />
      <div className="section-gap">
        <div>
          <Link
            to="/studio/series"
            className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-accent-strong hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回系列管理
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">创建系列</h1>
          <p className="lede mt-1 max-w-2xl">
            先给系列一个标题和固定别名，创建后再添加章节。文章本身不会被复制或修改。
          </p>
        </div>

        <form
          onSubmit={(event) => void onSubmit(event)}
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
              disabled={pending}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="例如：星语开发日志"
              aria-invalid={fieldErrors.title ? true : undefined}
              aria-describedby={fieldErrors.title ? "series-title-error" : undefined}
              onChange={(event) => onTitleChange(event.target.value)}
            />
            {fieldErrors.title ? (
              <p id="series-title-error" className="text-xs text-destructive">
                {fieldErrors.title}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-slug">别名</Label>
              <span className="text-[11px] text-muted-foreground">必填 · 创建后不可修改</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="series-slug"
                name="slug"
                disabled={pending}
                value={slug}
                placeholder="xing-yu-kai-fa-ri-zhi"
                aria-invalid={fieldErrors.slug ? true : undefined}
                aria-describedby="series-slug-hint"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                  clearFieldError("slug");
                }}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={pending || !title.trim()}
                onClick={regenerateSlug}
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                根据标题生成
              </Button>
            </div>
            <p id="series-slug-hint" className="text-[11px] leading-4 text-muted-foreground">
              2–64 位小写字母、数字或连字符。默认根据标题生成，手动修改后不会自动覆盖。
            </p>
            {fieldErrors.slug ? (
              <p className="text-xs text-destructive">{fieldErrors.slug}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-description">简介</Label>
              <span className="text-[11px] text-muted-foreground">可选 · 最多 1024 个字符</span>
            </div>
            <Textarea
              id="series-description"
              name="description"
              disabled={pending}
              value={description}
              rows={4}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="这个系列写什么、按什么顺序读。"
              onChange={(event) => {
                setDescription(event.target.value);
                clearFieldError("description");
              }}
            />
            {fieldErrors.description ? (
              <p className="text-xs text-destructive">{fieldErrors.description}</p>
            ) : null}
          </div>

          {submitError ? (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="text-[11px] leading-4 text-muted-foreground">
              创建成功后可以继续完善信息，或直接去编排章节。新系列默认为公开中。
            </p>
            <Button type="submit" disabled={pending} className={cn("shrink-0")}>
              {pending ? "创建中…" : "创建系列"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
