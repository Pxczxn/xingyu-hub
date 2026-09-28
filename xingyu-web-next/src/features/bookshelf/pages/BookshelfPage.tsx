import { useEffect, useState } from "react";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import type { BookshelfCard } from "@/api/bookshelf/bookshelf.types";
import { PageState } from "@/components/shared/PageState";

export function BookshelfPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<BookshelfCard[]>([]);

  useEffect(() => {
    let active = true;
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
  }, []);

  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">我的书架</h1>
        <p className="mt-1 text-sm text-muted-foreground">已订阅的系列会出现在这里。</p>
      </header>
      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && items.length === 0 ? (
        <PageState kind="empty" title="暂时还没有订阅的系列" description="订阅系列后会显示在书架中。" />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
              {item.summary ? <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p> : null}
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
