import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import { ApiError } from "@/api/client";
import { RulesPage } from "./pages/RulesPage";

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: { list: vi.fn(), getBySlug: vi.fn(), getCommunityRules: vi.fn() },
}));

const mocked = vi.mocked(guideApi);

const RULES = {
  id: "g2",
  slug: "community-rules",
  title: "社区公约",
  body: "请尊重他人、文明交流，不发布违法违规内容。举报与申诉可在「我的举报」与「我的申诉」中查看与跟进。",
  publishedAt: "2026-09-18T20:33:57Z",
};

function unavailable(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderRules() {
  return render(
    <MemoryRouter initialEntries={["/rules"]}>
      <Routes>
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/guide" element={<p>指南目录</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RulesPage", () => {
  it("renders community-rules title and body without a fake chapter index", async () => {
    mocked.getCommunityRules.mockResolvedValue(RULES);
    renderRules();

    expect(await screen.findByRole("heading", { name: "社区公约" })).toBeInTheDocument();
    expect(screen.getByText(RULES.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看使用指南" })).toHaveAttribute("href", "/guide");

    expect(screen.queryByText("总则")).not.toBeInTheDocument();
    expect(screen.queryByText("账号与行为规范")).not.toBeInTheDocument();
    expect(screen.queryByText("内容规范")).not.toBeInTheDocument();
    expect(screen.queryByText("互动规范")).not.toBeInTheDocument();
    expect(screen.queryByText("违规处理")).not.toBeInTheDocument();
    expect(screen.queryByText("附则")).not.toBeInTheDocument();
    expect(screen.queryByText("提交举报")).not.toBeInTheDocument();
    expect(screen.queryByText("提交申诉")).not.toBeInTheDocument();
  });

  it("shows unavailable when community-rules cannot be loaded", async () => {
    mocked.getCommunityRules.mockRejectedValue(unavailable());
    renderRules();
    expect(await screen.findByText("社区规则暂不可用")).toBeInTheDocument();
  });

  /*
   * 内容阅读页：`/rules` 与 `/articles/:id`、`/guide/:slug` 共用同一套 `ReaderFrame`
   * 模板（用户 2026-11-10 口径：都是看内容的地方，公用的）。这三条断言钉住的是
   * 「栏位 / 块序」本身，而不是某个视觉数值 —— 它们正是各页后来分叉的地方。
   */
  it("renders the shared content-reading template around the rules body", async () => {
    mocked.getCommunityRules.mockResolvedValue(RULES);
    renderRules();

    const title = await screen.findByRole("heading", { name: "社区公约" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    /* 左栏：来源 + 派生信息（字数 / 段落由正文实算；字数同时出现在标题 meta 行）。 */
    expect(screen.getAllByText("星语官方").length).toBeGreaterThan(0);
    expect(screen.getByText("字数")).toBeInTheDocument();
    expect(screen.getByText("段落")).toBeInTheDocument();
    expect(screen.getAllByText("约 48 字").length).toBeGreaterThan(0);

    /* 右栏块序：工具（A−/A+ + 行距）→ 本文信息 → 进度。 */
    expect(screen.getByRole("button", { name: "减小字号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "增大字号" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "行距" })).toBeInTheDocument();
    /* 没有 heading 块 ⇒ 不给假目录，改为「本文共 N 段 · 约 M 字」。 */
    expect(screen.queryByRole("navigation", { name: "规则目录" })).not.toBeInTheDocument();
    expect(screen.getByText("本文共 1 段 · 约 48 字")).toBeInTheDocument();
    /* 进度实现全站只有一份：右栏块 + ReaderFrame 顶部细线。 */
    expect(screen.getByRole("progressbar", { name: "阅读进度" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "阅读进度条" })).toBeInTheDocument();

    /* 正文在纸面卡里，且没有封面数据时不放头图。 */
    const article = title.closest("article");
    expect(article).not.toBeNull();
    expect(article?.closest(".rounded-card")).not.toBeNull();
    expect(document.querySelector('[data-testid="generated-series-cover"]')).toBeNull();
  });

  it("indexes heading blocks and merges numbered lines into a real list", async () => {
    mocked.getCommunityRules.mockResolvedValue({
      ...RULES,
      blocks: [
        { type: "heading", text: "总则", id: "rules-heading-0", level: 2 },
        { type: "paragraph", text: "1. 尊重他人\n2. 不发布违法违规内容", level: 0 },
      ],
    });
    renderRules();

    const outline = await screen.findByRole("navigation", { name: "规则目录" });
    expect(within(outline).getByRole("link", { name: "总则" })).toHaveAttribute(
      "href",
      "#rules-heading-0",
    );
    /* 连续编号行合并成一个真正的 <ol>，不是「每行一段 + 段间距」。 */
    expect(document.querySelector(".article-body ol")).not.toBeNull();
    expect(screen.getByText("不发布违法违规内容").closest("li")).not.toBeNull();
    expect(screen.queryByText("2. 不发布违法违规内容")).not.toBeInTheDocument();
  });
});
