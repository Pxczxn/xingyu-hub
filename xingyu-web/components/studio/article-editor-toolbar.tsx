"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Type,
  Undo2,
} from "lucide-react";
import type { ArticleBodyMode } from "@/lib/article-body-convert";
import type { EditorFormatAction } from "@/components/studio/article-editor-format-bar";
import type { EditorBlockType, EditorFormatState } from "@/lib/milkdown-editor-format-state";

type ArticleEditorToolbarProps = {
  bodyMode: ArticleBodyMode;
  formatState?: EditorFormatState | null;
  onModeChange: (mode: ArticleBodyMode) => void;
  onFormat: (action: EditorFormatAction) => void;
  onImageSelect?: (file: File) => void;
  disabled?: boolean;
};

type ToolbarAction = {
  action: EditorFormatAction;
  title: string;
  icon: typeof Bold;
  isActive?: (state: EditorFormatState | null | undefined) => boolean;
};

type BlockTypeOption = {
  blockType: EditorBlockType;
  action: EditorFormatAction;
  label: string;
  icon: typeof Type;
};

const BLOCK_TYPE_OPTIONS: BlockTypeOption[] = [
  { blockType: "paragraph", action: "paragraph", label: "正文", icon: Type },
  { blockType: "h1", action: "h1", label: "一级标题", icon: Heading1 },
  { blockType: "h2", action: "h2", label: "二级标题", icon: Heading2 },
  { blockType: "h3", action: "h3", label: "三级标题", icon: Heading3 },
  { blockType: "h4", action: "h4", label: "四级标题", icon: Heading4 },
  { blockType: "quote", action: "quote", label: "引用", icon: Quote },
  { blockType: "codeBlock", action: "codeBlock", label: "代码块", icon: SquareCode },
  { blockType: "hr", action: "hr", label: "分割线", icon: Minus },
];

const INLINE_ACTIONS: ToolbarAction[] = [
  {
    action: "bold",
    title: "加粗",
    icon: Bold,
    isActive: (state) => Boolean(state?.bold),
  },
  {
    action: "italic",
    title: "斜体",
    icon: Italic,
    isActive: (state) => Boolean(state?.italic),
  },
  {
    action: "strike",
    title: "删除线",
    icon: Strikethrough,
    isActive: (state) => Boolean(state?.strike),
  },
];

const BLOCK_ACTIONS: ToolbarAction[] = [
  {
    action: "link",
    title: "链接",
    icon: Link2,
    isActive: (state) => Boolean(state?.link),
  },
  {
    action: "code",
    title: "行内代码",
    icon: Code,
    isActive: (state) => Boolean(state?.code),
  },
  {
    action: "ul",
    title: "无序列表",
    icon: List,
    isActive: (state) => Boolean(state?.ul),
  },
  {
    action: "ol",
    title: "有序列表",
    icon: ListOrdered,
    isActive: (state) => Boolean(state?.ol),
  },
  {
    action: "taskList",
    title: "任务列表",
    icon: ListChecks,
    isActive: (state) => Boolean(state?.taskList),
  },
  {
    action: "codeBlock",
    title: "代码块",
    icon: SquareCode,
    isActive: (state) => state?.blockType === "codeBlock",
  },
  {
    action: "hr",
    title: "分割线",
    icon: Minus,
    isActive: (state) => state?.blockType === "hr",
  },
];

const HISTORY_ACTIONS: ToolbarAction[] = [
  { action: "undo", title: "撤销", icon: Undo2 },
  { action: "redo", title: "重做", icon: Redo2 },
];

function FormatButton({
  action,
  title,
  icon: Icon,
  disabled,
  active,
  onFormat,
}: ToolbarAction & {
  disabled: boolean;
  active: boolean;
  onFormat: (action: EditorFormatAction) => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={active ? "is-active cursor-pointer" : "cursor-pointer"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onFormat(action)}
    >
      <Icon className="h-4 w-4" />
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
    BLOCK_TYPE_OPTIONS.find((option) => option.blockType === currentBlockType) ??
    BLOCK_TYPE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="xy-editor-format-bar__dropdown">
      <button
        type="button"
        title="块类型"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="xy-editor-format-bar__block-type-trigger cursor-pointer"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <currentOption.icon className="h-4 w-4 shrink-0" />
        <span className="xy-editor-format-bar__block-type-label">{currentOption.label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>

      {open ? (
        <div className="xy-editor-format-dropdown-menu" role="menu" aria-label="块类型">
          {BLOCK_TYPE_OPTIONS.map(({ blockType, action, label, icon: Icon }) => {
            const active = currentBlockType === blockType;
            return (
              <button
                key={blockType}
                type="button"
                role="menuitem"
                aria-pressed={active}
                className={`xy-editor-format-dropdown-menu__item${active ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onFormat(action);
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
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
  disabled = false,
}: ArticleEditorToolbarProps) {
  const richFormatActive = bodyMode === "RICH_TEXT";

  return (
    <div className="xy-editor-toolbar-combined" role="toolbar" aria-label="正文编辑工具">
      <div className="xy-editor-body-mode" role="tablist" aria-label="正文编辑模式">
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

      <div className="xy-editor-toolbar-combined__divider" aria-hidden="true" />

      <div className="xy-editor-format-bar">
        {richFormatActive ? (
          <>
            {HISTORY_ACTIONS.map((item) => (
              <FormatButton
                key={item.action}
                {...item}
                disabled={disabled}
                active={false}
                onFormat={onFormat}
              />
            ))}
            <div className="xy-editor-toolbar-combined__divider" aria-hidden="true" />
          </>
        ) : null}

        {richFormatActive ? (
          <BlockTypeDropdown
            disabled={disabled}
            formatState={formatState}
            onFormat={onFormat}
          />
        ) : null}

        {INLINE_ACTIONS.map((item) => (
          <FormatButton
            key={item.action}
            {...item}
            disabled={disabled}
            active={richFormatActive && Boolean(item.isActive?.(formatState))}
            onFormat={onFormat}
          />
        ))}

        {richFormatActive ? (
          <FormatButton
            action="clearInlineFormat"
            title="清除行内格式"
            icon={RemoveFormatting}
            disabled={disabled}
            active={false}
            onFormat={onFormat}
          />
        ) : null}

        {bodyMode === "MARKDOWN" ? (
          <>
            <FormatButton
              action="h4"
              title="四级标题"
              icon={Heading4}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
            <FormatButton
              action="strike"
              title="删除线"
              icon={Strikethrough}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
            <FormatButton
              action="quote"
              title="引用"
              icon={Quote}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
            <FormatButton
              action="codeBlock"
              title="代码块"
              icon={SquareCode}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
            <FormatButton
              action="taskList"
              title="任务列表"
              icon={ListChecks}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
            <FormatButton
              action="hr"
              title="分割线"
              icon={Minus}
              disabled={disabled}
              active={false}
              onFormat={onFormat}
            />
          </>
        ) : null}

        {BLOCK_ACTIONS.map((item) => (
          <FormatButton
            key={item.action}
            {...item}
            disabled={disabled}
            active={richFormatActive && Boolean(item.isActive?.(formatState))}
            onFormat={onFormat}
          />
        ))}

        {onImageSelect ? (
          <label className="xy-editor-format-bar__upload cursor-pointer" title="插入图片">
            <ImagePlus className="h-4 w-4" />
            <input
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
          </label>
        ) : null}
      </div>
    </div>
  );
}
