import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  createMemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from "react-router-dom";
import { EditorPage } from "./pages/EditorPage";
import { articlesApi } from "@/api/articles/articles.api";
import { topicsApi } from "@/api/topics/topics.api";
import { ApiError } from "@/api/client";
import type { ArticleDraft } from "@/api/articles/articles.types";
import { NEW_DRAFT_ROUTE_ID } from "@/lib/article-editor-draft";

/*
 * EditorPage suite.
 *
 * The 1C-1 editing-capability tests (typing, toolbar, undo/redo, link, outline,
 * image placeholder, mode switch) are kept and now run against a draft loaded
 * from the API. Phase 1C-2 adds draft load, dirty tracking, manual save,
 * new-draft creation and unsaved-changes protection.
 *
 * The page uses React Router's official `useBlocker`, which only works inside a
 * DATA router, so these tests mount `createMemoryRouter` — the same shape
 * src/app/App.tsx now boots with — instead of the declarative <MemoryRouter>.
 */

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    getArticle: vi.fn(),
    createDraft: vi.fn(),
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    submitForReview: vi.fn(),
    getMyArticleStatus: vi.fn(async () => "DRAFT"),
  },
}));

vi.mock("@/api/topics/topics.api", () => ({
  topicsApi: {
    getTopics: vi.fn(async () => []),
    getTopic: vi.fn(),
    getTopicContent: vi.fn(),
    getTopicCreators: vi.fn(),
    followTopic: vi.fn(),
    unfollowTopic: vi.fn(),
  },
}));

const getDraftMock = vi.mocked(articlesApi.getDraft);
const createDraftMock = vi.mocked(articlesApi.createDraft);
const saveDraftMock = vi.mocked(articlesApi.saveDraft);
const submitForReviewMock = vi.mocked(articlesApi.submitForReview);
const getMyArticleStatusMock = vi.mocked(articlesApi.getMyArticleStatus);
const getTopicsMock = vi.mocked(topicsApi.getTopics);

const DRAFT_ID = "draft-1";
const DRAFT_BODY = "# 一级标题\n\n## 二级标题\n\n正文段落\n\n### 三级小节\n";

function draftFixture(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  return {
    articleId: DRAFT_ID,
    title: "真实草稿标题",
    summary: "真实草稿摘要",
    coverUrl: null,
    bodyMode: "MARKDOWN",
    body: DRAFT_BODY,
    slug: null,
    visibility: "PRIVATE",
    categoryId: null,
    topicIds: [],
    lockVersion: 3,
    updatedAt: "2026-09-21T12:00:00Z",
    scheduledPublishAt: null,
    ...overrides,
  };
}

const TOPICS = [
  { id: "t1", slug: "ai", name: "AI" },
  { id: "t2", slug: "dev", name: "开发" },
];

function problem(status: number, detail: string, code = "UNKNOWN") {
  return new ApiError({ type: "about:blank", title: "t", status, detail, code });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderEditor(articleId = DRAFT_ID) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <LocationProbe />
            <Routes>
              <Route path="/studio/content/:articleId" element={<EditorPage />} />
              <Route path="/studio" element={<div data-testid="studio-page">创作中心</div>} />
            </Routes>
          </>
        ),
      },
    ],
    { initialEntries: [`/studio/content/${articleId}`] },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
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

function settings() {
  return screen.getByRole("complementary", { name: "发布设置" });
}

function saveButton() {
  return screen.getByRole("button", { name: "保存草稿" });
}

/** Wait until the draft has loaded and the editor shell is on screen. */
async function renderLoaded(articleId = DRAFT_ID) {
  const result = renderEditor(articleId);
  await screen.findByRole("toolbar", { name: "正文编辑工具" });
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDraftMock.mockResolvedValue(draftFixture());
  saveDraftMock.mockResolvedValue(draftFixture({ lockVersion: 4 }));
  submitForReviewMock.mockResolvedValue({ submissionId: "sub-1" });
  getMyArticleStatusMock.mockResolvedValue("DRAFT");
  getTopicsMock.mockResolvedValue(TOPICS);
});

describe("draft load", () => {
  it("shows a loading state, then loads the draft through GET /me/articles/{id}", async () => {
    renderEditor();

    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();

    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    expect(getDraftMock).toHaveBeenCalledWith(DRAFT_ID);
  });

  it("populates title, summary, body, outline and settings from the backend draft", async () => {
    const { container } = await renderLoaded();

    expect(screen.getByLabelText("文章标题")).toHaveValue("真实草稿标题");
    expect(screen.getByLabelText("标题")).toHaveValue("真实草稿标题");
    expect(screen.getByLabelText("摘要")).toHaveValue("真实草稿摘要");
    expect(bodyTextarea(container)).toHaveValue(DRAFT_BODY);

    expect(within(outline()).getByRole("button", { name: "一级标题" })).toBeInTheDocument();
    expect(within(outline()).getByRole("button", { name: "三级小节" })).toBeInTheDocument();

    expect(within(settings()).getByRole("button", { name: "私密" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(settings()).getByRole("button", { name: "#AI" })).toBeInTheDocument();
  });

  it("shows the not-found state on 404 (backend does not distinguish not-mine)", async () => {
    getDraftMock.mockRejectedValue(problem(404, "资源不存在", "NOT_FOUND"));
    renderEditor();

    expect(await screen.findByText("草稿不存在或无权编辑")).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "正文编辑工具" })).toBeNull();
  });

  it("shows the error state on a server failure", async () => {
    getDraftMock.mockRejectedValue(problem(500, "boom"));
    renderEditor();

    await waitFor(() => expect(screen.getByTestId("page-state-error")).toBeInTheDocument());
    expect(screen.queryByRole("toolbar", { name: "正文编辑工具" })).toBeNull();
  });

  it("keeps the editor usable when the topics request fails", async () => {
    getTopicsMock.mockRejectedValue(new Error("topics down"));
    const { container } = await renderLoaded();

    expect(within(settings()).getByText("暂无可选话题")).toBeInTheDocument();
    expect(bodyTextarea(container)).toHaveValue(DRAFT_BODY);
  });
});

describe("local editing state", () => {
  it("updates the local document when typing in the body", async () => {
    const { container } = await renderLoaded();
    const textarea = setBody(container, "## 新章节\n\n正文段落", false);

    expect(textarea).toHaveValue("## 新章节\n\n正文段落");
    expect(bodyTextarea(container)).toBe(textarea);
  });

  it("updates the title and summary through their own fields", async () => {
    await renderLoaded();

    const title = screen.getByLabelText("标题") as HTMLInputElement;
    const summary = screen.getByLabelText("摘要") as HTMLTextAreaElement;

    fireEvent.change(title, { target: { value: "手写标题" } });
    fireEvent.change(summary, { target: { value: "手写摘要" } });

    expect(title).toHaveValue("手写标题");
    expect(summary).toHaveValue("手写摘要");
  });

  it("keeps the toolbar title input and the body title field in sync", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("文章标题"), { target: { value: "同步标题" } });

    expect(screen.getByLabelText("标题")).toHaveValue("同步标题");
  });

  it("toggles inline preview without touching the source", async () => {
    const { container } = await renderLoaded();
    const before = bodyTextarea(container).value;

    fireEvent.click(screen.getByRole("button", { name: "预览" }));

    expect(screen.getByRole("button", { name: "关闭预览" })).toHaveAttribute("aria-pressed", "true");
    // The Markdown reading pipeline renders the preview.
    expect(container.querySelector(".article-body")).not.toBeNull();
    expect(bodyTextarea(container)).toHaveValue(before);
  });
});

describe("outline", () => {
  it("derives outline entries from the loaded body", async () => {
    await renderLoaded();

    expect(within(outline()).getByRole("button", { name: "一级标题" })).toBeInTheDocument();
    expect(within(outline()).getByRole("button", { name: "二级标题" })).toBeInTheDocument();
    expect(within(outline()).getByRole("button", { name: "三级小节" })).toBeInTheDocument();
  });

  it("follows body edits", async () => {
    const { container } = await renderLoaded();

    setBody(container, "# 只有一级\n\n## 只有二级\n", false);

    expect(within(outline()).getByRole("button", { name: "只有一级" })).toBeInTheDocument();
    expect(within(outline()).getByRole("button", { name: "只有二级" })).toBeInTheDocument();
    expect(within(outline()).queryByRole("button", { name: "三级小节" })).toBeNull();
  });

  it("marks the selected entry as active", async () => {
    await renderLoaded();

    const target = within(outline()).getByRole("button", { name: "三级小节" });
    fireEvent.click(target);

    expect(target.className).toContain("isActive");
    expect(within(outline()).getByRole("button", { name: "一级标题" }).className).not.toContain(
      "isActive",
    );
  });
});

describe("toolbar actions", () => {
  it("applies inline formatting to the selection", async () => {
    const { container } = await renderLoaded();

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

  it("applies block formatting through the block-type dropdown", async () => {
    const { container } = await renderLoaded();
    setBody(container, "小节标题");

    fireEvent.click(screen.getByRole("button", { name: /^块类型：/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "二级标题" }));

    expect(bodyTextarea(container)).toHaveValue("## 小节标题");
  });

  it("applies list formatting through the list menu", async () => {
    const { container } = await renderLoaded();
    setBody(container, "第一项\n第二项");

    fireEvent.click(screen.getByRole("button", { name: "列表" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "无序列表" }));

    expect(bodyTextarea(container)).toHaveValue("- 第一项\n- 第二项");
  });

  it("applies quote and inline code", async () => {
    const { container } = await renderLoaded();

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
    const { container } = await renderLoaded();
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
    const { container } = await renderLoaded();
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
    const { container } = await renderLoaded();
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
    const { container } = await renderLoaded();
    setBody(container, "保持原样");

    fireEvent.click(screen.getByRole("button", { name: "链接" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑链接" });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(bodyTextarea(container)).toHaveValue("保持原样");
  });
});

describe("image upload is an honest placeholder", () => {
  it("refuses the upload, inserts nothing and never calls the backend", async () => {
    const { container } = await renderLoaded();
    const before = bodyTextarea(container).value;

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 15000 });
    expect(alert.textContent).toContain("开发态占位");
    expect(bodyTextarea(container)).toHaveValue(before);
    expect(saveDraftMock).not.toHaveBeenCalled();
  });
});

describe("editor mode switch", () => {
  it("switches the toolbar tab state to rich text", async () => {
    const { container } = await renderLoaded();

    const tablist = screen.getByRole("tablist", { name: "正文编辑模式" });
    expect(tablist).toHaveAttribute("data-active", "MARKDOWN");

    fireEvent.click(screen.getByRole("tab", { name: "富文本" }));

    await waitFor(() => expect(tablist).toHaveAttribute("data-active", "RICH_TEXT"));
    expect(container.querySelector(".xy-editor-milkdown")).not.toBeNull();
    expect(container.querySelector("[data-editor-body-input]")).toBeNull();
  });
});

describe("rich text drafts", () => {
  /*
   * Scope note: the "mount-time re-serialization must not dirty the editor"
   * behaviour (see EditorPage.handleRichTextSettle) can NOT be asserted here.
   * In jsdom, Crepe does not emit the initial `markdownUpdated`, so the
   * normalization that makes a freshly loaded RICH_TEXT draft dirty never
   * happens in this environment — a test asserting "clean after mount" would
   * pass with or without the fix. That behaviour is verified in the real-browser
   * runtime acceptance instead (see the phase report); what is covered here is
   * everything that IS deterministic in jsdom.
   */
  it("loads a RICH_TEXT draft in rich mode, dirties on edit and saves as RICH_TEXT", async () => {
    getDraftMock.mockResolvedValue(
      draftFixture({
        bodyMode: "RICH_TEXT",
        body: "# [WEB-V2 TEST] 标题\n\n带 [方括号] 与 snake_case 的正文。\n",
      }),
    );
    saveDraftMock.mockResolvedValue(draftFixture({ bodyMode: "RICH_TEXT", lockVersion: 4 }));

    const { container } = renderEditor();
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    expect(screen.getByRole("tablist", { name: "正文编辑模式" })).toHaveAttribute(
      "data-active",
      "RICH_TEXT",
    );

    // The rich-text surface replaces the textarea and renders the loaded body.
    await waitFor(
      () =>
        expect(
          container.querySelector(".xy-editor-milkdown .ProseMirror")?.textContent ?? "",
        ).toContain("方括号"),
      { timeout: 15000 },
    );
    expect(container.querySelector("[data-editor-body-input]")).toBeNull();

    // The dirty machinery works in rich-text mode.
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "改过的标题" } });
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();

    // Saving keeps the draft in RICH_TEXT — no silent downgrade to MARKDOWN.
    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(saveDraftMock.mock.calls[0][1].bodyMode).toBe("RICH_TEXT");
  }, 40000);
});

describe("dirty state", () => {
  it("starts clean: no dirty marker and the save button is available", async () => {
    await renderLoaded();

    expect(screen.queryByText("有未保存的修改")).toBeNull();
    expect(saveButton()).toBeEnabled();
  });

  it("becomes dirty after an edit and returns to clean when the value is reverted", async () => {
    const { container } = await renderLoaded();
    const title = screen.getByLabelText("标题");

    fireEvent.change(title, { target: { value: "改过的标题" } });
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "真实草稿标题" } });
    expect(screen.queryByText("有未保存的修改")).toBeNull();

    fireEvent.change(bodyTextarea(container), { target: { value: "改过的正文" } });
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    fireEvent.change(bodyTextarea(container), { target: { value: DRAFT_BODY } });
    expect(screen.queryByText("有未保存的修改")).toBeNull();
  });

  it("becomes dirty when settings change and returns to clean when reverted", async () => {
    await renderLoaded();

    fireEvent.click(within(settings()).getByRole("button", { name: "公开" }));
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();

    fireEvent.click(within(settings()).getByRole("button", { name: "私密" }));
    expect(screen.queryByText("有未保存的修改")).toBeNull();

    fireEvent.click(within(settings()).getByRole("button", { name: "#AI" }));
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    fireEvent.click(within(settings()).getByRole("button", { name: "#AI" }));
    expect(screen.queryByText("有未保存的修改")).toBeNull();
  });
});

describe("manual save", () => {
  it("sends exactly the editable fields plus the loaded lockVersion", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "保存后的标题" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    expect(saveDraftMock).toHaveBeenCalledWith(DRAFT_ID, {
      title: "保存后的标题",
      summary: "真实草稿摘要",
      body: DRAFT_BODY,
      bodyMode: "MARKDOWN",
      visibility: "PRIVATE",
      topicIds: [],
      lockVersion: 3,
    });
  });

  it("shows the saving state while the request is in flight", async () => {
    const pending = deferred<ArticleDraft>();
    saveDraftMock.mockReturnValue(pending.promise);
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "进行中" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("正在保存…")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await act(async () => {
      pending.resolve(draftFixture({ lockVersion: 4 }));
    });
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });

  it("clears dirty and adopts the new lockVersion after a successful save", async () => {
    saveDraftMock.mockResolvedValue(draftFixture({ lockVersion: 4 }));
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "第一次保存" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.queryByText("有未保存的修改")).toBeNull();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "第二次保存" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(2));
    expect(saveDraftMock.mock.calls[1][1].lockVersion).toBe(4);
  });

  it("keeps the local content and stays dirty when the save fails, then retries", async () => {
    saveDraftMock.mockRejectedValueOnce(problem(500, "服务器开小差了"));
    const { container } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "失败也不能丢" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "失败也不能丢的正文" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("保存失败")).toBeInTheDocument();
    expect(screen.getByText("服务器开小差了")).toBeInTheDocument();
    // Local editing content is untouched and still dirty.
    expect(screen.getByLabelText("标题")).toHaveValue("失败也不能丢");
    expect(bodyTextarea(container)).toHaveValue("失败也不能丢的正文");
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    saveDraftMock.mockResolvedValue(draftFixture({ lockVersion: 4 }));
    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.getByLabelText("标题")).toHaveValue("失败也不能丢");
  });

  it("surfaces a 409 conflict without losing local content", async () => {
    saveDraftMock.mockRejectedValue(problem(409, "草稿已被他人更新，请刷新后重试", "CONFLICT"));
    const { container } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "并发冲突" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("草稿已被他人更新，请刷新后重试")).toBeInTheDocument();
    expect(screen.getByLabelText("标题")).toHaveValue("并发冲突");
    expect(bodyTextarea(container)).toHaveValue(DRAFT_BODY);
  });

  it("saves the settings the user changed", async () => {
    await renderLoaded();

    fireEvent.click(within(settings()).getByRole("button", { name: "不收录" }));
    fireEvent.click(within(settings()).getByRole("button", { name: "#AI" }));
    fireEvent.click(within(settings()).getByRole("button", { name: "#开发" }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveDraftMock).toHaveBeenCalledTimes(1));
    expect(saveDraftMock.mock.calls[0][1]).toMatchObject({
      visibility: "UNLISTED",
      topicIds: ["t1", "t2"],
      lockVersion: 3,
    });
  });

  it("does not autosave: nothing is sent until the button is pressed", async () => {
    // Load first with REAL timers — Testing Library's waitFor polls with timers,
    // so enabling fake timers before the async render would deadlock the test.
    const { container } = await renderLoaded();

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("标题"), { target: { value: "只改不存" } });
      fireEvent.change(bodyTextarea(container), { target: { value: "只改不存" } });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(saveDraftMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("new draft lifecycle (/studio/content/new)", () => {
  const NEW_ID = "fresh-9";

  it("mounts a local blank editor without touching the backend", async () => {
    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);

    await screen.findByRole("toolbar", { name: "正文编辑工具" });

    // Entering the editor must NOT mint a draft.
    expect(createDraftMock).not.toHaveBeenCalled();
    expect(getDraftMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${NEW_DRAFT_ROUTE_ID}`);
    expect(screen.getByLabelText("文章标题")).toHaveValue("");
    expect(bodyTextarea(container)).toHaveValue("");
    expect(screen.queryByText("有未保存的修改")).toBeNull();
  });

  it("still sends nothing while the user edits", async () => {
    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 新草稿" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "# 新草稿\n" } });

    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    expect(createDraftMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();
  });

  it("first save = exactly one POST then one PUT, then adopts the real id", async () => {
    createDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 0 }));
    saveDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 1 }));

    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 新草稿" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "# 新草稿\n" } });

    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();

    expect(createDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).toHaveBeenCalledWith(NEW_ID, {
      title: "[WEB-V2 TEST] 新草稿",
      summary: "",
      body: "# 新草稿\n",
      bodyMode: "MARKDOWN",
      visibility: "PRIVATE",
      topicIds: [],
      lockVersion: 0,
    });

    // URL adopts the real id, and the first save established a clean baseline.
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${NEW_ID}`),
    );
    expect(screen.queryByText("有未保存的修改")).toBeNull();
    // No follow-up GET: local state is already authoritative after our own save.
    expect(getDraftMock).not.toHaveBeenCalled();
  });

  it("keeps local content when the POST fails, and a retry POSTs again", async () => {
    createDraftMock.mockRejectedValueOnce(problem(500, "create failed"));
    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 保住我" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "保住我\n" } });

    fireEvent.click(saveButton());
    expect(await screen.findByText("保存失败")).toBeInTheDocument();

    expect(createDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("标题")).toHaveValue("[WEB-V2 TEST] 保住我");
    expect(bodyTextarea(container)).toHaveValue("保住我\n");
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${NEW_DRAFT_ROUTE_ID}`);

    // Nothing was created, so the retry legitimately creates first.
    createDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 0 }));
    saveDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 1 }));
    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(createDraftMock).toHaveBeenCalledTimes(2);
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
  });

  it("remembers the created id when the PUT fails, so the retry never POSTs twice", async () => {
    createDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 0 }));
    saveDraftMock.mockRejectedValueOnce(problem(500, "save failed"));

    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 保住我" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "保住我\n" } });

    fireEvent.click(saveButton());
    expect(await screen.findByText("保存失败")).toBeInTheDocument();

    expect(createDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
    // Local content survives, and the URL is NOT adopted on a failed save.
    expect(screen.getByLabelText("标题")).toHaveValue("[WEB-V2 TEST] 保住我");
    expect(bodyTextarea(container)).toHaveValue("保住我\n");
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${NEW_DRAFT_ROUTE_ID}`);

    // Retry: PUT only, against the id remembered from the successful POST.
    saveDraftMock.mockResolvedValue(draftFixture({ articleId: NEW_ID, lockVersion: 1 }));
    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();

    expect(createDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).toHaveBeenCalledTimes(2);
    expect(saveDraftMock.mock.calls[1][0]).toBe(NEW_ID);
    expect(saveDraftMock.mock.calls[1][1].lockVersion).toBe(0);
    await waitFor(() =>
      expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${NEW_ID}`),
    );
  });

  it("still protects unsaved changes on /new", async () => {
    const { router } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存" } });
    await act(async () => {
      await router.navigate("/studio");
    });

    expect(await screen.findByRole("alertdialog", { name: "未保存的修改" })).toBeInTheDocument();
    expect(screen.queryByTestId("studio-page")).toBeNull();
    expect(createDraftMock).not.toHaveBeenCalled();
  });
});

describe("unsaved-changes protection", () => {
  it("does not block navigation while the editor is clean", async () => {
    const { router } = await renderLoaded();

    await act(async () => {
      await router.navigate("/studio");
    });

    expect(await screen.findByTestId("studio-page")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "未保存的修改" })).toBeNull();
  });

  it("blocks in-app navigation while dirty and stays on the page", async () => {
    const { router } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存" } });
    await act(async () => {
      await router.navigate("/studio");
    });

    expect(await screen.findByRole("alertdialog", { name: "未保存的修改" })).toBeInTheDocument();
    expect(screen.queryByTestId("studio-page")).toBeNull();
    expect(router.state.location.pathname).toBe(`/studio/content/${DRAFT_ID}`);
  });

  it("lets the user go back to editing from the dialog", async () => {
    const { router } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存" } });
    await act(async () => {
      await router.navigate("/studio");
    });
    const dialog = await screen.findByRole("alertdialog", { name: "未保存的修改" });

    fireEvent.click(within(dialog).getByRole("button", { name: "留在本页" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "未保存的修改" })).toBeNull(),
    );
    expect(router.state.location.pathname).toBe(`/studio/content/${DRAFT_ID}`);
    expect(screen.getByLabelText("标题")).toHaveValue("未保存");
  });

  it("leaves when the user confirms discarding", async () => {
    const { router } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存" } });
    await act(async () => {
      await router.navigate("/studio");
    });
    const dialog = await screen.findByRole("alertdialog", { name: "未保存的修改" });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "放弃修改并离开" }));
    });

    expect(await screen.findByTestId("studio-page")).toBeInTheDocument();
  });

  it("releases the block after a successful save", async () => {
    const { router } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "已保存的修改" } });
    fireEvent.click(saveButton());
    // Under a fully parallel 32-file run the save→saved transition can outlive the
    // default async budget, so give this wait a real one (same treatment as the
    // heavy lazy-route waits).
    await screen.findByText("已保存", {}, { timeout: 15000 });

    await act(async () => {
      await router.navigate("/studio");
    });

    expect(await screen.findByTestId("studio-page", {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "未保存的修改" })).toBeNull();
  });

  it("registers a beforeunload handler only while dirty", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    await renderLoaded();
    const registered = () =>
      addSpy.mock.calls.filter(([type]) => type === "beforeunload").length;

    expect(registered()).toBe(0);

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存" } });
    await waitFor(() => expect(registered()).toBe(1));

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "真实草稿标题" } });
    await waitFor(() =>
      expect(removeSpy.mock.calls.filter(([type]) => type === "beforeunload").length).toBe(1),
    );

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("submit for review (the real creator-side lifecycle action)", () => {
  /*
   * The backend has no creator-facing publish endpoint, so the action under test
   * is POST /api/v1/me/articles/{id}/submit -> DRAFT becomes IN_REVIEW. Nothing
   * here may claim the article is published.
   */
  function submitButton() {
    return screen.getByRole("button", { name: "提交审核" });
  }

  async function confirmSubmit() {
    const dialog = await screen.findByRole("alertdialog", { name: "确认提交审核" });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认提交" }));
    return dialog;
  }

  it("asks for confirmation before submitting", async () => {
    await renderLoaded();

    fireEvent.click(submitButton());

    const dialog = await screen.findByRole("alertdialog", { name: "确认提交审核" });
    expect(within(dialog).getByText(/审核期间不可再编辑/)).toBeInTheDocument();
    // Nothing is sent until the user confirms.
    expect(submitForReviewMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "确认提交审核" })).toBeNull(),
    );
    expect(submitForReviewMock).not.toHaveBeenCalled();
  });

  it("submits a CLEAN draft directly, without an extra save", async () => {
    await renderLoaded();

    fireEvent.click(submitButton());
    await confirmSubmit();

    await waitFor(() => expect(submitForReviewMock).toHaveBeenCalledTimes(1));
    expect(submitForReviewMock).toHaveBeenCalledWith(DRAFT_ID);
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it("saves first when the draft is dirty, then submits", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "提交前的修改" } });

    fireEvent.click(submitButton());
    await confirmSubmit();

    await waitFor(() => expect(submitForReviewMock).toHaveBeenCalledTimes(1));
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock.mock.calls[0][1].title).toBe("提交前的修改");
    // Save must land before submit — never submit a stale body.
    expect(saveDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      submitForReviewMock.mock.invocationCallOrder[0],
    );
  });

  it("does not submit when the pre-submit save fails", async () => {
    saveDraftMock.mockRejectedValueOnce(problem(500, "保存炸了"));
    const { container } = await renderLoaded();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "不会被提交" } });

    fireEvent.click(submitButton());
    await confirmSubmit();

    expect(await screen.findByText("保存炸了")).toBeInTheDocument();
    expect(submitForReviewMock).not.toHaveBeenCalled();
    // Local content and page are intact.
    expect(screen.getByLabelText("标题")).toHaveValue("不会被提交");
    expect(bodyTextarea(container)).toHaveValue(DRAFT_BODY);
    expect(screen.getByRole("button", { name: "提交审核" })).toBeEnabled();
  });

  it("blocks submit until the local validation passes (mirrors the backend rule)", async () => {
    getDraftMock.mockResolvedValue(draftFixture({ title: null, body: null }));
    await renderLoaded();

    fireEvent.click(submitButton());

    expect(await screen.findByText("提交审核前必须填写标题")).toBeInTheDocument();
    expect(submitForReviewMock).not.toHaveBeenCalled();
    // No confirmation dialog is opened for an invalid draft.
    expect(screen.queryByRole("alertdialog", { name: "确认提交审核" })).toBeNull();
  });

  it("shows a submitting state and ignores duplicate clicks", async () => {
    const pending = deferred<{ submissionId: string }>();
    submitForReviewMock.mockReturnValue(pending.promise);
    await renderLoaded();

    fireEvent.click(submitButton());
    const dialog = await confirmSubmit();

    const toolbarSubmit = () => document.querySelector<HTMLButtonElement>("[data-editor-submit]");
    expect(await within(dialog).findByRole("button", { name: "提交中…" })).toBeDisabled();
    expect(toolbarSubmit()).toBeDisabled();
    expect(toolbarSubmit()?.textContent).toContain("提交中…");

    // Duplicate clicks must not fire a second request.
    fireEvent.click(toolbarSubmit() as HTMLButtonElement);
    fireEvent.click(within(dialog).getByRole("button", { name: "提交中…" }));
    expect(submitForReviewMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ submissionId: "sub-9" });
    });
    expect(await screen.findByRole("button", { name: "已提交审核" })).toBeInTheDocument();
  });

  it("keeps the editor usable when the submit request fails, and allows a retry", async () => {
    submitForReviewMock.mockRejectedValueOnce(problem(500, "提交炸了"));
    const { container } = await renderLoaded();
    const before = bodyTextarea(container).value;

    fireEvent.click(submitButton());
    await confirmSubmit();

    expect(await screen.findByText("提交炸了")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${DRAFT_ID}`);
    expect(bodyTextarea(container)).toHaveValue(before);
    expect(screen.getByRole("button", { name: "提交审核" })).toBeEnabled();

    submitForReviewMock.mockResolvedValue({ submissionId: "sub-2" });
    fireEvent.click(submitButton());
    await confirmSubmit();
    await waitFor(() => expect(submitForReviewMock).toHaveBeenCalledTimes(2));
  });

  it("surfaces a 409 conflict (already under review) without leaving the page", async () => {
    submitForReviewMock.mockRejectedValue(problem(409, "文章已在审核中", "CONFLICT"));
    await renderLoaded();

    fireEvent.click(submitButton());
    await confirmSubmit();

    expect(await screen.findByText("文章已在审核中")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${DRAFT_ID}`);
    expect(screen.getByRole("toolbar", { name: "正文编辑工具" })).toBeInTheDocument();
  });

  it("on /new: create, save, then submit — in that order, one create only", async () => {
    createDraftMock.mockResolvedValue(draftFixture({ articleId: "fresh-9", lockVersion: 0 }));
    saveDraftMock.mockResolvedValue(draftFixture({ articleId: "fresh-9", lockVersion: 1 }));
    submitForReviewMock.mockResolvedValue({ submissionId: "sub-3" });

    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 新文章" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "# 新文章\n\n正文。\n" } });

    fireEvent.click(submitButton());
    await confirmSubmit();

    await waitFor(() => expect(submitForReviewMock).toHaveBeenCalledWith("fresh-9"));
    expect(createDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
    expect(createDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveDraftMock.mock.invocationCallOrder[0],
    );
    expect(saveDraftMock.mock.invocationCallOrder[0]).toBeLessThan(
      submitForReviewMock.mock.invocationCallOrder[0],
    );
  });

  it("on /new: a failed create never reaches submit", async () => {
    createDraftMock.mockRejectedValue(problem(500, "创建炸了"));
    const { container } = renderEditor(NEW_DRAFT_ROUTE_ID);
    await screen.findByRole("toolbar", { name: "正文编辑工具" });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "[WEB-V2 TEST] 新文章" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "正文\n" } });

    fireEvent.click(submitButton());
    await confirmSubmit();

    expect(await screen.findByText("创建炸了")).toBeInTheDocument();
    expect(submitForReviewMock).not.toHaveBeenCalled();
    expect(saveDraftMock).not.toHaveBeenCalled();
    expect(bodyTextarea(container)).toHaveValue("正文\n");
  });

  it("after a successful submit the article is IN_REVIEW and no longer editable", async () => {
    const { container } = await renderLoaded();

    fireEvent.click(submitButton());
    await confirmSubmit();

    // Real lifecycle wording — never "已发布".
    await waitFor(() =>
      expect(container.querySelector("[data-editor-lifecycle='IN_REVIEW']")).not.toBeNull(),
    );
    expect(screen.getByRole("button", { name: "已提交审核" })).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    // The backend rejects every save once IN_REVIEW, so the surface is read-only.
    expect(bodyTextarea(container)).toHaveAttribute("readonly");
    expect(screen.getByLabelText("标题")).toHaveAttribute("readonly");
    expect(within(settings()).getByRole("button", { name: "公开" })).toBeDisabled();
    // There is no canonical public identifier to navigate to — the article 404s
    // publicly until an admin approves it — so we stay on the editor.
    expect(screen.getByTestId("path")).toHaveTextContent(`/studio/content/${DRAFT_ID}`);
  });

  it("opens an already-IN_REVIEW draft as read-only", async () => {
    getMyArticleStatusMock.mockResolvedValue("IN_REVIEW");
    const { container } = await renderLoaded();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "已提交审核" })).toBeInTheDocument(),
    );
    expect(bodyTextarea(container)).toHaveAttribute("readonly");
    expect(saveButton()).toBeDisabled();
    expect(container.querySelector("[data-editor-lifecycle='IN_REVIEW']")).not.toBeNull();
  });

  it("sends no lifecycle request until the user confirms", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "只改不提交" } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitForReviewMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog", { name: "确认提交审核" })).toBeNull();
  });
});

describe("published state awareness (Phase 1.6)", () => {
  /*
   * A PUBLISHED article already has a frozen PublishedRevision. Re-opening it in
   * the editor must tell the user that what they edit now is a NEW draft, and
   * that nothing they do here changes the public article until a fresh submit +
   * admin approval. The wording must never imply save-equals-publish.
   */
  function publishedBanner(container: HTMLElement) {
    return container.querySelector("[data-editor-lifecycle='PUBLISHED']");
  }

  it("shows no published banner for a DRAFT article", async () => {
    getMyArticleStatusMock.mockResolvedValue("DRAFT");
    const { container } = await renderLoaded();

    await waitFor(() => expect(getMyArticleStatusMock).toHaveBeenCalledWith(DRAFT_ID));
    expect(publishedBanner(container)).toBeNull();
    expect(screen.queryByText(/已有公开版本/)).toBeNull();
  });

  it("tells the user the public version exists and that edits go to a new draft", async () => {
    getMyArticleStatusMock.mockResolvedValue("PUBLISHED");
    const { container } = await renderLoaded();

    await waitFor(() => expect(publishedBanner(container)).not.toBeNull());
    const text = publishedBanner(container)?.textContent ?? "";

    // The four claims the copy must make — and must not invert.
    expect(text).toContain("此文章已有公开版本");
    expect(text).toContain("只会保存到草稿");
    expect(text).toContain("不会立即影响公开内容");
    expect(text).toContain("需要重新提交审核");
    // Must not claim a direct publish path.
    expect(text).not.toContain("发布成功");
    expect(text).not.toContain("已发布成功");
  });

  it("keeps a PUBLISHED article fully editable", async () => {
    getMyArticleStatusMock.mockResolvedValue("PUBLISHED");
    const { container } = await renderLoaded();
    await waitFor(() => expect(publishedBanner(container)).not.toBeNull());

    expect(screen.getByLabelText("文章标题")).not.toHaveAttribute("readonly");
    expect(screen.getByLabelText("标题")).not.toHaveAttribute("readonly");
    expect(bodyTextarea(container)).not.toHaveAttribute("readonly");
    expect(saveButton()).toBeEnabled();
  });

  it("still saves a PUBLISHED article's changes through the draft PUT", async () => {
    getMyArticleStatusMock.mockResolvedValue("PUBLISHED");
    const { container } = await renderLoaded();
    await waitFor(() => expect(publishedBanner(container)).not.toBeNull());

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "发布后的草稿修改" } });
    fireEvent.change(bodyTextarea(container), { target: { value: "发布后的草稿正文" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
    expect(saveDraftMock.mock.calls[0][0]).toBe(DRAFT_ID);
    expect(saveDraftMock.mock.calls[0][1]).toMatchObject({
      title: "发布后的草稿修改",
      body: "发布后的草稿正文",
    });
    // Saving a draft is NOT a lifecycle action.
    expect(submitForReviewMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it("keeps 提交审核 as the next lifecycle action and offers no publish control", async () => {
    getMyArticleStatusMock.mockResolvedValue("PUBLISHED");
    const { container } = await renderLoaded();
    await waitFor(() => expect(publishedBanner(container)).not.toBeNull());

    expect(screen.getByRole("button", { name: "提交审核" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /发布/ })).toBeNull();
    expect(container.querySelector("[data-editor-lifecycle='IN_REVIEW']")).toBeNull();
  });

  it("does not regress IN_REVIEW: notice stays, editor stays read-only, no published banner", async () => {
    getMyArticleStatusMock.mockResolvedValue("IN_REVIEW");
    const { container } = await renderLoaded();

    await waitFor(() =>
      expect(container.querySelector("[data-editor-lifecycle='IN_REVIEW']")).not.toBeNull(),
    );
    expect(publishedBanner(container)).toBeNull();
    expect(bodyTextarea(container)).toHaveAttribute("readonly");
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "已提交审核" })).toBeDisabled();
  });

  it("degrades when the status request fails: editor usable, no lifecycle claim", async () => {
    getMyArticleStatusMock.mockRejectedValue(problem(500, "status down"));
    const { container } = await renderLoaded();

    await waitFor(() =>
      expect(container.querySelector("[data-editor-status-unknown]")).not.toBeNull(),
    );
    // No guessed lifecycle banner in either direction.
    expect(publishedBanner(container)).toBeNull();
    expect(container.querySelector("[data-editor-lifecycle='IN_REVIEW']")).toBeNull();

    // The editor itself still works.
    expect(screen.getByLabelText("标题")).toHaveValue("真实草稿标题");
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "状态未知也能改" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(saveDraftMock).toHaveBeenCalledTimes(1);
  });

  it("degrades the same way when the article is missing from the owner list", async () => {
    getMyArticleStatusMock.mockResolvedValue(null);
    const { container } = await renderLoaded();

    await waitFor(() =>
      expect(container.querySelector("[data-editor-status-unknown]")).not.toBeNull(),
    );
    expect(publishedBanner(container)).toBeNull();
    expect(bodyTextarea(container)).not.toHaveAttribute("readonly");
  });
});

describe("scope guards", () => {
  it("offers no publish / trash control and no schedule or revision UI", async () => {
    await renderLoaded();

    /*
     * The real backend has NO creator-facing publish endpoint (POST/PUT
     * /api/v1/me/articles/{id}/publish -> 404). A "发布" button would be a control
     * that can never succeed, so it must not exist.
     */
    expect(screen.queryByRole("button", { name: /发布|回收站|删除草稿/ })).toBeNull();
    expect(screen.queryByText(/定时发布|版本历史/)).toBeNull();

    // The creator-side lifecycle action that DOES exist is submit-for-review.
    expect(screen.getByRole("button", { name: "提交审核" })).toBeInTheDocument();
    // Manual save is the only other write affordance.
    expect(saveButton()).toBeInTheDocument();
  });
});
