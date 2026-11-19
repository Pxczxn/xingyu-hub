import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import { ApiError } from "@/api/client";
import { GuideIndexPage } from "./pages/GuideIndexPage";
import { GuideDetailPage } from "./pages/GuideDetailPage";

vi.mock("@/api/guide/guide.api", () => ({
  COMMUNITY_RULES_SLUG: "community-rules",
  guideApi: { list: vi.fn(), getBySlug: vi.fn(), getCommunityRules: vi.fn() },
}));

const mocked = vi.mocked(guideApi);

const PAGE = {
  id: "g1",
  slug: "getting-started",
  title: "快速上手",
  body: "星语社区是一个以阅读与创作为核心的内容社区。",
  publishedAt: "2026-09-18T20:33:57Z",
};

const RULES_PAGE = {
  id: "g2",
  slug: "community-rules",
  title: "社区公约",
  body: "请尊重他人、文明交流。",
  publishedAt: "2026-09-18T20:33:57Z",
};

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={["/guide"]}>
      <Routes>
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/guide/${slug}`]}>
      <Routes>
        <Route path="/guide" element={<GuideIndexPage />} />
        <Route path="/guide/:slug" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GuideIndexPage", () => {
  it("shows loading while the catalog request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderIndex();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows empty when the catalog is an empty array", async () => {
    mocked.list.mockResolvedValue([]);
    renderIndex();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });

  it("renders titles without a summary and opens the slug page", async () => {
    mocked.list.mockResolvedValue([PAGE]);
    mocked.getBySlug.mockResolvedValue(PAGE);
    renderIndex();

    const link = await screen.findByRole("link", { name: /快速上手/ });
    expect(link).toHaveAttribute("href", "/guide/getting-started");
    expect(screen.getByText("了解浏览、创作和参与社区的基本路径。")).toBeInTheDocument();
    expect(screen.queryByText("查看该指南的完整说明。")).not.toBeInTheDocument();

    fireEvent.click(link);
    expect(mocked.getBySlug).toHaveBeenCalledWith("getting-started");
    expect(await screen.findByRole("heading", { name: "快速上手" })).toBeInTheDocument();
  });

  it("shows an error state when the catalog fails", async () => {
    mocked.list.mockRejectedValue(notFound());
    renderIndex();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("exposes one clearly described rules entry through the canonical rules route", async () => {
    mocked.list.mockResolvedValue([PAGE, RULES_PAGE]);
    renderIndex();

    const rulesLink = await screen.findByRole("link", { name: /社区规则/ });
    expect(rulesLink).toHaveAttribute("href", "/rules");
    expect(screen.getByText("了解社区规范，以及举报与申诉相关规则。")).toBeInTheDocument();
    expect(document.querySelector('a[href="/guide/community-rules"]')).not.toBeInTheDocument();
  });
});

describe("GuideDetailPage", () => {
  it("renders the body as plain text and links back to the catalog", async () => {
    mocked.getBySlug.mockResolvedValue(PAGE);
    renderDetail("getting-started");
    const title = await screen.findByRole("heading", { name: "快速上手" });
    expect(title).toBeInTheDocument();
    const paper = title.closest(".rounded-card")?.className ?? "";
    expect(paper).toContain("px-3");
    expect(paper).toContain("max-md:-mx-4");
    expect(paper).toContain("py-6");
    expect(paper).toContain("md:p-6");
    expect(paper).toContain("min-[1024px]:px-14");
    expect(paper).toContain("min-[1024px]:py-12");
    expect(paper).not.toMatch(/(^|\s)p-6(\s|$)/);
    expect(screen.getByText(PAGE.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "指南" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("link", { name: /下一篇/ })).toHaveAttribute("href", "/rules");
    expect(screen.queryByRole("link", { name: "返回指南目录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "返回指南列表" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /联系支持/ })).not.toBeInTheDocument();
  });

  it("renders numbered lines as a step list inside the reading column", async () => {
    mocked.getBySlug.mockResolvedValue({
      ...PAGE,
      blocks: [
        {
          type: "paragraph",
          text: "星语社区是一个以阅读与创作为核心的内容社区。",
          level: 0,
        },
        {
          type: "paragraph",
          text: "1. 注册并完善个人资料\n2. 在发现页浏览内容\n3. 进入创作工作台发布文章或系列\n4. 关注感兴趣的创作者",
          level: 0,
        },
      ],
    });
    renderDetail("getting-started");

    const body = await screen.findByText("星语社区是一个以阅读与创作为核心的内容社区。");
    const article = body.closest(".article-body");
    expect(article).not.toBeNull();
    expect(article?.querySelector("ol")).not.toBeNull();
    expect(screen.getByText("注册并完善个人资料").closest("li")).toHaveAttribute(
      "id",
      "guide-step-1",
    );
    expect(screen.getByText("关注感兴趣的创作者").closest("ol")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "步骤" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "指南目录" })).not.toBeInTheDocument();

    expect(screen.getByRole("progressbar", { name: "阅读进度" })).toBeInTheDocument();
    /*
     * 有意改变（用户 2026-11-10：所有内容阅读页共用一套模板）：来源「星语官方」
     * 现在同时出现在标题下的 meta 行与左栏「关于这份内容」实体块里，所以按
     * 多元素断言；阅读时长从「约 N 分钟阅读」改成左栏派生行「约 N 分钟」。
     */
    expect(screen.getAllByText("星语官方").length).toBeGreaterThan(0);
    expect(screen.getByText(/分钟/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "目录" })).not.toBeInTheDocument();

    const title = screen.getByRole("heading", { name: "快速上手" });
    expect(title.className).toContain("text-h1");
    expect(title.closest("article")?.className).toContain("max-w-[var(--reading-measure)]");
    expect(article?.closest("article")).toBe(title.closest("article"));
    expect(screen.getByRole("navigation", { name: "相邻指南" }).closest("article")).toBe(
      title.closest("article"),
    );
  });

  it("indexes a long guide by its headings and keeps numbered lines in the body", async () => {
    mocked.getBySlug.mockResolvedValue({
      ...PAGE,
      blocks: [
        { type: "heading", text: "从这里开始", id: "guide-heading-0", level: 2 },
        { type: "paragraph", text: "先完善资料，再去发现页。", level: 0 },
        { type: "heading", text: "接着创作", id: "guide-heading-1", level: 2 },
        { type: "paragraph", text: "1. 打开创作工作台\n2. 发布文章或系列", level: 0 },
      ],
    });
    renderDetail("getting-started");

    expect(await screen.findByRole("heading", { level: 2, name: "从这里开始" })).toHaveAttribute(
      "id",
      "guide-heading-0",
    );
    /* 1440 以上仍是右栏目录；窄屏入口是标题行上的按钮，不进正文。 */
    const outline = await screen.findByRole("navigation", { name: "指南目录" });
    const compactTriggers = screen.getAllByRole("button", { name: "目录" });
    expect(compactTriggers.length).toBeGreaterThan(0);
    /* 窄屏入口和阅读设置同一组，放在标题行里，不进正文。 */
    expect(compactTriggers[0]?.closest(".article-body")).toBeNull();
    expect(compactTriggers[0]?.parentElement).toBe(
      screen.getAllByRole("button", { name: "阅读设置" })[0]?.parentElement,
    );
    expect(within(outline).getByRole("link", { name: "从这里开始" })).toHaveAttribute(
      "href",
      "#guide-heading-0",
    );
    expect(within(outline).getByRole("link", { name: "接着创作" })).toHaveAttribute(
      "href",
      "#guide-heading-1",
    );
    expect(within(outline).queryByText("打开创作工作台")).not.toBeInTheDocument();
    expect(document.querySelector(".article-body ol")).not.toBeNull();
    expect(screen.queryByRole("navigation", { name: "步骤" })).not.toBeInTheDocument();
    expect(outline.querySelector('a[href="#guide-heading-0"]')?.closest("article")).toBeNull();
  });

  it("shows a missing-guide state for 404", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());
    renderDetail("__missing__");
    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
  });

  it("uses the router param as-is and does not double-decode the slug", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());
    // One URL decode of %2520 is "%20". A second decodeURIComponent would yield a space.
    renderDetail("foo%2520bar");

    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
    expect(mocked.getBySlug).toHaveBeenCalledWith("foo%20bar");
    expect(mocked.getBySlug).not.toHaveBeenCalledWith("foo bar");
  });

  it("does not throw when the slug contains a malformed percent sequence", async () => {
    mocked.getBySlug.mockRejectedValue(notFound());

    expect(() => renderDetail("%E0%A4%A")).not.toThrow();
    expect(await screen.findByText("指南不存在或未发布")).toBeInTheDocument();
  });

  it("applies standard and wide line-height to body paragraphs and restores default", async () => {
    mocked.getBySlug.mockResolvedValue(PAGE);
    renderDetail("getting-started");

    const paragraph = await screen.findByText(PAGE.body);
    const body = paragraph.closest(".article-body");
    expect(body).toBeInstanceOf(HTMLElement);
    const articleBody = body as HTMLElement;

    const css = readFileSync(resolve("src/styles/globals.css"), "utf8");
    const paragraphRule = css.match(/\.article-body p \{([^}]+)\}/)?.[1] ?? "";
    expect(paragraphRule).toMatch(/line-height:\s*inherit/);
    expect(paragraphRule).not.toMatch(/leading-\[1\.85\]/);
    expect(css).toMatch(/\.article-body \{[\s\S]*?leading-\[1\.85\]/);
    expect(css).toContain(".article-body h2 {");
    expect(css).toContain("leading-[1.35]");
    expect(css).toContain(".article-body > * + * {");
    expect(css).toContain("@apply mt-4");

    const applied = document.createElement("style");
    applied.textContent = ".article-body p { line-height: inherit; }";
    document.head.appendChild(applied);

    expect(articleBody).toHaveStyle({ fontSize: "18px", lineHeight: "1.9" });
    expect(getComputedStyle(paragraph).lineHeight).toBe(getComputedStyle(articleBody).lineHeight);

    fireEvent.click(screen.getByRole("button", { name: "宽" }));
    expect(articleBody).toHaveStyle({ lineHeight: "2" });
    expect(getComputedStyle(paragraph).lineHeight).toBe(getComputedStyle(articleBody).lineHeight);
    expect(getComputedStyle(paragraph).lineHeight).not.toBe("1.9");

    fireEvent.click(screen.getByRole("button", { name: "标准" }));
    expect(articleBody).toHaveStyle({ fontSize: "18px", lineHeight: "1.9" });
    expect(getComputedStyle(paragraph).lineHeight).toBe(getComputedStyle(articleBody).lineHeight);

    applied.remove();
  });

  it("renders fenced code, blockquotes and nested lists as real DOM", async () => {
    mocked.getBySlug.mockResolvedValue({
      ...PAGE,
      blocks: [
        { type: "paragraph", text: "导语。", level: 0 },
        { type: "code", text: "line one\n  indented\n<>\"&", lang: "text", level: 0 },
        { type: "quote", text: "引用正文", level: 0 },
        { type: "paragraph", text: "- 父项\n  - 子项\n- 同级", level: 0 },
      ],
    });
    renderDetail("getting-started");

    const body = await screen.findByText("导语。");
    const article = body.closest(".article-body");
    expect(article).not.toBeNull();
    const code = article?.querySelector("pre > code");
    expect(code?.textContent).toBe("line one\n  indented\n<>\"&");
    expect(code).toHaveClass("language-text");
    const css = readFileSync(resolve("src/styles/globals.css"), "utf8");
    const articlePre = css.match(/(?:^|\n)[ \t]*\.article-body pre \{([\s\S]*?)\n[ \t]*\}/);
    expect(articlePre?.[1]).toContain("overflow-x-auto");
    expect(articlePre?.[1]).toContain("max-width: 100%");
    expect(css).not.toMatch(/\.guide-reader[^{]*pre code[^{]*\{[^}]*overflow-x\s*:\s*auto/);
    const quote = article?.querySelector("blockquote");
    expect(quote?.textContent).toBe("引用正文");
    expect(quote?.textContent).not.toContain(">");
    const parent = screen.getByText("父项").closest("li");
    expect(parent?.querySelector("ul")).not.toBeNull();
    expect(parent?.querySelector("li")?.textContent).toBe("子项");
    expect(screen.getByText("同级").closest("ul")).toBe(screen.getByText("父项").closest("ul"));
  });

  it("scales H2/H3 with the reading font size and restores the default", async () => {
    mocked.getBySlug.mockResolvedValue({
      ...PAGE,
      blocks: [
        { type: "heading", text: "从这里开始", id: "guide-heading-0", level: 2 },
        { type: "paragraph", text: "先完善资料。", level: 0 },
        { type: "heading", text: "接着创作", id: "guide-heading-1", level: 3 },
        { type: "paragraph", text: "打开创作工作台。", level: 0 },
      ],
    });
    renderDetail("getting-started");

    const h2 = await screen.findByRole("heading", { level: 2, name: "从这里开始" });
    const h3 = screen.getByRole("heading", { level: 3, name: "接着创作" });
    const body = h2.closest(".article-body") as HTMLElement;
    expect(body).not.toBeNull();
    expect(h2.style.fontSize).toBe("1.5556em");
    expect(h2.style.marginTop).toBe("calc(18px * 2.667)");
    expect(h3.style.fontSize).toBe("1.2em");
    expect(h3.style.marginTop).toBe("1.15em");
    expect(body.style.fontSize).toBe("18px");

    fireEvent.click(screen.getByRole("button", { name: "增大字号" }));
    expect(body.style.fontSize).toBe("20px");
    expect(h2.style.fontSize).toBe("1.5556em");
    expect(h2.style.marginTop).toBe("calc(20px * 2.667)");
    expect(h3.style.fontSize).toBe("1.2em");

    fireEvent.click(screen.getByRole("button", { name: "减小字号" }));
    expect(body.style.fontSize).toBe("18px");
    expect(h2.style.fontSize).toBe("1.5556em");
    expect(h2.style.marginTop).toBe("calc(18px * 2.667)");
    expect(h3.style.fontSize).toBe("1.2em");
  });
});
