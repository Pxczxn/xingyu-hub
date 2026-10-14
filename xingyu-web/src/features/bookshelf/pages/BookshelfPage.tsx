import { useEffect, useState } from "react";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import type { BookshelfCard } from "@/api/bookshelf/bookshelf.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

export function BookshelfPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<BookshelfCard[]>([]);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    bookshelfApi
      .list()
      .then((page) => {
        if (!active) return;
        setItems(page.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">我的书架</h1>
        <p className="lede mt-2 max-w-2xl">已订阅的系列会出现在这里。</p>
      </header>
      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <PageState
          kind="empty"
          title="暂时还没有订阅的系列"
          description="订阅系列后会显示在书架中。"
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="grid gap-3">
          {/* Display-only cards: nothing inside is clickable, so no `.card-lift`
              — a lift here would advertise a target that does not exist. */}
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="section-heading">{item.title}</h2>
              {item.summary ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {item.objectType === "SERIES" || !item.objectType ? "系列" : item.objectType}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
