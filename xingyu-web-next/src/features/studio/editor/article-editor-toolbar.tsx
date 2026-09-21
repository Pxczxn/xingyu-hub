import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import { ArticleEditorLinkControl } from "./article-editor-link-control";
import type { EditorFormatAction } from "@/lib/article-editor-body-controller";
import type { EditorFormatState } from "@/lib/milkdown-editor-format-state";
import {
  ARTICLE_EDITOR_TOOLBAR_SEGMENTS,
  getToolbarMenuItems,
  TOOLBAR_ACTIONS,
  TOOLBAR_BLOCK_TYPE_OPTIONS,
  TOOLBAR_HISTORY_ACTIONS,
  TOOLBAR_INLINE_ACTIONS,
  type ToolbarActionDefinition,
  type ToolbarActionKey,
  type ToolbarMenuSegment,
} from "@/lib/article-editor-toolbar-schema";

/*
 * Migrated from Legacy components/studio/article-editor-toolbar.tsx.
 * Adaptations:
 *   1. CSS module / cn import paths + local sibling import for the link control.
 *   2. `EditorFormatAction` is imported straight from the editor core instead of
 *      via Legacy components/studio/article-editor-format-bar.tsx, which only
 *      re-exported the type. The format-bar COMPONENT is dead code in Legacy
 *      (nothing renders it) and is therefore not migrated — see report.
 * Toolbar information architecture, segments and behaviour are 1:1.
 */

const NARROW_TOOLBAR_QUERY = "(max-width: 768px)";

type ArticleEditorToolbarProps = {
  bodyMode: ArticleBodyMode;
  formatState?: EditorFormatState | null;
  onModeChange: (mode: ArticleBodyMode) => void;
  onFormat: (action: EditorFormatAction) => void;
  onImageSelect?: (file: File) => void;
  linkPopoverOpen?: boolean;
  onLinkOpen?: () => void;
  disabled?: boolean;
};

function useNarrowToolbar() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(NARROW_TOOLBAR_QUERY);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return narrow;
}

function useDismissOnOutside(open: boolean, onClose: () => void, rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open, rootRef]);
}

function FormatButton({
  item,
  disabled,
  formatState,
  onFormat,
}: {
  item: ToolbarActionDefinition;
  disabled: boolean;
  formatState?: EditorFormatState | null;
  onFormat: (action: EditorFormatAction) => void;
}) {
  const Icon = item.icon;
  const active = Boolean(item.isActive?.(formatState));
  const buttonDisabled = item.isDisabled?.(formatState, disabled) ?? disabled;

  return (
    <button
      type="button"
      title={item.title}
      disabled={buttonDisabled}
      aria-pressed={active}
      aria-label={item.title}
      className={active ? "is-active cursor-pointer" : "cursor-pointer"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onFormat(item.key as EditorFormatAction)}
    >
      <Icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
    </button>
  );
}

function BlockTypeDropdown({
  disabled,
  formatState,
  onFormat,
}: {
  disabled: boolean;
  formatState?: EditorFormatState | null;
  onFormat: (action: EditorFormatAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentBlockType = formatState?.blockType ?? "paragraph";
  const currentOption =
    TOOLBAR_BLOCK_TYPE_OPTIONS.find((option) => option.blockType === currentBlockType) ??
    TOOLBAR_BLOCK_TYPE_OPTIONS[0];

  useDismissOnOutside(open, () => setOpen(false), rootRef);

  return (
    <div ref={rootRef} className={cn(styles.formatBarDropdown)}>
      <button
        type="button"
        title={`块类型：${currentOption.label}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`块类型：${currentOption.label}`}
        className={cn(
          styles.formatBarBlockTypeTrigger,
          "cursor-pointer",
          currentBlockType !== "paragraph" && styles.isActive,
        )}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <currentOption.icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
        <ChevronDown className={cn(styles.formatBarChevron)} aria-hidden="true" />
      </button>

      {open ? (
        <div className={cn(styles.formatDropdownMenu)} role="menu" aria-label="块类型">
          {TOOLBAR_BLOCK_TYPE_OPTIONS.map(({ blockType, action, label, icon: Icon }) => {
            const active = currentBlockType === blockType;
            return (
              <button
                key={blockType}
                type="button"
                role="menuitem"
                aria-pressed={active}
                className={cn(styles.formatDropdownMenuItem, active && styles.isActive)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onFormat(action);
                  setOpen(false);
                }}
              >
                <Icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarMenu({
  segment,
  narrow,
  disabled,
  formatState,
  onFormat,
  onImageSelect,
  onLinkOpen,
}: {
  segment: ToolbarMenuSegment;
  narrow: boolean;
  disabled: boolean;
  formatState?: EditorFormatState | null;
  onFormat: (action: EditorFormatAction) => void;
  onImageSelect?: (file: File) => void;
  onLinkOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = getToolbarMenuItems(segment, narrow);
  const active = items.some((key) => Boolean(TOOLBAR_ACTIONS[key].isActive?.(formatState)));
  const TriggerIcon = segment.icon;

  useDismissOnOutside(open, () => setOpen(false), rootRef);

  function handleItemClick(key: ToolbarActionKey) {
    if (key === "imageUpload") {
      fileInputRef.current?.click();
      setOpen(false);
      return;
    }
    if (key === "link") {
      setOpen(false);
      onLinkOpen?.();
      return;
    }
    onFormat(key);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn(styles.formatBarDropdown)}>
      <button
        type="button"
        title={segment.title}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={segment.title}
        className={cn(styles.formatBarMenuTrigger, "cursor-pointer", active && styles.isActive)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <TriggerIcon className={cn(styles.formatBarIcon)} aria-hidden="true" />
        <ChevronDown className={cn(styles.formatBarChevron)} aria-hidden="true" />
      </button>

      {open ? (
        <div className={cn(styles.formatDropdownMenu)} role="menu" aria-label={segment.title}>
          {items.map((key) => {
            const item = TOOLBAR_ACTIONS[key];
            const itemActive = Boolean(item.isActive?.(formatState));
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                aria-pressed={itemActive}
                className={cn(styles.formatDropdownMenuItem, itemActive && styles.isActive)}
                data-xy-link-trigger={key === "link" ? "true" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleItemClick(key)}
              >
                <item.icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {onImageSelect && items.includes("imageUpload") ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onImageSelect(file);
          }}
        />
      ) : null}
    </div>
  );
}

export function ArticleEditorToolbar({
  bodyMode,
  formatState,
  onModeChange,
  onFormat,
  onImageSelect,
  linkPopoverOpen = false,
  onLinkOpen,
  disabled = false,
}: ArticleEditorToolbarProps) {
  const narrow = useNarrowToolbar();

  return (
    <div className={cn(styles.toolbarCombined)} role="toolbar" aria-label="正文编辑工具">
      <div
        className={cn(styles.bodyMode)}
        role="tablist"
        aria-label="正文编辑模式"
        data-active={bodyMode}
      >
        <span className={cn(styles.bodyModeIndicator)} aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={bodyMode === "MARKDOWN"}
          className={bodyMode === "MARKDOWN" ? "is-active" : ""}
          onClick={() => onModeChange("MARKDOWN")}
        >
          Markdown
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={bodyMode === "RICH_TEXT"}
          className={bodyMode === "RICH_TEXT" ? "is-active" : ""}
          onClick={() => onModeChange("RICH_TEXT")}
        >
          富文本
        </button>
      </div>

      <div className={cn(styles.toolbarCombinedDivider)} aria-hidden="true" />

      <div className={cn(styles.formatBar)}>
        {ARTICLE_EDITOR_TOOLBAR_SEGMENTS.map((segment, index) => {
          if (segment.kind === "link" && narrow) return null;

          const segmentNode = (() => {
            switch (segment.kind) {
              case "history":
                return (
                  <div className={cn(styles.formatBarGroup)} aria-label="撤销与重做">
                    {TOOLBAR_HISTORY_ACTIONS.map((item) => (
                      <FormatButton
                        key={item.key}
                        item={item}
                        disabled={disabled}
                        formatState={formatState}
                        onFormat={onFormat}
                      />
                    ))}
                  </div>
                );
              case "blockType":
                return (
                  <BlockTypeDropdown
                    disabled={disabled}
                    formatState={formatState}
                    onFormat={onFormat}
                  />
                );
              case "inline":
                return (
                  <div className={cn(styles.formatBarGroup)} aria-label="行内格式">
                    {TOOLBAR_INLINE_ACTIONS.map((item) => (
                      <FormatButton
                        key={item.key}
                        item={item}
                        disabled={disabled}
                        formatState={formatState}
                        onFormat={onFormat}
                      />
                    ))}
                  </div>
                );
              case "link":
                return (
                  <ArticleEditorLinkControl
                    disabled={disabled}
                    formatState={formatState}
                    linkPopoverOpen={linkPopoverOpen}
                    onLinkOpen={onLinkOpen}
                  />
                );
              case "menu":
                return (
                  <ToolbarMenu
                    segment={segment}
                    narrow={narrow}
                    disabled={disabled}
                    formatState={formatState}
                    onFormat={onFormat}
                    onImageSelect={onImageSelect}
                    onLinkOpen={onLinkOpen}
                  />
                );
              default:
                return null;
            }
          })();

          if (!segmentNode) return null;

          const trailingMore = segment.kind === "menu" && segment.id === "more";

          return (
            <div
              key={`${segment.kind}-${index}`}
              className={cn(
                styles.formatBarSegment,
                trailingMore && styles.formatBarSegmentTrailing,
              )}
            >
              {index > 0 ? (
                <div className={cn(styles.toolbarCombinedDivider)} aria-hidden="true" />
              ) : null}
              {segmentNode}
            </div>
          );
        })}
      </div>
    </div>
  );
}
