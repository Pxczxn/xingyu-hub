import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EditorPage } from "./pages/EditorPage";
import { NEW_ARTICLE_ID } from "./editor/editor-dev-fixture";

/*
 * EditorPage (Phase 1C-1) — Editor UI + local editing.
 *
 * What these tests pin down:
 *   mount | typing | toolbar actions | undo/redo | link | outline |
 *   local editor state | mode switch | image-upload placeholder honesty
 *   | "no backend was touched"
 *
 * The page has no draft API by design, so the document starts from the
 * development fixture in editor-dev-fixture.ts. Every assertion about content
 * goes through the real textarea/inputs, i.e. the real local editing state.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderEditor(articleId = "dev-1") {
  return render(
    <MemoryRouter initialEntries={[`/studio/content/${articleId}`]}>
      <Routes>
        <Route path="/studio/content/:articleId" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function bodyTextarea(container: HTMLElement): HTMLTextAreaElement {
  const node = container.querySelector<HTMLTextAreaElement>("[data-editor-body-input]");
  if (!node) throw new Error("editor body textarea not found");
  return node;
}

/** Replace the whole body and put the caret over `[0, length)` so toolbar actions have a selection. */
function setBody(container: HTMLElement, value: string, select = true) {
  const textarea = bodyTextarea(container);
  fireEvent.change(textarea, { target: { value } });
  if (select) {
    textarea.focus();
    textarea.setSelectionRange(0, value.length);
    fireEvent.select(textarea);
  }
  return textarea;
}

function outline() {
  return screen.getByRole("complementary", { name: "文章大纲" });
}

describe("editor page mount", () => {
  it("renders the editor shell: toolbar, title, summary, body, outline, dev notice", () => {
    const { container } = renderEditor();

    expect(screen.getByRole("toolbar", { name: "正文编辑工具" })).toBeInTheDocument();
    expect(screen.getByLabelText("文章标题")).toBeInTheDocument();
    expect(screen.getByLabelText("标题")).toBeInTheDocument();
    expect(screen.getByLabelText("摘要")).toBeInTheDocument();
    expect(bodyTextarea(container)).toBeInTheDocument();
    expect(outline()).toBeInTheDocument();
    expect(container.querySelector("[data-editor-dev-notice]")).not.toBeNull();
    expect(container.querySelector("[data-editor-root]")).not.toBeNull();
  });

  it("labels the starting document as development data, never as backend data", () => {
    const { container } = renderEditor("dev-1");

    expect(screen.getByLabelText("文章标题")).toHaveValue("【开发态占位】dev-1");
    expect(bodyTextarea(container).value).toContain("开发态占位正文");
    expect(
      screen.getByText(/未接入草稿保存 \/ 自动保存 \/ 发布接口/),
    ).toBeInTheDocument();
  });

  it("starts blank on the unified /studio/content/new route", () => {
    const { container } = renderEditor(NEW_ARTICLE_ID);

    expect(screen.getByLabelText("文章标题")).toHaveValue("");
    expect(bodyTextarea(container)).toHaveValue("");
    expect(within(outline()).getByText("写几个标题，目录会自动出现")).toBeInTheDocument();
  });

  it("exposes no save / publish / submit control and calls no backend API", () => {
    const { container } = renderEditor();

    expect(screen.queryByRole("button", { name: /保存|发布|提交审核|回收站/ })).toBeNull();
    // Typing must stay purely local.
    fireEvent.change(bodyTextarea(container), { target: { value: "本地内容" } });
    expect(bodyTextarea(container)).toHaveValue("本地内容");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("local editing state", () => {
  it("updates the local document when typing in the body", () => {
    const { container } = renderEditor();
    const textarea = setBody(container, "## 新章节\n\n正文段落", false);

    expect(textarea).toHaveValue("## 新章节\n\n正文段落");
    expect(bodyTextarea(container)).toBe(textarea);
  });

  it("updates the title and summary through their own fields", () => {
    renderEditor();

    const title = screen.getByLabelText("标题") as HTMLInputElement;
    const summary = screen.getByLabelText("摘要") as HTMLTextAreaElement;

    fireEvent.change(title, { target: { value: "手写标题" } });
    fireEvent.change(summary, { target: { value: "手写摘要" } });

    expect(title).toHaveValue("手写标题");
    expect(summary).toHaveValue("手写摘要");
  });

  it("keeps the toolbar title input and the body title field in sync", () => {
    renderEditor();

    const toolbarTitle = screen.getByLabelText("文章标题") as HTMLInputElement;
    fireEvent.change(toolbarTitle, { target: { value: "同步标题" } });

    expect(screen.getByLabelText("标题")).toHaveValue("同步标题");
  });

  it("toggles inline preview without touching the source", () => {
    const { container } = renderEditor();
    const before = bodyTextarea(container).value;

    const toggle = screen.getByRole("button", { name: "预览" });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "关闭预览" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The Markdown reading pipeline renders the preview.
    expect(container.querySelector(".article-body")).not.toBeNull();
    expect(bodyTextarea(container)).toHaveValue(before);
  });
});

describe("outline", () => {
  it("derives outline entries from the local body", () => {
    renderEditor();

    const nav = outline();
    expect(within(nav).getByRole("button", { name: "开发态示例标题" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "支持的格式" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "三级小节" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "四级细节" })).toBeInTheDocument();
  });

  it("follows body edits", () => {
    const { container } = renderEditor();

    setBody(container, "# 只有一级\n\n## 只有二级\n", false);

    const nav = outline();
    expect(within(nav).getByRole("button", { name: "只有一级" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "只有二级" })).toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "三级小节" })).toBeNull();
  });

  it("marks the selected entry as active", () => {
    renderEditor();

    const nav = outline();
    const target = within(nav).getByRole("button", { name: "三级小节" });
    fireEvent.click(target);

    expect(target.className).toContain("isActive");
    expect(within(nav).getByRole("button", { name: "开发态示例标题" }).className).not.toContain(
      "isActive",
    );
  });
});

describe("toolbar actions", () => {
  it("applies inline formatting to the selection", () => {
    const { container } = renderEditor();
    setBody(container, "重点内容");

    fireEvent.click(screen.getByRole("button", { name: "加粗" }));
    expect(bodyTextarea(container)).toHaveValue("**重点内容**");

    setBody(container, "斜体内容");
    fireEvent.click(screen.getByRole("button", { name: "斜体" }));
    expect(bodyTextarea(container)).toHaveValue("*斜体内容*");

    setBody(container, "删除内容");
    fireEvent.click(screen.getByRole("button", { name: "删除线" }));
    expect(bodyTextarea(container)).toHaveValue("~~删除内容~~");
  });

  it("applies block formatting through the block-type dropdown", () => {
    const { container } = renderEditor();
    setBody(container, "小节标题");

    fireEvent.click(screen.getByRole("button", { name: /^块类型：/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "二级标题" }));

    expect(bodyTextarea(container)).toHaveValue("## 小节标题");
  });

  it("applies list formatting through the list menu", () => {
    const { container } = renderEditor();
    setBody(container, "第一项\n第二项");

    fireEvent.click(screen.getByRole("button", { name: "列表" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "无序列表" }));

    expect(bodyTextarea(container)).toHaveValue("- 第一项\n- 第二项");
  });

  it("applies quote and inline code", () => {
    const { container } = renderEditor();

    setBody(container, "被引用");
    fireEvent.click(screen.getByRole("button", { name: "块类型：正文" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "引用" }));
    expect(bodyTextarea(container)).toHaveValue("> 被引用");

    setBody(container, "code");
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "行内代码" }));
    expect(bodyTextarea(container)).toHaveValue("`code`");
  });
});

describe("undo / redo", () => {
  it("undoes and redoes a toolbar edit", async () => {
    const { container } = renderEditor();
    setBody(container, "重点内容");

    fireEvent.click(screen.getByRole("button", { name: "加粗" }));
    expect(bodyTextarea(container)).toHaveValue("**重点内容**");

    const undoButton = screen.getByRole("button", { name: "撤销" });
    await waitFor(() => expect(undoButton).toBeEnabled());
    fireEvent.click(undoButton);
    expect(bodyTextarea(container)).toHaveValue("重点内容");

    const redoButton = screen.getByRole("button", { name: "重做" });
    await waitFor(() => expect(redoButton).toBeEnabled());
    fireEvent.click(redoButton);
    expect(bodyTextarea(container)).toHaveValue("**重点内容**");
  });
});

describe("link", () => {
  it("inserts a link through the popover", async () => {
    const { container } = renderEditor();
    setBody(container, "点击这里");

    fireEvent.click(screen.getByRole("button", { name: "链接" }));

    const dialog = await screen.findByRole("dialog", { name: "编辑链接" });
    fireEvent.change(within(dialog).getByLabelText("链接地址"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认" }));

    expect(bodyTextarea(container)).toHaveValue("[点击这里](https://example.com)");
    expect(screen.queryByRole("dialog", { name: "编辑链接" })).toBeNull();
  });

  it("reopens on an existing link and can remove it", async () => {
    const { container } = renderEditor();
    const textarea = setBody(container, "[旧链接](https://old.example.com)");
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.select(textarea);

    fireEvent.click(screen.getByRole("button", { name: "链接" }));

    const dialog = await screen.findByRole("dialog", { name: "编辑链接" });
    expect(within(dialog).getByLabelText("链接地址")).toHaveValue("https://old.example.com");

    fireEvent.click(within(dialog).getByRole("button", { name: "取消链接" }));
    expect(bodyTextarea(container)).toHaveValue("旧链接");
  });

  it("cancels without touching the body", async () => {
    const { container } = renderEditor();
    setBody(container, "保持原样");

    fireEvent.click(screen.getByRole("button", { name: "链接" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑链接" });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(bodyTextarea(container)).toHaveValue("保持原样");
  });
});

describe("image upload is an honest placeholder", () => {
  it("refuses the upload, inserts nothing and never calls the backend", async () => {
    const { container } = renderEditor();
    const before = bodyTextarea(container).value;

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("开发态占位");
    expect(bodyTextarea(container)).toHaveValue(before);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("editor mode switch", () => {
  it("switches the toolbar tab state to rich text", async () => {
    const { container } = renderEditor();

    const tablist = screen.getByRole("tablist", { name: "正文编辑模式" });
    expect(tablist).toHaveAttribute("data-active", "MARKDOWN");

    fireEvent.click(screen.getByRole("tab", { name: "富文本" }));

    await waitFor(() => expect(tablist).toHaveAttribute("data-active", "RICH_TEXT"));
    // The rich-text body replaces the textarea source and mounts Milkdown.
    expect(container.querySelector(".xy-editor-milkdown")).not.toBeNull();
    expect(container.querySelector("[data-editor-body-input]")).toBeNull();
  });
});
