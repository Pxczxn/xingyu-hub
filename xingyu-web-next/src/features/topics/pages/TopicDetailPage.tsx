import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicContentSort, TopicSummary } from "@/api/topics/topics.types";
import type { ContentSummary } from "@/api/common.types";
import { ContentCard } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/*
 * Topic detail (Phase 1A).
 * Real endpoints: GET /api/v1/topics/{slug}, /content, /creators.
 *
 * BACKEND GAP: the follow endpoint POST/DELETE /api/v1/follows/topics/{id}
 * returns 404 (verified during Phase 1A acceptance), so no follow control is
 * rendered. The contract remains in topicsApi for when the backend supports it.
 */
export function TopicDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();

  const [topic, setTopic] = useState<TopicSummary | null>(null);
  const [content, setContent] = useState<ContentSummary[]>([]);
  const [sort, setSort] = useState<TopicContentSort>("latest");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    topicsApi
      .getTopic(slug)
      .then((data) => {
        if (!active) return;
        setTopic(data);
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
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    topicsApi
      .getTopicContent(slug, sort, 12)
      .then((data) => {
        if (active) setContent(data);
      })
      .catch(() => {
        if (active) setContent([]);
      });
    return () => {
      active = false;
    };
  }, [slug, sort, topic?.id]);

  if (loading) return <PageState kind="loading" />;
  if (error) return <PageState kind="error" />;
  if (!topic) return <PageState kind="empty" />;

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">{topic.name}</h1>
          {topic.description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{topic.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {topic.followerCount ?? 0} 关注 · {topic.contentCount ?? 0} 内容
          </p>
        </div>

        {/*
          Follow control intentionally NOT rendered.
          Verified during Phase 1A acceptance: no working topic-follow endpoint
          (POST/DELETE /api/v1/follows/topics/{id} -> 404). The contract stays in
          topicsApi; the UI exposes it only once the backend supports it.
        */}
      </header>

      <div className="flex items-center gap-2" role="group" aria-label="内容排序">
        {(["latest", "hot"] as TopicContentSort[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              sort === key
                ? "bg-accent text-accent-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {key === "latest" ? "最新" : "热门"}
          </button>
        ))}
      </div>

      {content.length === 0 ? (
        <PageState kind="empty" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="topic-content">
          {content.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
