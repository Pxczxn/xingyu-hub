import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { Button } from "@/components/ui/button";
import { apiErrorDetail } from "../series-labels";
import { isValidSeriesSlug, suggestSeriesSlug } from "../series-slug";

export function SeriesNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(suggestSeriesSlug(value));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedTitle) {
      setFieldError("请填写标题");
      return;
    }
    if (!isValidSeriesSlug(trimmedSlug)) {
      setFieldError("请填写合法别名");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setFieldError(null);
    setSubmitError(null);
    try {
      const payload = {
        title: trimmedTitle,
        slug: trimmedSlug,
        ...(description.trim() ? { description: description.trim() } : {}),
      };
      const created = await seriesApi.create(payload);
      navigate(`/studio/series/${encodeURIComponent(created.id)}/edit`);
    } catch (error) {
      setSubmitError(apiErrorDetail(error, "创建失败，请稍后重试。"));
      pendingRef.current = false;
    }
  }

  return (
    <div className="section-gap">
      <Link to="/studio/series" className="text-sm text-accent hover:underline">
        返回系列列表
      </Link>
      <h1 className="text-xl font-semibold text-primary">创建系列</h1>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label className="block text-sm font-medium">
          标题
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="title"
          />
        </label>
        <label className="block text-sm font-medium">
          别名
          <input
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="slug"
          />
        </label>
        <label className="block text-sm font-medium">
          简介
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="description"
            rows={3}
          />
        </label>
        {fieldError ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        ) : null}
        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}
        <Button type="submit">创建系列</Button>
      </form>
    </div>
  );
}

