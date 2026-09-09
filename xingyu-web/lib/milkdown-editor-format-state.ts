import type { Ctx } from "@milkdown/kit/ctx";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  emphasisSchema,
  headingSchema,
  hrSchema,
  inlineCodeSchema,
  isMarkSelectedCommand,
  linkSchema,
  listItemSchema,
  orderedListSchema,
  strongSchema,
} from "@milkdown/kit/preset/commonmark";
import { strikethroughSchema } from "@milkdown/kit/preset/gfm";
import type { MarkType } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";

export type EditorBlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "quote"
  | "codeBlock"
  | "hr";

export type EditorFormatState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  ul: boolean;
  ol: boolean;
  taskList: boolean;
  blockType: EditorBlockType;
};

export const EMPTY_EDITOR_FORMAT_STATE: EditorFormatState = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  link: false,
  ul: false,
  ol: false,
  taskList: false,
  blockType: "paragraph",
};

const ACTIVE_BLOCK_CLASS = "xy-editor-block-active";

export function isMarkActive(ctx: Ctx, markType: MarkType): boolean {
  const commands = ctx.get(commandsCtx);
  if (commands.call(isMarkSelectedCommand.key, markType)) return true;

  const view = ctx.get(editorViewCtx);
  const { state } = view;

  if (state.storedMarks) {
    return state.storedMarks.some((mark) => mark.type === markType);
  }

  if (state.selection instanceof TextSelection) {
    const { $cursor } = state.selection;
    if ($cursor) {
      return $cursor.marks().some((mark) => mark.type === markType);
    }
  }

  return false;
}

function readBlockType(ctx: Ctx): EditorBlockType {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;

  let blockType: EditorBlockType = "paragraph";

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    const nodeType = node.type;

    if (nodeType === codeBlockSchema.type(ctx)) {
      return "codeBlock";
    }
    if (nodeType === hrSchema.type(ctx)) {
      return "hr";
    }
    if (nodeType === blockquoteSchema.type(ctx)) {
      blockType = "quote";
    }
    if (nodeType === headingSchema.type(ctx)) {
      const level = node.attrs.level as number;
      if (level === 1) blockType = "h1";
      else if (level === 2) blockType = "h2";
      else if (level === 3) blockType = "h3";
      else if (level === 4) blockType = "h4";
    }
  }

  return blockType;
}

export function readMilkdownFormatState(ctx: Ctx): EditorFormatState {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;

  let ul = false;
  let ol = false;
  let taskList = false;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === listItemSchema.type(ctx) && node.attrs.checked != null) {
      taskList = true;
    }
    if (node.type === bulletListSchema.type(ctx) && !taskList) ul = true;
    if (node.type === orderedListSchema.type(ctx)) ol = true;
  }

  return {
    bold: isMarkActive(ctx, strongSchema.type(ctx)),
    italic: isMarkActive(ctx, emphasisSchema.type(ctx)),
    strike: isMarkActive(ctx, strikethroughSchema.type(ctx)),
    code: isMarkActive(ctx, inlineCodeSchema.type(ctx)),
    link: isMarkActive(ctx, linkSchema.type(ctx)),
    ul,
    ol,
    taskList,
    blockType: readBlockType(ctx),
  };
}

export function syncMilkdownBlockFocus(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const editorRoot = view.dom;

  editorRoot.querySelectorAll(`.${ACTIVE_BLOCK_CLASS}`).forEach((element) => {
    element.classList.remove(ACTIVE_BLOCK_CLASS);
  });

  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (!node.isTextblock && node.type.name !== "list_item") continue;

    const pos = $from.before(depth);
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      dom.classList.add(ACTIVE_BLOCK_CLASS);
    }
    break;
  }
}

export function syncMilkdownEditorUi(ctx: Ctx): EditorFormatState {
  syncMilkdownBlockFocus(ctx);
  return readMilkdownFormatState(ctx);
}
