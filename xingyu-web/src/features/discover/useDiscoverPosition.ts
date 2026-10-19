import { useLayoutEffect, useRef } from "react";
import { smoothDamp } from "./smooth-damp";

export type PositionIntent = "open" | "switch" | "close";

type Mode = "align" | "keep" | "pin";

type PositionRequest = {
  key: string;
  intent: PositionIntent;
  /** Element whose viewport position this interaction protects. */
  anchor: HTMLElement;
  /** The anchor's viewport top at the moment the user acted. */
  anchorTop: number;
  /**
   * align: bring the newly focused reader under the sticky inset (open/switch).
   * keep: keep a visible header on screen while the rows around it resize (close).
   * pin: hold the anchor at its captured viewport position (off-screen restore).
   */
  mode: Mode;
  /** Narrow layouts align the row (their reading header is sticky); wide ones align the header. */
  alignToRow: boolean;
  /** Off-screen readers are restored before paint instead of after the animation. */
  initialSync: boolean;
  /**
   * Switch: the reader this article replaces is above it and its panel is about to
   * collapse. That height is already known, so the alignment target is fixed up
   * front instead of easing towards a position the collapse will invalidate.
   */
  alignTarget?: number;
};

/** Alignment eases in over roughly the same window as the 260ms layout transition. */
const ALIGN_SMOOTH_TIME = 0.09;
const ALIGN_TOLERANCE = 1;
const STABLE_FRAMES = 4;
const BLOCKED_FRAMES = 4;

function readingInsets(row: HTMLElement) {
  const headerBottom = Math.max(
    0,
    document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0,
  );
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

function correctionFor(mode: Mode, rect: DOMRect, anchorTop: number, headerBottom: number) {
  if (mode === "keep") {
    if (rect.top < headerBottom) return rect.top - headerBottom;
    const overflow = rect.top + rect.height - window.innerHeight;
    return overflow > 0 ? overflow : 0;
  }
  return rect.top - anchorTop;
}

/** One cancellable positioning loop per user toggle, never a transition listener. */
export function useDiscoverPosition(expandedKey: string | null) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const pending = useRef<PositionRequest | null>(null);
  const cancel = useRef<() => void>(() => {});

  const preparePosition = (key: string, intent: PositionIntent) => {
    cancel.current();
    const row = rowRefs.current.get(key);
    if (!row) return;
    const closing = intent === "close";
    const variant = row.querySelector<HTMLElement>("[data-discover-variant]") ?? row;
    const trigger = row.querySelector<HTMLElement>("[data-discover-trigger]") ?? row;
    const { top, headerBottom } = readingInsets(variant);
    const rect = row.getBoundingClientRect();
    const triggerTop = trigger.getBoundingClientRect().top;
    const narrow = window.matchMedia("(max-width: 1023px)").matches;

    if (!closing) {
      // open and switch share one intent: the new reader becomes the focus and is
      // aligned under the sticky inset, whether it was opened from the list or
      // while another article was collapsing. Narrow layouts have a sticky reading
      // toolbar, so the row itself is aligned instead of its pinned header.
      const anchor = narrow ? row : trigger;
      const anchorDocTop = anchor.getBoundingClientRect().top + window.scrollY;
      let alignTarget: number | undefined;
      if (intent === "switch") {
        // The reader being replaced is still marked expanded, so both its panel
        // height and its expanded padding are measurable before the commit. When it
        // sits above the new row, that is exactly the height that will disappear
        // from the document above it; using it as the target keeps the alignment
        // from easing downwards first and then chasing the collapse back upwards.
        const previous = document
          .querySelector<HTMLElement>('[data-discover-variant="expanded"]')
          ?.closest("li");
        const previousVariant = previous?.querySelector<HTMLElement>("[data-discover-variant]");
        let removedAbove = 0;
        if (previous && previous !== row && previous.getBoundingClientRect().top < rect.top) {
          removedAbove =
            previous.querySelector<HTMLElement>(".discover-panel")?.getBoundingClientRect()
              .height ?? 0;
        }
        // The expanded state's own padding is the same the new row is about to get.
        const expandedInset = narrow
          ? headerBottom
          : headerBottom +
            (previousVariant
              ? parseFloat(getComputedStyle(previousVariant).paddingTop) || 0
              : top - headerBottom);
        alignTarget = Math.max(0, anchorDocTop - removedAbove - expandedInset);
      }
      pending.current = {
        key,
        intent,
        anchor,
        anchorTop: anchor.getBoundingClientRect().top,
        mode: "align",
        alignToRow: narrow,
        initialSync: false,
        alignTarget,
      };
    } else if (rect.bottom <= top) {
      // The reader is entirely above the viewport (sticky collapse control on
      // narrow layouts, keyboard on wide ones). Hold the following row in place.
      const following = [...rowRefs.current.values()].find(
        (node) => node !== row && node.getBoundingClientRect().bottom > top,
      );
      const anchor = following ?? row;
      pending.current = {
        key,
        intent,
        anchor,
        anchorTop: anchor === row ? top : anchor.getBoundingClientRect().top,
        alignToRow: false,
        mode: "pin",
        initialSync: narrow,
      };
    } else if (triggerTop < headerBottom - 1) {
      // The reader's own header is already behind the sticky navigation: bring it
      // back, then keep it there while the rows above regain their normal height.
      pending.current = {
        key,
        intent,
        anchor: row,
        anchorTop: top,
        alignToRow: false,
        mode: "pin",
        initialSync: true,
      };
    } else {
      // A visible article collapses in place: the page keeps the user's position,
      // unless the restored rows above would push its header off the screen.
      pending.current = {
        key,
        intent,
        anchor: trigger,
        anchorTop: triggerTop,
        alignToRow: false,
        mode: "keep",
        initialSync: false,
      };
    }
    suspendPageAnchoring(true);
  };

  useLayoutEffect(() => {
    const request = pending.current;
    if (!request) return;
    const active = request.intent === "close" ? expandedKey === null : expandedKey === request.key;
    const finish = () => {
      if (pending.current !== request) return;
      pending.current = null;
      suspendPageAnchoring(false);
    };
    if (!active) {
      finish();
      return;
    }
    const row = rowRefs.current.get(request.key);
    if (!row) {
      finish();
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollBy = (delta: number) => {
      if (Math.abs(delta) <= 0.5) return "idle" as const;
      const before = window.scrollY;
      window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: "instant" });
      return Math.abs(window.scrollY - before) > 0.5 ? ("moved" as const) : ("blocked" as const);
    };
    if (request.initialSync) {
      scrollBy(request.anchor.getBoundingClientRect().top - request.anchorTop);
    }

    let frame = 0;
    let stopped = false;
    let previous: number[] = [];
    let stableFrames = 0;
    let blockedFrames = 0;
    let last = performance.now();
    let alignPosition = window.scrollY;
    let alignVelocity = 0;

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

    const measure = (now = performance.now()) => {
      if (stopped) return;
      if (!row.isConnected || !request.anchor.isConnected) {
        stop();
        return;
      }
      const dt = Math.min(64, Math.max(0, now - last)) / 1000;
      last = now;
      const variant = row.querySelector<HTMLElement>("[data-discover-variant]") ?? row;
      const { top, headerBottom } = readingInsets(variant);
      const anchorRect = request.anchor.getBoundingClientRect();
      const alignInset = request.alignToRow ? headerBottom : top;
      const alignError = anchorRect.top - alignInset;
      let outcome: "moved" | "blocked" | "idle" = "idle";

      if (request.mode === "align") {
        if (reducedMotion) {
          // No easing when motion is reduced: one instant placement.
          outcome = scrollBy(alignError);
        } else if (alignError < 0) {
          // The compacted rows above can move faster than the easing: never let
          // the header sit under the sticky navigation, correct it in the frame it
          // happens instead of after the animation.
          outcome = scrollBy(alignError);
          alignPosition = window.scrollY;
          alignVelocity = 0;
        } else {
          // A switch knows how much document the collapsing panel above will remove:
          // aim there while the layout runs, then finish on the measured error so a
          // slightly off estimate becomes a short ease instead of a snap.
          const target =
            request.alignTarget !== undefined && stableFrames < STABLE_FRAMES
              ? request.alignTarget
              : window.scrollY + alignError;
          const damped = smoothDamp(alignPosition, target, alignVelocity, ALIGN_SMOOTH_TIME, dt);
          alignPosition = damped.value;
          alignVelocity = damped.velocity;
          outcome = scrollBy(alignPosition - window.scrollY);
          if (outcome === "blocked") {
            alignPosition = window.scrollY;
            alignVelocity = 0;
          }
        }
      } else {
        scrollBy(correctionFor(request.mode, anchorRect, request.anchorTop, headerBottom));
      }

      const rect = row.getBoundingClientRect();
      // The document height is part of the signature: a panel collapsing below the
      // focused row still clamps the window, and that clamp must be corrected while
      // the loop is alive instead of surfacing as a late drift.
      const geometry = [
        rect.top + window.scrollY,
        rect.width,
        rect.height,
        top,
        document.documentElement.scrollHeight,
      ];
      stableFrames = geometry.every((value, index) => Math.abs(value - previous[index]) < 0.5)
        ? stableFrames + 1
        : 0;
      previous = geometry;
      if (stableFrames < STABLE_FRAMES) {
        frame = requestAnimationFrame(measure);
        return;
      }

      if (request.mode === "align" && !reducedMotion && Math.abs(alignError) > ALIGN_TOLERANCE) {
        // The layout has settled but the easing has not reached the inset yet.
        // Keep going unless the document itself cannot scroll any further.
        blockedFrames = outcome === "blocked" ? blockedFrames + 1 : 0;
        if (blockedFrames < BLOCKED_FRAMES) {
          frame = requestAnimationFrame(measure);
          return;
        }
      }
      stop();
    };
    frame = requestAnimationFrame(measure);
    return stop;
  }, [expandedKey]);

  return { rowRefs, preparePosition };
}
