import { useEffect, useMemo, useState } from "react";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { TopicsHero } from "@/features/topics/components/TopicsHero";
import { FeaturedTopics } from "@/features/topics/components/FeaturedTopics";
import { TopicCard } from "@/features/topics/components/TopicCard";

/*
 * Topics plaza (Phase 1A).
 * Real endpoint: GET /api/v1/topics.
 *
 * BACKEND GAP (verified during Phase 1A live acceptance, 2026-09-20):
 * there is no working topic-follow endpoint — POST/DELETE
 * /api/v1/follows/topics/{id|slug} both return 404 "资源不存在".
 * The contract remains implemented in topicsApi, but the follow control is
 * deliberately NOT exposed in the UI: Phase 1A must not surface functionality
 * that is known to be unavailable. Restore the control once the backend provides
 * a working endpoint (Phase 2).
 */
export function TopicsPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    topicsApi
      .getTopics()
      .then((data) => {
        if (!active) return;
        setTopics(data);
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

  const visible = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return topics;
    return topics.filter((topic) =>
      `${topic.name} ${topic.description ?? ""} ${topic.slug}`.toLowerCase().includes(text),
    );
  }, [topics, keyword]);

  const featuredTopics = useMemo(
    () =>
      topics
        .filter((topic) => (topic.contentCount ?? 0) > 0)
        .map((topic, index) => ({ topic, index }))
        .sort(
          (a, b) => (b.topic.contentCount ?? 0) - (a.topic.contentCount ?? 0) || a.index - b.index,
        )
        .slice(0, 6)
        .map(({ topic }) => topic),
    [topics],
  );

  const searching = keyword.trim().length > 0;

  return (
    <div className="section-gap gap-7">
      <TopicsHero keyword={keyword} onKeywordChange={setKeyword} />

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && topics.length === 0 ? <PageState kind="empty" /> : null}

      {!loading && !error && topics.length > 0 ? (
        <>
          {!searching ? <FeaturedTopics topics={featuredTopics} /> : null}
          <PageSection id="all-topics" title="全部话题" count={visible.length}>
            {visible.length > 0 ? (
              <ul
                className="grid list-none gap-x-6 gap-y-1 p-0 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="topic-list"
              >
                {visible.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </ul>
            ) : (
              <div
                role="status"
                className="rounded-lg border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground"
              >
                没有找到匹配的话题
              </div>
            )}
          </PageSection>
        </>
      ) : null}
    </div>
  );
}
