import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import { visibilityLabel, type CollectionDetail } from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { ArchetypeFrame, BleedBand } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * /collections/:id — 公开收藏夹（只读，任何人可看）
 *
 * 骨架（A §3 单页域表 · CollectionPublic = SK2 · 线/松/出）
 * -------------------------------------------------------
 * H=线：`PageMasthead`（无面）。标题就是收藏夹名 —— 这一页的对象是那个集合本身。
 * D=松：每个条目是一张等权卡面（类型 chip + 标题），三列从 `lg` 起。
 * R=出：首屏是一条**整幅出血带**（`BleedBand`，用负边距吃掉 `.content-shell`
 *       的 `px-4/md:px-6`，所以它比其他所有块都宽），其后立刻回到内容列。
 *       A §2 的配额是每域 ≤2 页「出」，这一域只有本页用它，稀缺性才成立。
 *
 * 页头放进出血带里，而不是「带 + 页头」两段：带是节奏装置，页头是它上面的文字，
 * 两者合成首屏第一块。母题 `motif-orbit` 只画在带里（B §7 R7：一页 ≤1 种母题，
 * 只做背景层、`aria-hidden`），正文块因此不需要第二层纹理。
 *
 * 一条留言：这一页是**只读**的。它和管理页共用 `CollectionDetail`，但这里不出现
 * 任何写控件（保存 / 删除）——测试也钉住了这一点。
 *
 * 行为未变：`getById(id)`、`reloadKey` 重试、三态 + `unavailable`（404 / 无 id）、
 * 「收藏夹不存在或暂不可访问」「暂时没有收录内容」两处文案，以及 `<ul>`/`<li>`
 * 列表语义全部保留。
 */

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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [id, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="收藏夹不存在或暂不可访问" />;
  }

  const { collection } = state;
  const items = collection.items ?? [];

  return (
    /*
      A collection is a CURATED SET, so it is presented as a set of cards rather
      than a table of contents. The old markup was `h1 + one muted line +
      ul.divide-y` — literally the same skeleton as the announcements list,
      which is a different thing entirely: an announcement list is a
      chronological log you scan, a collection is a hand-picked group you look
      over. Cards also give the content type a place to live as a badge instead
      of a second grey line under every title.

      The `<ul>`/`<li>` structure is kept — only the visual treatment changes, so
      the list semantics survive.
    */
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="loose"
      headerSlot={
        <BleedBand tone="sunken" motif="orbit">
          <PageMasthead title={collection.title} />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta">
            <span className="text-muted-foreground">{visibilityLabel(collection.visibility)}</span>
            <span className="text-muted-foreground">
              收录{" "}
              <span className="font-medium tabular-nums text-foreground-soft">
                {items.length}
              </span>{" "}
              项
            </span>
          </div>
        </BleedBand>
      }
    >
      {items.length === 0 ? (
        <p
          role="status"
          className="rounded-card border border-dashed border-border bg-card/60 px-4 py-10 text-center text-meta text-muted-foreground"
        >
          暂时没有收录内容
        </p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-[var(--density-grid-gap)] p-0 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const href = itemHref(item.objectType, item.objectId);
            const typeLabel = objectTypeLabel(item.objectType);
            return (
              <li key={item.id} className="min-w-0">
                {href ? (
                  // Whole-card target -> `.card-lift`. The former
                  // `transition-colors hover:border-accent-line` is gone on
                  // purpose: `.card-lift` already transitions `border-color` and
                  // the two rules would race on the same property.
                  <Link
                    to={href}
                    className="card-lift focus-ring flex h-full flex-col gap-2 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
                  >
                    <span className="w-fit rounded-chip bg-surface-sunken px-2 py-0.5 text-caption font-medium text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="line-clamp-3 text-h3 text-primary">{item.title}</span>
                  </Link>
                ) : (
                  <div className="flex h-full flex-col gap-2 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]">
                    <span className="w-fit rounded-chip bg-surface-sunken px-2 py-0.5 text-caption font-medium text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="line-clamp-3 text-h3 text-primary">{item.title}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ArchetypeFrame>
  );
}
