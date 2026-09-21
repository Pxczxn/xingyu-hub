import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { TOOLBAR_ACTIONS } from "@/lib/article-editor-toolbar-schema";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";

/*
 * Migrated from Legacy components/studio/article-editor-link-control.tsx.
 * Adaptation: CSS module import + cn path only. Markup and class usage are 1:1.
 */

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
  className,
  buttonClassName = "cursor-pointer",
}: ArticleEditorLinkControlProps) {
  const item = TOOLBAR_ACTIONS.link;
  const Icon = item.icon;
  const active = linkPopoverOpen || Boolean(item.isActive?.(formatState));

  return (
    <div className={cn(styles.formatBarDropdown, className)}>
      <button
        type="button"
        title={item.title}
        disabled={disabled || !onLinkOpen}
        aria-expanded={linkPopoverOpen}
        aria-haspopup="dialog"
        aria-label={item.title}
        className={cn(buttonClassName, active && styles.isActive)}
        data-xy-link-trigger="true"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onLinkOpen?.()}
      >
        <Icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
      </button>
    </div>
  );
}
