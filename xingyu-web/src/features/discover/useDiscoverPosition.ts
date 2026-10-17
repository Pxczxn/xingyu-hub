import { useLayoutEffect, useRef } from "react";

type Mode = "clamp" | "keep" | "pin";

type PositionRequest = {
  key: string;
  closing: boolean;
  /** Element whose viewport position this interaction protects. */
  anchor: HTMLElement;
  /** The anchor's viewport top at the moment the user acted. */
  anchorTop: number;
  /**
   * clamp: only stop the header from sliding under the sticky inset.
   * keep: keep a visible header on screen while the rows around it resize.
   * pin: hold the anchor at its captured viewport position.
   */
  mode: Mode;
  /** Off-screen readers are restored before paint instead of after the animation. */
  initialSync: boolean;
};

function readingInsets(row: HTMLElement) {
  const headerBottom = Math.max(0, document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0);
  const inset = parseFloat(getComputedStyle(row).paddingTop) || 0;
  return { top: headerBottom + inset, headerBottom };
}

/*
 * Scroll anchoring is meant for feeds that append content. Here every row above
 * the reader changes height during the accordion transition, and the browser
 * silently moves the page to compensate — outside our measurements. Suspending it
 * for the duration of one toggle keeps our corrections the only scroll driver.
 */
function suspendPageAnchoring(suspended: boolean) {
  document.documentElement.style.overflowAnchor = suspended ? "none" : "";
}

/**
 * clamp: never let the header slide under the sticky inset (open).
 * keep: only follow a header that would otherwise leave the viewport (close).
 * pin: hold the captured viewport position (off-screen reader restore).
 */
function correctionFor(mode: Mode, rect: DOMRect, anchorTop: number, top: number, headerBottom: number) {
  if (mode === "clamp") return Math.min(0, rect.top - top);
  if (mode === "keep") {
    if (rect.top < headerBottom) return rect.top - headerBottom;
    const overflow = rect.top + rect.height - window.innerHeight;
    return overflow > 0 ? overflow : 0;
  }
  return rect.top - anchorTop;
}

/** One cancellable correction loop per user toggle, never a transition listener. */
export function useDiscoverPosition(expandedKey: string | null) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const pending = useRef<PositionRequest | null>(null);
  const cancel = useRef<() => void>(() => {});

  const preparePosition = (key: string, closing: boolean) => {
    cancel.current();
    const row = rowRefs.current.get(key);
    if (!row) return;
    const variant = row.querySelector<HTMLElement>("[data-discover-variant]") ?? row;
    const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]") ?? row;
    const { top, headerBottom } = readingInsets(variant);
    const rect = row.getBoundingClientRect();
    const triggerTop = trigger.getBoundingClientRect().top;
    const narrow = window.matchMedia("(max-width: 1023px)").matches;

    if (!closing) {
      // The compacted rows above pull the opened header upwards. Follow that
      // motion only as far as needed to keep the header below the sticky inset;
      // never push the page around to satisfy a layout preference.
      pending.current = {
        key, closing, anchor: trigger, anchorTop: triggerTop,
        mode: "clamp", initialSync: false,
      };
    } else if (rect.bottom <= top) {
      // The reader is entirely above the viewport (sticky collapse control on
      // narrow layouts, keyboard on wide ones). Hold the following row in place.
      const following = [...rowRefs.current.values()].find(
        (node) => node !== row && node.getBoundingClientRect().bottom > top,
      );
      const anchor = following ?? row;
      pending.current = {
        key, closing, anchor,
        anchorTop: anchor === row ? top : anchor.getBoundingClientRect().top,
        mode: "pin", initialSync: narrow,
      };
    } else if (triggerTop < headerBottom - 1) {
      // The reader's own header is already behind the sticky navigation: bring it
      // back, then keep it there while the rows above regain their normal height.
      pending.current = {
        key, closing, anchor: row, anchorTop: top, mode: "pin", initialSync: true,
      };
    } else {
      // A visible article collapses in place: the page keeps the user's position,
      // unless the restored rows above would push its header off the screen.
      pending.current = { key, closing, anchor: trigger, anchorTop: triggerTop, mode: "keep", initialSync: false };
    }
    suspendPageAnchoring(true);
  };

  useLayoutEffect(() => {
    const request = pending.current;
    if (!request) return;
    const active = request.closing ? expandedKey === null : expandedKey === request.key;
    const finish = () => {
      if (pending.current !== request) return;
      pending.current = null;
      suspendPageAnchoring(false);
    };
    if (!active) { finish(); return; }
    const row = rowRefs.current.get(request.key);
    if (!row) { finish(); return; }

    const scrollBy = (delta: number) => {
      if (Math.abs(delta) <= 1) return;
      window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "instant" });
    };
    if (request.initialSync) {
      scrollBy(request.anchor.getBoundingClientRect().top - request.anchorTop);
    }

    let frame = 0;
    let stopped = false;
    let previous: number[] = [];
    let stableFrames = 0;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      finish();
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
      if (!row.isConnected || !request.anchor.isConnected) { stop(); return; }
      const variant = row.querySelector<HTMLElement>("[data-discover-variant]") ?? row;
      const { top, headerBottom } = readingInsets(variant);
      const anchorRect = request.anchor.getBoundingClientRect();
      scrollBy(correctionFor(request.mode, anchorRect, request.anchorTop, top, headerBottom));

      const rect = row.getBoundingClientRect();
      const geometry = [rect.top + window.scrollY, rect.width, rect.height, top];
      stableFrames = geometry.every((value, index) => Math.abs(value - previous[index]) < 0.5) ? stableFrames + 1 : 0;
      previous = geometry;
      if (stableFrames < 4) { frame = requestAnimationFrame(measure); return; }
      stop();
    };
    frame = requestAnimationFrame(measure);
    return stop;
  }, [expandedKey]);

  return { rowRefs, preparePosition };
}
