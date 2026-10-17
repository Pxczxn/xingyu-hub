import { useLayoutEffect, useRef } from "react";

type PositionRequest = {
  key: string;
  closing: boolean;
  anchor: HTMLElement;
  anchorTop: number;
};

function readingTop(row: HTMLElement) {
  const headerBottom = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
  const inset = parseFloat(getComputedStyle(row).paddingTop) || 0;
  return Math.max(0, headerBottom) + inset;
}

/** One cancellable measurement loop per user toggle, never a bubbling transition listener. */
export function useDiscoverPosition(expandedKey: string | null) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const pending = useRef<PositionRequest | null>(null);
  const cancel = useRef<() => void>(() => {});

  const preparePosition = (key: string, closing: boolean) => {
    cancel.current();
    const row = rowRefs.current.get(key);
    if (!row) return;
    const top = readingTop(row.querySelector<HTMLElement>("[data-discover-variant]") ?? row);
    const rect = row.getBoundingClientRect();
    // If the removed panel is above the reader, keep a visible following row in place.
    // Inside a long mobile article, restore the collapsed article's own header instead.
    const following = closing && rect.bottom <= top
      ? [...rowRefs.current.values()].find((node) => node.getBoundingClientRect().bottom > top)
      : undefined;
    const anchor = following ?? row;
    pending.current = {
      key, closing, anchor,
      anchorTop: anchor === row && closing ? Math.max(top, rect.top) : anchor.getBoundingClientRect().top,
    };
    layoutRef.current?.setAttribute("data-positioning", "true");
  };

  useLayoutEffect(() => {
    const request = pending.current;
    const layout = layoutRef.current;
    if (!request || !layout) return;
    if ((!request.closing && expandedKey !== request.key) || (request.closing && expandedKey !== null)) return;
    if (request.closing && window.matchMedia("(max-width: 1023px)").matches) {
      // Narrow layouts change height immediately (see discover.css). Compensate
      // before paint so shrinking a very long document cannot clamp it repeatedly.
      const delta = request.anchor.getBoundingClientRect().top - request.anchorTop;
      pending.current = null;
      layout.removeAttribute("data-positioning");
      if (Math.abs(delta) > 1) window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "instant" });
      return;
    }
    let frame = 0;
    let stopped = false;
    let previous: number[] = [];
    let stableFrames = 0;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (pending.current === request) {
        pending.current = null;
        layout.removeAttribute("data-positioning");
      }
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
    cancel.current = stop;
    // Observation only: user scrolling always wins. No prevented events or scroll locks.
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const measure = () => {
      if (stopped) return;
      const row = rowRefs.current.get(request.key);
      if (!row || !request.anchor.isConnected) { stop(); return; }
      const rect = row.getBoundingClientRect();
      const geometry = [rect.top + window.scrollY, rect.width, rect.height, layout.getBoundingClientRect().height];
      stableFrames = geometry.every((value, index) => Math.abs(value - previous[index]) < 0.5) ? stableFrames + 1 : 0;
      previous = geometry;
      if (stableFrames < 3) { frame = requestAnimationFrame(measure); return; }
      const top = readingTop(row.querySelector<HTMLElement>("[data-discover-variant]") ?? row);
      let delta = 0;
      if (request.closing) {
        delta = request.anchor.getBoundingClientRect().top - request.anchorTop;
      } else {
        const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]")?.getBoundingClientRect() ?? rect;
        const body = row.querySelector<HTMLElement>("[data-reading-viewport], .discover-reading-placeholder")?.getBoundingClientRect();
        const readingSpace = Math.min(body?.height ?? 0, Math.max(0, window.innerHeight - top) / 3);
        const visible = trigger.top >= top && trigger.bottom <= window.innerHeight
          && (!body || body.top + readingSpace <= window.innerHeight);
        if (!visible) delta = trigger.top - top;
      }
      stop();
      // Layout compensation is instantaneous even with motion enabled: a second smooth
      // scroll would compete with the user's next click and the browser's scroll clamp.
      if (Math.abs(delta) > 1) window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "instant" });
    };
    frame = requestAnimationFrame(measure);
    return stop;
  }, [expandedKey]);

  return { layoutRef, rowRefs, preparePosition };
}
