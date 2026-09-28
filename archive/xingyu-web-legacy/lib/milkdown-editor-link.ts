import type { Ctx } from "@milkdown/kit/ctx";
import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { linkSchema } from "@milkdown/kit/preset/commonmark";
import type { MarkType } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";
import type { EditorLinkDraft, EditorLinkPayload } from "@/components/studio/article-editor-body-controller";
import { isLikelyUrl, normalizeLinkUrl } from "@/lib/article-editor-link-url";

type LinkRange = {
  from: number;
  to: number;
  text: string;
  href: string;
};

function getLinkMarkAt(state: EditorState, pos: number, linkType: MarkType) {
  const $pos = state.doc.resolve(Math.max(1, Math.min(pos, state.doc.content.size - 1)));
  return linkType.isInSet(state.storedMarks || $pos.marks());
}

function expandLinkRange(state: EditorState, from: number, to: number, linkType: MarkType): LinkRange | null {
  const doc = state.doc;
  const size = doc.content.size;
  const probe = from === to ? from : from;
  const mark = getLinkMarkAt(state, probe, linkType);
  if (!mark) return null;

  let rangeFrom = from;
  let rangeTo = to;

  if (from === to) {
    rangeFrom = probe;
    rangeTo = probe;
    while (rangeFrom > 0 && linkType.isInSet(doc.resolve(rangeFrom - 1).marks())) {
      rangeFrom -= 1;
    }
    while (rangeTo < size && linkType.isInSet(doc.resolve(rangeTo).marks())) {
      rangeTo += 1;
    }
  } else {
    while (rangeFrom > 0 && linkType.isInSet(doc.resolve(rangeFrom - 1).marks())) {
      rangeFrom -= 1;
    }
    while (rangeTo < size && linkType.isInSet(doc.resolve(rangeTo).marks())) {
      rangeTo += 1;
    }
  }

  return {
    from: rangeFrom,
    to: rangeTo,
    text: doc.textBetween(rangeFrom, rangeTo),
    href: String(mark.attrs.href ?? ""),
  };
}

function findLinkRangeAtSelection(state: EditorState, linkType: MarkType): LinkRange | null {
  const { from, to } = state.selection;
  const direct = expandLinkRange(state, from, to, linkType);
  if (direct) return direct;

  if (from === to) return null;

  let found: LinkRange | null = null;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const mark = linkType.isInSet(node.marks);
    if (!mark) return;
    found = {
      from: pos,
      to: pos + node.nodeSize,
      text: node.text ?? "",
      href: String(mark.attrs.href ?? ""),
    };
  });
  return found;
}

function readMilkdownLinkDraftFromCtx(ctx: Ctx): EditorLinkDraft {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const linkType = linkSchema.type(ctx);
  const { from, to, empty } = state.selection;
  const selected = state.doc.textBetween(from, to);
  const hasSelection = !empty;
  const existing = findLinkRangeAtSelection(state, linkType);

  if (existing) {
    return {
      text: existing.text,
      url: existing.href,
      hasSelection,
      isEditingLink: true,
      focusTarget: "url",
    };
  }

  const defaultUrl = hasSelection && isLikelyUrl(selected) ? normalizeLinkUrl(selected) : "";

  return {
    text: selected,
    url: defaultUrl,
    hasSelection,
    isEditingLink: false,
    focusTarget: hasSelection ? "url" : "text",
  };
}

export function readMilkdownLinkDraft(editor: Editor): EditorLinkDraft | null {
  let draft: EditorLinkDraft | null = null;
  editor.action((ctx) => {
    draft = readMilkdownLinkDraftFromCtx(ctx);
  });
  return draft;
}

export function applyMilkdownLink(editor: Editor, payload: EditorLinkPayload) {
  const normalizedUrl = normalizeLinkUrl(payload.url);
  if (!normalizedUrl) return;

  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const linkType = linkSchema.type(ctx);
    const { state, dispatch } = view;
    const existing = findLinkRangeAtSelection(state, linkType);
    const displayText =
      payload.text.trim() ||
      state.doc.textBetween(state.selection.from, state.selection.to).trim() ||
      normalizedUrl;

    if (existing) {
      let tr = state.tr;
      if (displayText !== existing.text) {
        tr = tr.insertText(displayText, existing.from, existing.to);
        const to = existing.from + displayText.length;
        tr = tr.removeMark(existing.from, to, linkType);
        tr = tr.addMark(existing.from, to, linkType.create({ href: normalizedUrl }));
      } else {
        tr = tr
          .removeMark(existing.from, existing.to, linkType)
          .addMark(existing.from, existing.to, linkType.create({ href: normalizedUrl }));
      }
      dispatch(tr.scrollIntoView());
      return;
    }

    const { from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to);

    if (from === to) {
      const tr = state.tr
        .insertText(displayText, from, to)
        .addMark(from, from + displayText.length, linkType.create({ href: normalizedUrl }));
      dispatch(tr.scrollIntoView());
      return;
    }

    let tr = state.tr;
    const nextText = payload.text.trim() || selectedText || normalizedUrl;
    if (nextText !== selectedText) {
      tr = tr.insertText(nextText, from, to);
      const end = from + nextText.length;
      tr = tr.addMark(from, end, linkType.create({ href: normalizedUrl }));
    } else {
      tr = tr.addMark(from, to, linkType.create({ href: normalizedUrl }));
    }
    dispatch(tr.scrollIntoView());
  });
}

export function removeMilkdownLink(editor: Editor) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const linkType = linkSchema.type(ctx);
    const { state, dispatch } = view;
    const existing = findLinkRangeAtSelection(state, linkType);
    if (!existing) return;
    dispatch(state.tr.removeMark(existing.from, existing.to, linkType).scrollIntoView());
  });
}
