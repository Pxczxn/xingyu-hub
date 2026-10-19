import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesSummary } from "@/api/series/series.types";

/** Rows per request. Matches the grid: two columns × four rows on desktop. */
export const SERIES_PAGE_SIZE = 8;

export type SeriesFeed = {
  items: PublicSeriesSummary[];
  /** null means the server has no next page — the only evidence that the list ended. */
  nextCursor: string | null;
  /** Real match count for the current keyword, not the loaded row count. */
  total: number | null;
  loading: boolean;
  error: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  /** Replays the first-page request (error retry). */
  reload: () => void;
  /** Appends the next page; safe to call repeatedly. */
  loadMore: () => void;
};

/**
 * One series feed = one (query, cursor) lifecycle.
 *
 * The plaza mounts two of these: the browse feed (`query` fixed at "") and the
 * search feed (driven by the debounced keyword, `enabled` only while there is
 * one). Keeping them separate is what lets clearing the search restore the
 * browse list EXACTLY as it was — including pages already loaded — instead of
 * refetching page 1 and dropping the reader back to the top.
 *
 * Why keyset instead of an offset: the server orders by `(updated_at DESC,
 * id DESC)` and returns `nextCursor`; the client never computes an offset from
 * `items.length`, so a page that arrived short can never make the list believe
 * it reached the end.
 *
 * Failure semantics:
 *   - a failed FIRST page is a page-level error (`error`), retried via `reload`;
 *   - a failed LOAD MORE keeps everything already on screen and reports
 *     `loadMoreError`; the same button retries it.
 *   - a 400 means the cursor is malformed/expired: retrying it would fail the
 *     same way, so paging stops with an explicit message instead of looping.
 *
 * Stale responses: every first-page request bumps `version`; any response whose
 * captured version no longer matches is dropped. A load-more response is
 * dropped the moment a new first page starts, so an older page can never be
 * appended to a newer result set.
 */
export function useSeriesFeed(query: string, enabled = true): SeriesFeed {
  const [items, setItems] = useState<PublicSeriesSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const version = useRef(0);
  /* A ref, not the state flag: two clicks in one tick both read the state value
     from the render that started them, so state alone cannot guard duplicates. */
  const moreInFlight = useRef(false);
  const keyword = query.trim();

  useEffect(() => {
    if (!enabled) {
      /* Deactivate without touching the other feed: this hook's data belongs to
         a keyword that is no longer being shown, so it is cleared. Re-activating
         (typing again) fetches page 1 for the new keyword. */
      setItems([]);
      setNextCursor(null);
      setTotal(null);
      setLoading(false);
      setError(false);
      setLoadingMore(false);
      setLoadMoreError(null);
      moreInFlight.current = false;
      return;
    }

    const request = version.current + 1;
    version.current = request;
    moreInFlight.current = false;
    setLoading(true);
    setError(false);
    setItems([]);
    setNextCursor(null);
    /* A stale count must not label the rows being replaced: while a new page
       loads, the honest thing to show is no count at all. */
    setTotal(null);
    setLoadMoreError(null);
    setLoadingMore(false);

    seriesApi
      .searchPublic({ q: keyword, limit: SERIES_PAGE_SIZE })
      .then((page) => {
        if (request !== version.current) return;
        setItems(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
        setTotal(typeof page.total === "number" ? page.total : null);
        setLoading(false);
      })
      .catch(() => {
        if (request !== version.current) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      /* Invalidate this run's response — but only if it is still the current
         one, otherwise the NEXT effect would invalidate itself. */
      if (version.current === request) version.current += 1;
    };
  }, [enabled, keyword, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadMore = useCallback(() => {
    if (moreInFlight.current || loading || error || !nextCursor) return;
    const request = version.current;
    moreInFlight.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    seriesApi
      .searchPublic({ q: keyword, limit: SERIES_PAGE_SIZE, cursor: nextCursor })
      .then((page) => {
        if (request !== version.current) return;
        setItems((previous) => {
          /* Dedupe by id: the cursor is a boundary, not a promise that rows did
             not move between requests. A series updated while the reader pages
             can legitimately reappear. */
          const seen = new Set(previous.map((item) => item.id));
          const fresh = (page.items ?? []).filter((item) => !seen.has(item.id));
          return [...previous, ...fresh];
        });
        setNextCursor(page.nextCursor ?? null);
        if (typeof page.total === "number") setTotal(page.total);
        setLoadingMore(false);
        moreInFlight.current = false;
      })
      .catch((err: unknown) => {
        if (request !== version.current) return;
        setLoadingMore(false);
        moreInFlight.current = false;
        if (err instanceof ApiError && err.problem.status === 400) {
          setNextCursor(null);
          setLoadMoreError("分页链接已失效，请刷新页面重新浏览。");
        } else {
          setLoadMoreError("加载更多失败，请重试。");
        }
      });
  }, [error, keyword, loading, nextCursor]);

  return {
    items,
    nextCursor,
    total,
    loading,
    error,
    loadingMore,
    loadMoreError,
    reload,
    loadMore,
  };
}
