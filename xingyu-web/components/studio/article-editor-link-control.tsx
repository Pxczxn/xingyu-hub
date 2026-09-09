"use client";

import { TOOLBAR_ACTIONS } from "@/lib/article-editor-toolbar-schema";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";

type ArticleEditorLinkControlProps = {
  disabled?: boolean;
  formatState?: EditorFormatState | null;
  linkPopoverOpen?: boolean;
  onLinkOpen?: () => void;
  className?: string;
  buttonClassName?: string;
};

export function ArticleEditorLinkControl({
  disabled = false,
  formatState,
  linkPopoverOpen = false,
  onLinkOpen,
  className = "xy-editor-format-bar__dropdown",
  buttonClassName = "cursor-pointer",
}: ArticleEditorLinkControlProps) {
  const item = TOOLBAR_ACTIONS.link;
  const Icon = item.icon;
  const active = linkPopoverOpen || Boolean(item.isActive?.(formatState));

  return (
    <div className={className}>
      <button
        type="button"
        title={item.title}
        disabled={disabled || !onLinkOpen}
        aria-expanded={linkPopoverOpen}
        aria-haspopup="dialog"
        aria-label={item.title}
        className={`${buttonClassName}${active ? " is-active" : ""}`}
        data-xy-link-trigger="true"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onLinkOpen?.()}
      >
        <Icon className="xy-editor-format-bar__icon" aria-hidden="true" />
      </button>
    </div>
  );
}
