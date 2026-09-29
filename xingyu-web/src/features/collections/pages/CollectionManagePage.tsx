import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import {
  COLLECTION_VISIBILITIES,
  isCollectionVisibility,
  visibilityLabel,
  type CollectionDetail,
  type CollectionVisibility,
} from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; collection: CollectionDetail };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

function objectTypeLabel(type: string): string {
  if (type === "SERIES") return "系列";
  if (type === "MOMENT") return "动态";
  if (type === "ARTICLE") return "文章";
  return type;
}

function itemHref(objectType: string, objectId: string): string | null {
  if (objectType.toUpperCase() === "ARTICLE" && objectId)
    return `/articles/${encodeURIComponent(objectId)}`;
  return null;
}

export function CollectionManagePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PRIVATE");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const mine = await collectionsApi.listMine();
        if (!active) return;
        if (!mine.some((item) => item.id === id)) {
          setState({ kind: "notfound" });
          return;
        }
        const collection = await collectionsApi.getById(id);
        if (!active) return;
        setTitle(collection.title);
        setVisibility(
          isCollectionVisibility(collection.visibility) ? collection.visibility : "UNLISTED",
        );
        setState({ kind: "ready", collection });
      } catch (err: unknown) {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("请填写收藏夹名称");
      return;
    }
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setTitleError(null);
    setSaveError(null);
    try {
      const summary = await collectionsApi.update(id, { title: trimmed, visibility });
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              collection: {
                ...current.collection,
                title: summary.title,
                visibility: summary.visibility,
              },
            }
          : current,
      );
      setTitle(summary.title);
      if (isCollectionVisibility(summary.visibility)) setVisibility(summary.visibility);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。");
    } finally {
      pendingRef.current = false;
    }
  }

  async function onDelete() {
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setSaveError(null);
    try {
      await collectionsApi.remove(id);
      navigate("/me/collections", { replace: true });
    } catch (error) {
      setConfirmDelete(false);
      setSaveError(error instanceof ApiError ? error.problem.detail : "删除失败，请稍后重试。");
      pendingRef.current = false;
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <BackLink />
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="收藏夹不存在或暂不可访问"
          description="地址可能有误，或该收藏夹当前不可查看。"
        />
        <BackLink />
      </div>
    );
  }

  const { collection } = state;
  const items = collection.items ?? [];

  return (
    <div className="section-gap">
      <BackLink />
      <h1 className="text-xl font-semibold text-primary">{collection.title}</h1>

      <form
        onSubmit={(event) => void onSave(event)}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <label className="block text-sm font-medium">
          名称
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            name="title"
          />
        </label>
        {titleError ? (
          <p role="alert" className="text-sm text-destructive">
            {titleError}
          </p>
        ) : null}
        <fieldset>
          <legend className="text-sm font-medium">可见范围</legend>
          <div className="mt-2 space-y-2">
            {COLLECTION_VISIBILITIES.map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="manage-visibility"
                  value={value}
                  checked={visibility === value}
                  onChange={() => setVisibility(value)}
                />
                {visibilityLabel(value)}
              </label>
            ))}
          </div>
        </fieldset>
        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}
        <Button type="submit">保存</Button>
      </form>

      <section>
        <h2 className="text-sm font-semibold text-foreground">收录内容</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">暂时没有收录内容</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((item) => {
              const href = itemHref(item.objectType, item.objectId);
              return (
                <li key={item.id} className="px-4 py-3">
                  {href ? (
                    <Link
                      to={href}
                      className="text-sm font-medium text-foreground hover:text-accent"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {objectTypeLabel(item.objectType)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
          删除收藏夹
        </Button>
      </div>

      {confirmDelete ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="确认删除收藏夹"
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-sm text-foreground">确定删除这个收藏夹吗？此操作无法撤销。</p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" onClick={() => void onDelete()}>
              确认删除
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/me/collections" className="text-sm text-accent hover:underline">
      返回收藏夹列表
    </Link>
  );
}
