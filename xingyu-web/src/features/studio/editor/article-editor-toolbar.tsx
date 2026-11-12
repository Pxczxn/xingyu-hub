import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/*
 * Radix opens a dropdown menu from `pointerdown`, while the toolbar buttons
 * have always opened theirs from `click` (the whole editor surface prevents
 * `mousedown` to keep the text selection alive). The helpers below reconcile
 * the two without double-toggling:
 *
 *  - `onPointerDown` records that Radix's own opener is about to run;
 *  - `onClick` swallows the follow-up click of that pointer sequence, and only
 *    toggles the menu itself for a bare click (keyboard/programmatic activation,
 *    and what the test environment dispatches).
 *
 * The hand-written outside-pointer/Escape dismissal that used to live here was
 * deleted in the same pass: Radix owns it now.
 */
function useMenuTriggerHandlers(toggle: () => void) {
  const pointerDownRef = useRef(false);
  return {
    onPointerDown: () => {
      pointerDownRef.current = true;
    },
    onClick: () => {
      if (pointerDownRef.current) {
        pointerDownRef.current = false;
        return;
      }
      toggle();
    },
  };
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
  const triggerHandlers = useMenuTriggerHandlers(() => setOpen((current) => !current));
  const currentBlockType = formatState?.blockType ?? "paragraph";
  const currentOption =
    TOOLBAR_BLOCK_TYPE_OPTIONS.find((option) => option.blockType === currentBlockType) ??
    TOOLBAR_BLOCK_TYPE_OPTIONS[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`块类型：${currentOption.label}`}
          disabled={disabled}
          aria-label={`块类型：${currentOption.label}`}
          className={cn(
            styles.formatBarBlockTypeTrigger,
            "cursor-pointer",
            currentBlockType !== "paragraph" && styles.isActive,
          )}
          onMouseDown={(event) => event.preventDefault()}
          {...triggerHandlers}
        >
          <currentOption.icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
          <ChevronDown className={cn(styles.formatBarChevron)} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="min-w-[9.5rem] rounded-lg border-border bg-card p-1 shadow-[0_8px_24px_hsl(var(--foreground)/0.12)]"
      >
        {TOOLBAR_BLOCK_TYPE_OPTIONS.map(({ blockType, action, label, icon: Icon }) => {
          const active = currentBlockType === blockType;
          return (
            <DropdownMenuItem
              key={blockType}
              // Keep the radiogroup semantics the hand-written menu exposed:
              // Radix still owns focus/selection, only the announced role and
              // checked state are pinned to the existing contract.
              role="menuitemradio"
              aria-checked={active}
              className={cn(
                styles.formatDropdownMenuItem,
                "focus:bg-muted focus:text-foreground",
                active && styles.isActive,
              )}
              onMouseDown={(event) => event.preventDefault()}
              onSelect={() => onFormat(action)}
            >
              <Icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
              <span>{label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const triggerHandlers = useMenuTriggerHandlers(() => setOpen((current) => !current));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = getToolbarMenuItems(segment, narrow);
  const active = items.some((key) => Boolean(TOOLBAR_ACTIONS[key].isActive?.(formatState)));
  const TriggerIcon = segment.icon;

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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={segment.title}
          disabled={disabled}
          aria-label={segment.title}
          className={cn(styles.formatBarMenuTrigger, "cursor-pointer", active && styles.isActive)}
          onMouseDown={(event) => event.preventDefault()}
          {...triggerHandlers}
        >
          <TriggerIcon className={cn(styles.formatBarIcon)} aria-hidden="true" />
          <ChevronDown className={cn(styles.formatBarChevron)} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="min-w-[9.5rem] rounded-lg border-border bg-card p-1 shadow-[0_8px_24px_hsl(var(--foreground)/0.12)]"
      >
        {items.map((key) => {
          const item = TOOLBAR_ACTIONS[key];
          const itemActive = Boolean(item.isActive?.(formatState));
          return (
            <DropdownMenuItem
              key={key}
              // Same rule as the block-type menu: keep the checkbox semantics
              // this toolbar has always exposed; Radix owns focus/selection.
              role="menuitemcheckbox"
              aria-checked={itemActive}
              className={cn(
                styles.formatDropdownMenuItem,
                "focus:bg-muted focus:text-foreground",
                itemActive && styles.isActive,
              )}
              data-xy-link-trigger={key === "link" ? "true" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onSelect={() => handleItemClick(key)}
            >
              <item.icon className={cn(styles.formatBarIcon)} aria-hidden="true" />
              <span>{item.title}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>

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
    </DropdownMenu>
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
