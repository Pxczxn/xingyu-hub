import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { PageState } from "@/components/shared/PageState";

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    announcementsApi
      .list()
      .then((data) => {
        if (!active) return;
        setItems(data);
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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-xl font-semibold text-primary">公告中心</h1>
        <Link to="/guide" className="text-sm text-accent hover:underline">
          使用指南
        </Link>
      </header>

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && items.length === 0 ? (
        <PageState kind="empty" title="暂无已发布公告" description="有新的已发布公告时会出现在这里。" />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/announcements/${encodeURIComponent(item.id)}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
              >
                <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
                {item.publishedAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">{formatPublishedAt(item.publishedAt)}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

