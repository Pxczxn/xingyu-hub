import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  EditorCaretAnchor,
  EditorLinkDraft,
  EditorLinkPayload,
} from "@/lib/article-editor-body-controller";
import { ArticleEditorLinkPopover } from "./article-editor-link-popover";
import { clampLinkPopoverPosition } from "@/lib/article-editor-caret-anchor";

/*
 * Migrated from Legacy components/studio/article-editor-link-portal.tsx.
 * Adaptation: CSS module / cn import paths + local sibling import. Markup,
 * portal target and positioning behaviour are 1:1.
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

export function ArticleEditorLinkPortal({
  open,
  draft,
  anchor,
  disabled = false,
  onConfirm,
  onCancel,
  onRemoveLink,
}: ArticleEditorLinkPortalProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: anchor.top, left: anchor.left });

  const updatePosition = useCallback(() => {
    const node = popoverRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPosition(
      clampLinkPopoverPosition(anchor, {
        width: rect.width || 288,
        height: rect.height || 220,
      }),
    );
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleResize() {
      updatePosition();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-xy-link-trigger='true']")) return;
      onCancel();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onCancel, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={cn(styles.linkPopover)}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <ArticleEditorLinkPopover
        draft={draft}
        disabled={disabled}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onRemoveLink={onRemoveLink}
      />
    </div>,
    document.body,
  );
}
