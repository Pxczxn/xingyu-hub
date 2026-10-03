import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail, SeriesStatus } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { apiErrorDetail, isConflictError, isNotFoundError } from "../series-labels";

type LoadState = "loading" | "error" | "notfound" | "ready";

export function SeriesEditPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<SeriesStatus>("ACTIVE");
  const [lockVersion, setLockVersion] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const pendingRef = useRef(false);

  function applyDetail(detail: SeriesDetail) {
    setTitle(detail.title);
    setSlug(detail.slug);
    setDescription(detail.description ?? "");
    setStatus(detail.status);
    setLockVersion(detail.lockVersion);
  }

  function load(seriesId: string) {
    setLoadState("loading");
    setSaveError(null);
    setConflict(false);
    seriesApi
      .getMine(seriesId)
      .then((detail) => {
        applyDetail(detail);
        setLoadState("ready");
      })
      .catch((error) => {
        setLoadState(isNotFoundError(error) ? "notfound" : "error");
      });
  }

  useEffect(() => {
    if (!id) {
      setLoadState("notfound");
      return;
    }
    load(id);
  }, [id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setSaveError(null);
    setConflict(false);
    try {
      await seriesApi.update(id, {
        title: title.trim(),
        description: description.trim(),
        status,
        lockVersion,
      });
      const fresh = await seriesApi.getMine(id);
      applyDetail(fresh);
    } catch (error) {
      setSaveError(apiErrorDetail(error, "保存失败，请稍后重试。"));
      setConflict(isConflictError(error));
    } finally {
      pendingRef.current = false;
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <BackLink />
      </div>
    );
  }
  if (loadState === "notfound") {
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

  return (
    <div className="section-gap">
      <BackLink />
      <h1 className="text-2xl font-semibold tracking-tight text-primary">编辑系列</h1>
      <form
        onSubmit={(event) => void onSave(event)}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <label className="block text-sm font-medium">
          标题
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="title"
          />
        </label>
        <label className="block text-sm font-medium">
          别名
          <input
            value={slug}
            readOnly
            className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
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
        <fieldset>
          <legend className="text-sm font-medium">状态</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="ACTIVE"
                checked={status === "ACTIVE"}
                onChange={() => setStatus("ACTIVE")}
              />
              进行中
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value="ARCHIVED"
                checked={status === "ARCHIVED"}
                onChange={() => setStatus("ARCHIVED")}
              />
              已归档
            </label>
          </div>
        </fieldset>
        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">保存</Button>
          {conflict ? (
            <Button type="button" variant="outline" onClick={() => load(id)}>
              刷新
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/studio/series" className="text-sm text-accent hover:underline">
      返回系列列表
    </Link>
  );
}
