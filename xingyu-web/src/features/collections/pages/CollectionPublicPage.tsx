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
    /*
      A collection is a CURATED SET, so it is presented as a set of cards rather
      than a table of contents.
      The old markup was `h1 + one muted line + ul.divide-y` — literally the same
      skeleton as the announcements list, which is a different thing entirely: an
      announcement list is a chronological log you scan, a collection is a
      hand-picked group you look over. Cards also give the content type a place
      to live as a badge instead of a second grey line under every title.

      The `<ul>`/`<li>` structure is kept — only the visual treatment changes, so
      the list semantics survive.
    */
    <article className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{collection.title}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta">
          <span className="text-muted-foreground">{visibilityLabel(collection.visibility)}</span>
          <span className="text-muted-foreground">
            收录{" "}
            <span className="font-medium tabular-nums text-foreground-soft">{items.length}</span> 项
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-meta text-muted-foreground"
        >
          暂时没有收录内容
        </p>
      ) : (
        <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const href = itemHref(item.objectType, item.objectId);
            const typeLabel = objectTypeLabel(item.objectType);
            return (
              <li key={item.id} className="min-w-0">
                {href ? (
                  <Link
                    to={href}
                    className="focus-ring flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-accent-line"
                  >
                    <span className="w-fit rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="line-clamp-3 text-card font-medium text-primary">
                      {item.title}
                    </span>
                  </Link>
                ) : (
                  <div className="flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-4">
                    <span className="w-fit rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="line-clamp-3 text-card font-medium text-primary">
                      {item.title}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
