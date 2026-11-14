import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

/* All three tracks scroll independently, so each is keyboard reachable (A §5);
 * the rule cannot detect scrollability, hence the disable. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable tracks. */

/*
 * CanvasFrame — the three-track workbench.
 *
 * BELONGS TO: SK8 创作台 only (the article editor). It is the one archetype
 * with no content gutter at all: the shell already turns `content-shell` off
 * for the editor route, and the canvas is meant to take every pixel the two
 * rails do not.
 * AXIS: SK8 skeleton — canvas first, both side tracks are controls.
 *
 * Everything is bounded and each track scrolls on its own: the wrapper is
 * `min-h-0` + a fixed height, the grid row is `minmax(0,1fr)`, and each track
 * carries `min-h-0`. Without that trio the middle track grows with the
 * document and the outer two stop scrolling — the same defect the mailbox
 * split pane records.
 *
 * The middle track is a `<div>` holding the canvas; it is deliberately not a
 * landmark, because the canvas is the page. The two tracks are: the leading one
 * is a `role="toolbar"` (it only holds controls), the trailing one is an
 * `<aside>` named by a visually hidden heading.
 */
export type CanvasFrameProps = {
  /** Leading 48px track: tool icons. */
  toolbar: ReactNode;
  /** Trailing 320px track: inspection, metadata, preview. */
  inspector: ReactNode;
  /** The canvas. */
  children: ReactNode;
  /** Accessible name of the tool track. */
  toolbarLabel?: string;
  /** Accessible name of the inspector track. */
  inspectorLabel?: string;
  /** Below `lg`, whether the inspector is expanded. The page owns this state. */
  inspectorOpen?: boolean;
  /**
   * Below `lg`, pin the inspector over the canvas instead of laying it out
   * after the document. Desktop `lg` keeps the 320px column either way.
   * The top edge uses `--shell-header-height` plus `--xy-editor-toolbar-h`
   * (0px when the page does not set one), so it sits under the action row.
   */
  overlayInspector?: boolean;
  className?: string;
};

export function CanvasFrame({
  toolbar,
  inspector,
  children,
  toolbarLabel = "编辑工具",
  inspectorLabel = "检视",
  inspectorOpen = false,
  overlayInspector = false,
  className,
}: CanvasFrameProps) {
  const inspectorHeadingId = useId();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        "lg:grid lg:h-[calc(100dvh-var(--shell-header-height))] lg:grid-cols-[48px_minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={toolbarLabel}
        aria-orientation="vertical"
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/70 bg-card px-2 py-1 lg:h-full lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-1 lg:py-3"
      >
        {toolbar}
      </div>

      <div className="focus-ring min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto" tabIndex={0}>
        {children}
      </div>

      {/*
       * Below `lg`, `overlayInspector` takes this track out of the document.
       * A long canvas used to push the settings past the fold; pinning them
       * here shows the panel in the current viewport and scrolls inside it.
       * `ui/sheet` is not used: it is `z-drawer` over the whole viewport, so it
       * would cover the shell header and the editor action row, and it locks
       * body scroll. The `lg:` grid column above is unchanged.
       */}
      <aside
        aria-labelledby={inspectorHeadingId}
        tabIndex={0}
        className={cn(
          /*
           * `contain: paint` keeps a tall outline from extending the document
           * scroll height. The track is already `overflow-y: auto` and 780px
           * tall, but at 1440 its border box ended at the viewport while
           * documentElement.scrollHeight stayed 1587 until paint containment.
           */
          "focus-ring min-w-0 border-t border-border/70 bg-card lg:static lg:h-full lg:min-h-0 lg:overflow-y-auto lg:[contain:paint] lg:border-l lg:border-t-0 lg:shadow-none",
          inspectorOpen ? "block" : "hidden lg:block",
          inspectorOpen &&
            overlayInspector &&
            "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-[calc(var(--shell-header-height)+var(--xy-editor-toolbar-h,0px))] max-lg:z-rail max-lg:overflow-y-auto max-lg:overscroll-y-contain max-lg:[contain:paint] max-lg:shadow-floating",
        )}
      >
        <h2 id={inspectorHeadingId} className="sr-only">
          {inspectorLabel}
        </h2>
        {inspector}
      </aside>
    </div>
  );
}
