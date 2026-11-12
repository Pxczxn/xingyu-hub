import { useMemo, type RefObject } from "react";
import type {
  EditorCaretAnchor,
  EditorLinkDraft,
  EditorLinkPayload,
} from "@/lib/article-editor-body-controller";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ArticleEditorLinkPopover } from "./article-editor-link-popover";

/*
 * The link editor overlay — rewired onto `components/ui/popover` (Radix) in the
 * 浮层统一 2/3 pass.
 *
 * What changed and why:
 *
 *  1. The hand-rolled `createPortal` + window resize listener + manual
 *     `clampLinkPopoverPosition()` clamping is gone. Radix Popover already
 *     portals to <body>, flips/shifts against the viewport when there is no room
 *     below the caret (`collisionPadding`), and keeps the content attached while
 *     the page scrolls or resizes.
 *  2. The caret is not a DOM trigger — it is viewport geometry produced by
 *     `article-editor-caret-anchor.ts` (mirror-div measurement of the textarea
 *     selection). Radix's `PopoverAnchor` accepts a `virtualRef` whose
 *     `getBoundingClientRect()` returns that caret rect, which is exactly the
 *     bridge this needs: no fake trigger element, no manual `top`/`left` on the
 *     panel. (The caret-anchor helper itself is untouched and still used to
 *     produce the rect.)
 *  3. Dismissal is Radix's: Escape, focus/Escape via `onOpenChange`, and an
 *     outside press. The one exception the old overlay had is preserved: a
 *     press on the toolbar's own link control must NOT dismiss-then-reopen, so
 *     `onPointerDownOutside` cancels Radix's dismissal for that element and lets
 *     the control's own toggle close the panel.
 *
 * The panel itself (`ArticleEditorLinkPopover`) is unchanged in structure:
 * 显示文本 / 链接地址 / 取消 / 确认 / 取消链接 and the URL validation are intact.
 *
 * `ui/popover` supplies `role="dialog"` + the portal; this component only adds
 * the accessible name the editor tests (and screen readers) rely on.
 */

type ArticleEditorLinkPortalProps = {
  open: boolean;
  draft: EditorLinkDraft;
  anchor: EditorCaretAnchor;
  disabled?: boolean;
  onConfirm: (payload: EditorLinkPayload) => void;
  onCancel: () => void;
  onRemoveLink?: () => void;
};

/** The minimal shape Radix Popper measures; the caret has no DOM node. */
type CaretMeasurable = { getBoundingClientRect: () => DOMRect };

export function ArticleEditorLinkPortal({
  open,
  draft,
  anchor,
  disabled = false,
  onConfirm,
  onCancel,
  onRemoveLink,
}: ArticleEditorLinkPortalProps) {
  /*
   * `virtualRef.current` must be referentially stable for as long as the caret
   * does not move: Radix's PopperAnchor compares it on every render and a new
   * object each time would re-anchor forever.
   */
  const caretRef = useMemo<RefObject<CaretMeasurable | null>>(
    () => ({
      current: {
        getBoundingClientRect: () => new DOMRect(anchor.left, anchor.top, 0, anchor.height),
      },
    }),
    [anchor],
  );

  if (!open || typeof document === "undefined") return null;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <PopoverAnchor virtualRef={caretRef} />
      <PopoverContent
        aria-label="编辑链接"
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        // Visuals live here (not in the CSS module): the shared popover already
        // owns the portal/position/behaviour, while `.linkPopover` in
        // editor-workspace.module.css is positioned by its own `position:
        // fixed; top/left`, which would fight Radix's popper transform.
        className="w-[min(18rem,calc(100vw-2rem))] rounded-[10px] border-border bg-card p-3 shadow-[0_10px_28px_hsl(var(--foreground)/0.14)]"
        /*
         * The editor hands focus straight back to the textarea after opening
         * this panel (it owns the caret and must keep the selection alive). The
         * old hand-written overlay never treated that as "dismiss"; Radix does
         * by default for a non-modal popover, so opt out and keep dismissal to
         * Escape / outside press / the panel's own buttons.
         */
        onFocusOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-xy-link-trigger='true']")) {
            // Clicking the toolbar's link control toggles this panel shut; without
            // this the outside-press dismissal would close it and the click would
            // immediately reopen it.
            event.preventDefault();
          }
        }}
      >
        <ArticleEditorLinkPopover
          draft={draft}
          disabled={disabled}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onRemoveLink={onRemoveLink}
        />
      </PopoverContent>
    </Popover>
  );
}
