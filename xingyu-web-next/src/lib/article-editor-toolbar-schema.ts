import type { LucideIcon } from "lucide-react";
import {
  Bold,
  CirclePlus,
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
  MoreHorizontal,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Type,
  Undo2,
} from "lucide-react";
import type { EditorFormatAction } from "@/lib/article-editor-body-controller";
import type { EditorBlockType, EditorFormatState } from "@/lib/milkdown-editor-format-state";

/*
 * V2 adaptation (type-only; schema contents and runtime behaviour unchanged):
 * Legacy types this as `EditorFormatAction | "imageUpload"`, but the toolbar has
 * no "image" action — image insertion goes through the separate "imageUpload"
 * key (see TOOLBAR_ACTIONS below). Legacy never surfaced the mismatch because
 * its build is `vite build` with no tsc gate; V2 runs `tsc --noEmit`, so the
 * over-broad union member is excluded to match the real toolbar key space.
 */
export type ToolbarActionKey = Exclude<EditorFormatAction, "image"> | "imageUpload";

export type ToolbarBlockTypeOption = {
  blockType: EditorBlockType;
  action: EditorFormatAction;
  label: string;
  icon: LucideIcon;
};

/** Block type selector options — shared by Markdown and Rich Text. */
export const TOOLBAR_BLOCK_TYPE_OPTIONS: ToolbarBlockTypeOption[] = [
  { blockType: "paragraph", action: "paragraph", label: "正文", icon: Type },
  { blockType: "h1", action: "h1", label: "一级标题", icon: Heading1 },
  { blockType: "h2", action: "h2", label: "二级标题", icon: Heading2 },
  { blockType: "h3", action: "h3", label: "三级标题", icon: Heading3 },
  { blockType: "h4", action: "h4", label: "四级标题", icon: Heading4 },
  { blockType: "quote", action: "quote", label: "引用", icon: Quote },
];

export type ToolbarActionDefinition = {
  key: ToolbarActionKey;
  title: string;
  icon: LucideIcon;
  isActive?: (state: EditorFormatState | null | undefined) => boolean;
  isDisabled?: (state: EditorFormatState | null | undefined, disabled: boolean) => boolean;
};

export const TOOLBAR_ACTIONS: Record<ToolbarActionKey, ToolbarActionDefinition> = {
  undo: {
    key: "undo",
    title: "撤销",
    icon: Undo2,
    isDisabled: (state, disabled) => disabled || !state?.canUndo,
  },
  redo: {
    key: "redo",
    title: "重做",
    icon: Redo2,
    isDisabled: (state, disabled) => disabled || !state?.canRedo,
  },
  bold: {
    key: "bold",
    title: "加粗",
    icon: Bold,
    isActive: (state) => Boolean(state?.bold),
  },
  italic: {
    key: "italic",
    title: "斜体",
    icon: Italic,
    isActive: (state) => Boolean(state?.italic),
  },
  strike: {
    key: "strike",
    title: "删除线",
    icon: Strikethrough,
    isActive: (state) => Boolean(state?.strike),
  },
  clearInlineFormat: {
    key: "clearInlineFormat",
    title: "清除行内格式",
    icon: RemoveFormatting,
  },
  code: {
    key: "code",
    title: "行内代码",
    icon: Code,
    isActive: (state) => Boolean(state?.code),
  },
  link: {
    key: "link",
    title: "链接",
    icon: Link2,
    isActive: (state) => Boolean(state?.link),
  },
  ul: {
    key: "ul",
    title: "无序列表",
    icon: List,
    isActive: (state) => Boolean(state?.ul),
  },
  ol: {
    key: "ol",
    title: "有序列表",
    icon: ListOrdered,
    isActive: (state) => Boolean(state?.ol),
  },
  taskList: {
    key: "taskList",
    title: "任务列表",
    icon: ListChecks,
    isActive: (state) => Boolean(state?.taskList),
  },
  codeBlock: {
    key: "codeBlock",
    title: "代码块",
    icon: SquareCode,
    isActive: (state) => state?.blockType === "codeBlock",
  },
  hr: {
    key: "hr",
    title: "分割线",
    icon: Minus,
    isActive: (state) => state?.blockType === "hr",
  },
  imageUpload: {
    key: "imageUpload",
    title: "插入图片",
    icon: ImagePlus,
  },
  paragraph: { key: "paragraph", title: "正文", icon: Type },
  h1: { key: "h1", title: "一级标题", icon: Heading1 },
  h2: { key: "h2", title: "二级标题", icon: Heading2 },
  h3: { key: "h3", title: "三级标题", icon: Heading3 },
  h4: { key: "h4", title: "四级标题", icon: Heading4 },
  quote: { key: "quote", title: "引用", icon: Quote },
};

export type ToolbarHistorySegment = { kind: "history" };
export type ToolbarBlockTypeSegment = { kind: "blockType" };
export type ToolbarInlineSegment = { kind: "inline" };
export type ToolbarLinkSegment = { kind: "link"; collapseWhenNarrow: true };
export type ToolbarMenuSegment = {
  kind: "menu";
  id: "more" | "list" | "insert";
  title: string;
  icon: LucideIcon;
  items: ToolbarActionKey[];
  /** Extra items appended when the toolbar is in narrow layout. */
  narrowExtraItems?: ToolbarActionKey[];
};

export type ToolbarSegment =
  | ToolbarHistorySegment
  | ToolbarBlockTypeSegment
  | ToolbarInlineSegment
  | ToolbarLinkSegment
  | ToolbarMenuSegment;

/**
 * Shared toolbar information architecture for Markdown and Rich Text.
 * Mode switch | Undo/Redo | Block Type | Bold/Italic/Strike | Link | List | Insert | More
 */
export const ARTICLE_EDITOR_TOOLBAR_SEGMENTS: ToolbarSegment[] = [
  { kind: "history" },
  { kind: "blockType" },
  { kind: "inline" },
  { kind: "link", collapseWhenNarrow: true },
  {
    kind: "menu",
    id: "list",
    title: "列表",
    icon: List,
    items: ["ul", "ol", "taskList"],
  },
  {
    kind: "menu",
    id: "insert",
    title: "插入",
    icon: CirclePlus,
    items: ["codeBlock", "hr", "imageUpload"],
  },
  {
    kind: "menu",
    id: "more",
    title: "更多",
    icon: MoreHorizontal,
    items: ["clearInlineFormat", "code"],
    narrowExtraItems: ["link"],
  },
];

const HISTORY_KEYS: ToolbarActionKey[] = ["undo", "redo"];
const INLINE_KEYS: ToolbarActionKey[] = ["bold", "italic", "strike"];

export function getToolbarMenuItems(segment: ToolbarMenuSegment, narrow: boolean): ToolbarActionKey[] {
  if (!narrow || !segment.narrowExtraItems?.length) return segment.items;
  return [...segment.items, ...segment.narrowExtraItems];
}

export function getAllToolbarCapabilities(): ToolbarActionKey[] {
  const keys = new Set<ToolbarActionKey>();

  for (const segment of ARTICLE_EDITOR_TOOLBAR_SEGMENTS) {
    if (segment.kind === "history") {
      HISTORY_KEYS.forEach((key) => keys.add(key));
    } else if (segment.kind === "inline") {
      INLINE_KEYS.forEach((key) => keys.add(key));
    } else if (segment.kind === "link") {
      keys.add("link");
    } else if (segment.kind === "menu") {
      segment.items.forEach((key) => keys.add(key));
      segment.narrowExtraItems?.forEach((key) => keys.add(key));
    }
  }

  return Array.from(keys);
}

export const TOOLBAR_HISTORY_ACTIONS = HISTORY_KEYS.map((key) => TOOLBAR_ACTIONS[key]);
export const TOOLBAR_INLINE_ACTIONS = INLINE_KEYS.map((key) => TOOLBAR_ACTIONS[key]);
