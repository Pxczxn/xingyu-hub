import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { Input } from "@/components/ui/input";
import { PageState } from "@/components/shared/PageState";

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

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-primary">话题广场</h1>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索话题"
          aria-label="搜索话题"
          className="sm:max-w-xs"
        />
      </header>

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && visible.length === 0 ? <PageState kind="empty" /> : null}

      {!loading && !error && visible.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="topic-list">
          {visible.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <Link to={`/topics/${topic.slug}`} className="block truncate text-sm font-medium hover:text-accent">
                  {topic.name}
                </Link>
                {topic.description ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{topic.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {topic.followerCount ?? 0} 关注 · {topic.contentCount ?? 0} 内容
                </p>
              </div>
              {/* Follow control intentionally NOT rendered — see note below. */}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
