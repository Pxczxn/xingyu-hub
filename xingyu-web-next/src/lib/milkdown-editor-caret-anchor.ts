import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorCaretAnchor } from "@/lib/article-editor-caret-anchor";

export function readMilkdownCaretAnchor(editor: Editor): EditorCaretAnchor | null {
  let anchor: EditorCaretAnchor | null = null;

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    const pos = from === to ? from : to;
    const coords = view.coordsAtPos(pos);
    anchor = {
      top: coords.top,
      left: coords.left,
      height: Math.max(coords.bottom - coords.top, 18),
    };
  });

  return anchor;
}
