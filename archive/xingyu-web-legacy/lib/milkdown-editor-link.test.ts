import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { describe, expect, it } from "vitest";
import {
  applyMilkdownLink,
  readMilkdownLinkDraft,
  removeMilkdownLink,
} from "@/lib/milkdown-editor-link";

const CREPE_FEATURES = {
  [CrepeFeature.Toolbar]: false,
  [CrepeFeature.TopBar]: false,
  [CrepeFeature.Table]: false,
  [CrepeFeature.Latex]: false,
  [CrepeFeature.AI]: false,
  [CrepeFeature.BlockEdit]: false,
};

async function createTestEditor(defaultValue = "段落文本\n") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({
    root,
    defaultValue,
    features: CREPE_FEATURES,
  });
  await crepe.create();
  return {
    crepe,
    editor: crepe.editor,
    cleanup: async () => {
      await crepe.destroy();
      root.remove();
    },
  };
}

function selectRange(
  editor: Awaited<ReturnType<typeof createTestEditor>>["editor"],
  from: number,
  to: number,
) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
  });
}

function normalize(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").trim();
}

describe("milkdown link editor", () => {
  it("creates a markdown link from selected text", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("点击这里\n");
    selectRange(editor, 1, 5);
    applyMilkdownLink(editor, { text: "点击这里", url: "example.com" });
    expect(normalize(crepe.getMarkdown())).toBe("[点击这里](https://example.com)");
    await cleanup();
  });

  it("inserts a link at cursor when nothing is selected", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("前文\n");
    selectRange(editor, 3, 3);
    applyMilkdownLink(editor, { text: "链接文字", url: "/articles/demo" });
    expect(normalize(crepe.getMarkdown())).toBe("前文[链接文字](/articles/demo)");
    await cleanup();
  });

  it("reads and updates an existing link", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("[旧文字](https://old.test)\n");
    selectRange(editor, 2, 5);
    const draft = readMilkdownLinkDraft(editor);
    expect(draft?.isEditingLink).toBe(true);
    expect(draft?.text).toBe("旧文字");
    expect(draft?.url).toBe("https://old.test");

    applyMilkdownLink(editor, { text: "新文字", url: "https://new.test" });
    expect(normalize(crepe.getMarkdown())).toBe("[新文字](https://new.test)");
    await cleanup();
  });

  it("removes an existing link mark", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("[链接文字](https://example.com)\n");
    selectRange(editor, 2, 6);
    removeMilkdownLink(editor);
    expect(normalize(crepe.getMarkdown())).toBe("链接文字");
    await cleanup();
  });
});
