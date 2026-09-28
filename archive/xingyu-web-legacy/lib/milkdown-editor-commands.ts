import type { Ctx } from "@milkdown/kit/ctx";
import type { Editor } from "@milkdown/kit/core";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import { lift } from "@milkdown/kit/prose/commands";
import type { EditorView } from "@milkdown/kit/prose/view";
import {
  addBlockTypeCommand,
  blockquoteSchema,
  codeBlockSchema,
  createCodeBlockCommand,
  emphasisSchema,
  headingSchema,
  hrSchema,
  inlineCodeSchema,
  insertImageCommand,
  linkSchema,
  listItemSchema,
  paragraphSchema,
  setBlockTypeCommand,
  strongSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { strikethroughSchema, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { redo, undo } from "@milkdown/kit/prose/history";
import { callCommand } from "@milkdown/kit/utils";
import type { EditorFormatAction } from "@/components/studio/article-editor-body-controller";
import type { EditorBlockType } from "@/lib/milkdown-editor-format-state";
import { isMarkActive } from "@/lib/milkdown-editor-format-state";

function liftOutOfBlockquote(ctx: Ctx, view: EditorView) {
  const blockquoteType = blockquoteSchema.type(ctx);
  let { state } = view;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { $from } = state.selection;
    let inside = false;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type === blockquoteType) inside = true;
    }
    if (!inside) break;
    if (!lift(state, view.dispatch)) break;
    state = view.state;
  }
}

export function setMilkdownBlockType(editor: Editor, blockType: EditorBlockType) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const commands = ctx.get(commandsCtx);
    const paragraph = paragraphSchema.type(ctx);
    const heading = headingSchema.type(ctx);
    const codeBlock = codeBlockSchema.type(ctx);

    if (blockType === "paragraph") {
      liftOutOfBlockquote(ctx, view);
      commands.call(setBlockTypeCommand.key, { nodeType: paragraph });
      return;
    }

    if (blockType === "quote") {
      commands.call(wrapInBlockquoteCommand.key);
      return;
    }

    if (blockType === "codeBlock") {
      const applied = commands.call(setBlockTypeCommand.key, { nodeType: codeBlock });
      if (!applied) {
        commands.call(createCodeBlockCommand.key);
      }
      return;
    }

    const level = Number(blockType.slice(1));
    liftOutOfBlockquote(ctx, view);
    commands.call(setBlockTypeCommand.key, {
      nodeType: heading,
      attrs: { level },
    });
  });
}

export function clearMilkdownInlineFormat(editor: Editor) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const commands = ctx.get(commandsCtx);
    const { state, dispatch } = view;
    const { from, to, empty } = state.selection;

    const markTypes = [
      strongSchema.type(ctx),
      emphasisSchema.type(ctx),
      strikethroughSchema.type(ctx),
      inlineCodeSchema.type(ctx),
      linkSchema.type(ctx),
    ];

    if (!empty) {
      let tr = state.tr;
      markTypes.forEach((markType) => {
        tr = tr.removeMark(from, to, markType);
      });
      dispatch(tr);
      return;
    }

    dispatch(state.tr.setStoredMarks([]));

    if (isMarkActive(ctx, strongSchema.type(ctx))) {
      commands.call(toggleStrongCommand.key);
    }
    if (isMarkActive(ctx, emphasisSchema.type(ctx))) {
      commands.call(toggleEmphasisCommand.key);
    }
    if (isMarkActive(ctx, strikethroughSchema.type(ctx))) {
      commands.call(toggleStrikethroughCommand.key);
    }
    if (isMarkActive(ctx, inlineCodeSchema.type(ctx))) {
      commands.call(toggleInlineCodeCommand.key);
    }
    if (isMarkActive(ctx, linkSchema.type(ctx))) {
      const { from: linkFrom, to: linkTo } = view.state.selection;
      view.dispatch(view.state.tr.removeMark(linkFrom, linkTo, linkSchema.type(ctx)));
    }
  });
}

export function runMilkdownFormatAction(editor: Editor, action: EditorFormatAction) {
  switch (action) {
    case "bold":
      editor.action(callCommand(toggleStrongCommand.key));
      return;
    case "italic":
      editor.action(callCommand(toggleEmphasisCommand.key));
      return;
    case "strike":
      editor.action(callCommand(toggleStrikethroughCommand.key));
      return;
    case "paragraph":
      setMilkdownBlockType(editor, "paragraph");
      return;
    case "h1":
      setMilkdownBlockType(editor, "h1");
      return;
    case "h2":
      setMilkdownBlockType(editor, "h2");
      return;
    case "h3":
      setMilkdownBlockType(editor, "h3");
      return;
    case "h4":
      setMilkdownBlockType(editor, "h4");
      return;
    case "quote":
      setMilkdownBlockType(editor, "quote");
      return;
    case "codeBlock":
      setMilkdownBlockType(editor, "codeBlock");
      return;
    case "clearInlineFormat":
      clearMilkdownInlineFormat(editor);
      return;
    case "code":
      editor.action(callCommand(toggleInlineCodeCommand.key));
      return;
    case "ul":
      editor.action(callCommand(wrapInBulletListCommand.key));
      return;
    case "ol":
      editor.action(callCommand(wrapInOrderedListCommand.key));
      return;
    case "taskList":
      editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const listItem = listItemSchema.type(ctx);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: listItem,
          attrs: { checked: false },
        });
      });
      return;
    case "hr":
      editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        const hr = hrSchema.type(ctx);
        commands.call(addBlockTypeCommand.key, { nodeType: hr });
      });
      return;
    case "undo":
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        undo(view.state, view.dispatch);
      });
      return;
    case "redo":
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        redo(view.state, view.dispatch);
      });
      return;
    case "link":
      return;
    default:
      return;
  }
}

export function insertMilkdownImage(editor: Editor, src: string, alt = "") {
  editor.action(callCommand(insertImageCommand.key, { src, alt }));
}

export function insertMilkdownCodeBlock(editor: Editor) {
  editor.action(callCommand(createCodeBlockCommand.key));
}
