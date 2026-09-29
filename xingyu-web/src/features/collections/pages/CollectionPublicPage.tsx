import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import { visibilityLabel, type CollectionDetail } from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
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

export function CollectionPublicPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    collectionsApi
      .getById(id)
      .then((collection) => {
        if (active) setState({ kind: "ready", collection });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "unavailable" : "error" });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") return <PageState kind="error" />;
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="收藏夹不存在或暂不可访问" />;
  }

  const { collection } = state;
  const items = collection.items ?? [];

  return (
    <article className="section-gap">
      <h1 className="text-xl font-semibold text-primary">{collection.title}</h1>
      <p className="text-sm text-muted-foreground">{visibilityLabel(collection.visibility)}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂时没有收录内容</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item) => {
            const href = itemHref(item.objectType, item.objectId);
            return (
              <li key={item.id} className="px-4 py-3">
                {href ? (
                  <Link to={href} className="text-sm font-medium hover:text-accent">
                    {item.title}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{item.title}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {objectTypeLabel(item.objectType)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
