import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { describe, expect, it } from "vitest";
import {
  clearMilkdownInlineFormat,
  runMilkdownFormatAction,
} from "@/lib/milkdown-editor-commands";

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

function selectAll(editor: Awaited<ReturnType<typeof createTestEditor>>["editor"]) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { doc } = view.state;
    const from = 1;
    const to = Math.max(from, doc.content.size - 1);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, from, to)));
  });
}

function normalize(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").trim();
}

describe("runMilkdownFormatAction", () => {
  it("sets heading level to H4", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("小节标题\n");
    runMilkdownFormatAction(editor, "h4");
    expect(normalize(crepe.getMarkdown())).toContain("#### 小节标题");
    await cleanup();
  });

  it("toggles strikethrough", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("删除线\n");
    selectAll(editor);
    runMilkdownFormatAction(editor, "strike");
    expect(normalize(crepe.getMarkdown())).toMatch(/~~删除线~~/);
    await cleanup();
  });

  it("creates task list items", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("待办事项\n");
    runMilkdownFormatAction(editor, "taskList");
    expect(normalize(crepe.getMarkdown())).toMatch(/[*-] \[ \]\s+待办事项/);
    await cleanup();
  });

  it("inserts horizontal rule", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("上文\n\n下文\n");
    runMilkdownFormatAction(editor, "hr");
    expect(normalize(crepe.getMarkdown())).toMatch(/^(?:-{3}|\*{3})$/m);
    await cleanup();
  });

  it("creates fenced code block", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("const x = 1\n");
    runMilkdownFormatAction(editor, "codeBlock");
    expect(normalize(crepe.getMarkdown())).toMatch(/```[\s\S]*const x = 1[\s\S]*```/);
    await cleanup();
  });

  it("undoes and redoes bold formatting", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("可撤销文本\n");
    const before = normalize(crepe.getMarkdown());
    selectAll(editor);
    runMilkdownFormatAction(editor, "bold");
    const afterBold = normalize(crepe.getMarkdown());
    expect(afterBold).toMatch(/\*\*可撤销文本\*\*/);
    expect(afterBold).not.toBe(before);

    runMilkdownFormatAction(editor, "undo");
    expect(normalize(crepe.getMarkdown())).toBe(before);

    runMilkdownFormatAction(editor, "redo");
    expect(normalize(crepe.getMarkdown())).toBe(afterBold);
    await cleanup();
  });
});

describe("clearMilkdownInlineFormat", () => {
  it("removes strikethrough mark", async () => {
    const { crepe, editor, cleanup } = await createTestEditor("~~删除~~\n");
    selectAll(editor);
    clearMilkdownInlineFormat(editor);
    const output = normalize(crepe.getMarkdown());
    expect(output).not.toMatch(/~~/);
    expect(output).toContain("删除");
    await cleanup();
  });
});
