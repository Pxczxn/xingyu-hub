import { useCallback, useRef } from "react";
import { seriesApi } from "@/api/series/series.api";

type PendingWrite = { seriesId: string; articleId: string };

/**
 * Serializes reading-progress writes for one reader page (Phase 3.1, 2026-10-19).
 *
 * WHY THIS EXISTS
 * ---------------
 * The reader records progress after a chapter has loaded, so two quick chapter
 * switches can produce two POSTs. If those requests overlap, the earlier one can
 * be processed AFTER the later one and the stored position jumps backwards to the
 * chapter the reader already left. The server has no per-write intent metadata
 * (and this round does not add any), so its upsert is last-execution-wins.
 *
 * This writer removes the race at its source: at most one request is in flight,
 * and a newer chapter is only sent after the previous request has settled. The
 * order the client sends is therefore the order the reader confirmed chapters in.
 *
 * GUARANTEE AND BOUNDARY
 * ----------------------
 * Covered: one reader page session (the same tab), including rapid A → B → C
 * switches. Only the latest still-pending chapter is sent; intermediate chapters
 * that were superseded before their turn are skipped on purpose — the position
 * must end at the chapter the reader actually stopped on.
 *
 * NOT covered: two tabs/devices on the same account, and a request whose server
 * side commits after the client already gave up on it (transport failure while
 * the server keeps processing). Ordering those needs a server-side sequence or
 * version stored per (user, series); that is a schema decision, not something a
 * client can assert.
 *
 * Writes are best-effort: one retry, then dropped. Progress must never interrupt
 * reading, and the reading-history setting is still enforced by the server.
 */
export function useSeriesProgressWriter(enabled: boolean) {
  const pendingRef = useRef<PendingWrite | null>(null);
  const inFlightRef = useRef(false);
  /* The last chapter handed to this writer. Re-renders of the same loaded
     chapter must not produce another request. */
  const lastQueuedRef = useRef<string | null>(null);

  const drain = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      while (pendingRef.current) {
        /* Take the latest pending entry. A newer chapter replaces one that has
           not been sent yet, which is why intermediate chapters can be skipped. */
        const entry = pendingRef.current;
        pendingRef.current = null;
        const key = `${entry.seriesId}:${entry.articleId}`;
        let written = false;
        for (let attempt = 0; attempt < 2 && !written; attempt++) {
          try {
            await seriesApi.recordReadingProgress(entry.seriesId, entry.articleId);
            written = true;
          } catch {
            /* Best-effort: the reader must never be blocked by a progress write. */
          }
        }
        /* If the write definitively failed, allow a later load of the same
           chapter to try again instead of remembering it as "already sent". */
        if (!written && lastQueuedRef.current === key) {
          lastQueuedRef.current = null;
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  return useCallback(
    (seriesId: string, articleId: string) => {
      if (!enabled) return;
      const key = `${seriesId}:${articleId}`;
      if (lastQueuedRef.current === key) return;
      lastQueuedRef.current = key;
      pendingRef.current = { seriesId, articleId };
      void drain();
    },
    [drain, enabled],
  );
}
