import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import type {
  TopicContentSort,
  TopicCreatorSummary,
  TopicSummary,
} from "@/api/topics/topics.types";
import type { ContentSummary } from "@/api/common.types";
import { PageState } from "@/components/shared/PageState";
import type { SectionStatus } from "@/components/shared/SectionState";
import { cn } from "@/lib/cn";
import { TopicHeader } from "@/features/topics/components/TopicHeader";
import { TopicContentItem } from "@/features/topics/components/TopicContentItem";
import { TopicCreatorsPanel } from "@/features/topics/components/TopicCreatorsPanel";

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
  const [contentStatus, setContentStatus] = useState<SectionStatus>("loading");
  const [creators, setCreators] = useState<TopicCreatorSummary[]>([]);
  const [creatorsStatus, setCreatorsStatus] = useState<SectionStatus>("loading");

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
    setContentStatus("loading");
    topicsApi
      .getTopicContent(slug, sort, 12)
      .then((data) => {
        if (!active) return;
        setContent(data);
        setContentStatus(data.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!active) return;
        setContent([]);
        setContentStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug, sort, topic?.id]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setCreatorsStatus("loading");
    Promise.resolve(topicsApi.getTopicCreators(slug, 8))
      .then((data) => {
        if (!active) return;
        const next = data ?? [];
        setCreators(next);
        setCreatorsStatus(next.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (active) setCreatorsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) return <PageState kind="loading" />;
  if (error) return <PageState kind="error" />;
  if (!topic) return <PageState kind="empty" />;

  return (
    <div className="section-gap gap-5">
      <TopicHeader topic={topic} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          <div
            className="flex items-center gap-5 border-b border-border/70"
            role="group"
            aria-label="内容排序"
          >
            {(["latest", "hot"] as TopicContentSort[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={cn(
                  "border-b-2 px-0 pb-2 text-sm transition-colors",
                  sort === key
                    ? "border-accent font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary",
                )}
              >
                {key === "latest" ? "最新" : "热门"}
              </button>
            ))}
          </div>

          <section
            className="mt-3 rounded-lg border border-border/50 bg-card/70 px-4"
            data-testid="topic-content"
          >
            {contentStatus === "loading" ? (
              <PageState kind="loading" className="border-0 bg-transparent p-4" />
            ) : null}
            {contentStatus === "error" ? (
              <PageState kind="error" className="border-0 bg-transparent p-4" />
            ) : null}
            {contentStatus === "empty" ? (
              <PageState kind="empty" className="border-0 bg-transparent p-4" />
            ) : null}
            {contentStatus === "ready" ? (
              <div>
                {content.map((item) => (
                  <TopicContentItem key={item.id} item={item} />
                ))}
              </div>
            ) : null}
          </section>
        </main>

        {creatorsStatus === "ready" ? <TopicCreatorsPanel creators={creators} /> : null}
      </div>
    </div>
  );
}
