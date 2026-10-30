import { useCallback, useEffect, useRef, useState } from "react";
import type { PageResult } from "@/api/common.types";

/**
 * One keyset-paged public section of a profile.
 *
 * Two sections use this today — 公开系列 and 公开动态 — and each of the three
 * behaviours below is a bug when written the obvious way:
 *
 *  - The first page follows the profile, so it is refetched when `username`
 *    changes. A failure must degrade only this section: the retry counter is
 *    local, because replaying the page-level one would also refetch the
 *    profile and the works and flash the whole page back to loading.
 *  - "Load more" appends and de-duplicates by id. A page boundary can
 *    legitimately repeat a row, and a duplicate React key drops one of them.
 *  - A response that started before the profile changed is discarded.
 *    Otherwise a slow second page for user A appends onto user B's list.
 *
 * `load` must be stable (wrap it in `useCallback`), or the first-page effect
 * re-runs on every render.
 */
export function usePagedSection<T extends { id: string }>(
  username: string,
  load: (username: string, cursor: string | null) => Promise<PageResult<T>>,
) {
  /** `null` means "not loaded yet"; an empty array is a loaded, empty section. */
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    if (!username) return;
    let active = true;
    const current = ++version.current;
    setItems(null);
    setError(false);
    setCursor(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    load(username, null)
      .then((page) => {
        if (!active || current !== version.current) return;
        setItems(page.items ?? []);
        setCursor(page.nextCursor ?? null);
      })
      .catch(() => {
        if (active && current === version.current) setError(true);
      });
    return () => {
      active = false;
      version.current += 1;
    };
  }, [username, reloadKey, load]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const current = version.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    load(username, cursor)
      .then((page) => {
        if (current !== version.current) return;
        setItems((previous) => {
          const seen = new Set((previous ?? []).map((item) => item.id));
          return [...(previous ?? []), ...(page.items ?? []).filter((item) => !seen.has(item.id))];
        });
        setCursor(page.nextCursor ?? null);
      })
      .catch(() => {
        if (current === version.current) setLoadMoreError("加载更多失败，请重试。");
      })
      .finally(() => {
        if (current === version.current) setLoadingMore(false);
      });
  }, [cursor, loadingMore, load, username]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return { items, error, cursor, loadingMore, loadMoreError, loadMore, retry };
}
