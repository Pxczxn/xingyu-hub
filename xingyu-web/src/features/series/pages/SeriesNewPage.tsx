import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Wand2 } from "lucide-react";
import { seriesApi } from "@/api/series/series.api";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
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

/**
 * 创建系列 — SK5 流程 · H 线 / D 松 / R 齐（A §3 `/studio/*` 的 SeriesNew 行）。
 *
 * SK5 的终点只有一个动作：创建。所以提交按钮不在表单中部，而是粘在视口底部；
 * 页头是 `PageMasthead`（无面 masthead，自带 `h1`），页面不再手写标题。
 * D=松 由 `density="loose"` 提供：三个字段组各是一块独立面，卡内 24 / 块间 24。
 * R=齐：窄栏之内所有块同宽同边，没有侧轨、没有出血带。
 *
 * 不使用 `StepFlow`：它把子内容硬编码成 `density-compact`（`StepFlow.tsx:111`），
 * 会抹掉本页声明的 D=松；这里只沿用它那条粘底条的形状。
 */
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

  const GROUP = "flex flex-col gap-2 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]";

  return (
    <>
      <SeriesLeaveGuard
        when={dirty && !createdId}
        title="有未保存的系列信息"
        description="离开当前页面会丢失尚未创建的系列内容，确定要离开吗？"
      />
      <ArchetypeFrame
        skeleton="SK5"
        header="line"
        density="loose"
        headerSlot={
          <div className="flex flex-col gap-3">
            <Link
              to="/studio/series"
              className="focus-ring inline-flex w-fit items-center gap-1 rounded-sm text-meta text-accent-strong hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              返回系列管理
            </Link>
            <PageMasthead
              title="创建系列"
              description="先给系列一个标题和固定别名，创建后再添加章节。文章本身不会被复制或修改。"
            />
          </div>
        }
      >
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
          <div className={GROUP}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-title">标题</Label>
              <span className="text-caption text-muted-foreground">必填 · 最多 256 个字符</span>
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
              <p id="series-title-error" className="text-caption text-destructive">
                {fieldErrors.title}
              </p>
            ) : null}
            {/* SK5 的「为什么需要」侧注：字段自己的理由，不塞进 placeholder。 */}
            <p className="text-caption leading-5 text-muted-foreground">
              标题会出现在系列广场与公开页顶部，之后可以随时修改。
            </p>
          </div>

          <div className={GROUP}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-slug">别名</Label>
              <span className="text-caption text-muted-foreground">必填 · 创建后不可修改</span>
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
            <p id="series-slug-hint" className="text-caption leading-5 text-muted-foreground">
              2–64 位小写字母、数字或连字符。默认根据标题生成，手动修改后不会自动覆盖。
            </p>
            {fieldErrors.slug ? (
              <p className="text-caption text-destructive">{fieldErrors.slug}</p>
            ) : null}
          </div>

          <div className={GROUP}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="series-description">简介</Label>
              <span className="text-caption text-muted-foreground">可选 · 最多 1024 个字符</span>
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
              <p className="text-caption text-destructive">{fieldErrors.description}</p>
            ) : null}
          </div>

          {submitError ? (
            <p role="alert" className="text-meta text-destructive">
              {submitError}
            </p>
          ) : null}

          {/* 粘底操作条：SK5 的终点动作。边框而不是阴影（E1 只给离开文档流的浮层）。 */}
          <div className="sticky bottom-0 z-rail -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <p className="text-caption leading-5 text-muted-foreground">
              创建成功后可以继续完善信息，或直接去编排章节。新系列默认为公开中。
            </p>
            <Button type="submit" disabled={pending} className={cn("shrink-0")}>
              {pending ? "创建中…" : "创建系列"}
            </Button>
          </div>
        </form>
      </ArchetypeFrame>
    </>
  );
}
