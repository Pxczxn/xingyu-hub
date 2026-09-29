import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import {
  COLLECTION_VISIBILITIES,
  visibilityLabel,
  type CollectionSummary,
  type CollectionVisibility,
} from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

type LoadState = "loading" | "error" | "ready";

export function CollectionsPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PRIVATE");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  function reload() {
    setLoadState("loading");
    collectionsApi
      .listMine()
      .then((data) => {
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(() => {
    let active = true;
    collectionsApi
      .listMine()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("请填写收藏夹名称");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setTitleError(null);
    setCreateError(null);
    try {
      const created = await collectionsApi.create({ title: trimmed, visibility });
      setItems((current) => [created, ...current]);
      setTitle("");
      setVisibility("PRIVATE");
      setCreating(false);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.problem.detail : "创建失败，请稍后重试。");
    } finally {
      pendingRef.current = false;
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <Button variant="outline" onClick={reload}>
          重新加载
        </Button>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">我的收藏夹</h1>
          <p className="mt-1 text-sm text-muted-foreground">按可见范围整理收藏夹。</p>
        </div>
        <Button
          variant="accent"
          onClick={() => {
            setCreating(true);
            setTitleError(null);
            setCreateError(null);
          }}
        >
          新建收藏夹
        </Button>
      </header>

      {creating ? (
        <form
          onSubmit={(event) => void onCreate(event)}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <label className="block text-sm font-medium text-foreground">
            名称
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              name="title"
              aria-invalid={Boolean(titleError)}
            />
          </label>
          {titleError ? (
            <p role="alert" className="text-sm text-destructive">
              {titleError}
            </p>
          ) : null}
          <fieldset>
            <legend className="text-sm font-medium text-foreground">可见范围</legend>
            <div className="mt-2 space-y-2">
              {COLLECTION_VISIBILITIES.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                  />
                  {visibilityLabel(value)}
                </label>
              ))}
            </div>
          </fieldset>
          {createError ? (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit">创建</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setTitle("");
                setTitleError(null);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <PageState kind="empty" title="还没有收藏夹" description="可以先新建一个收藏夹。" />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-4">
              <Link
                to={`/me/collections/${encodeURIComponent(item.id)}`}
                className="text-sm font-medium text-foreground hover:text-accent"
              >
                {item.title}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {`${visibilityLabel(item.visibility)} · ${item.itemCount} 项`}
              </p>
              {item.visibility === "PUBLIC" ? (
                <Link
                  to={`/collections/${encodeURIComponent(item.id)}`}
                  className="mt-2 inline-block text-xs text-accent hover:underline"
                >
                  公开页
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
