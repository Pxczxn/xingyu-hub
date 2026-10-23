import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { ApiError } from "@/api/client";
import { PublicSeriesDetailPage } from "./pages/PublicSeriesDetailPage";

const authState = { isAuthenticated: false };

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
    listPublic: vi.fn(),
    getPublicById: vi.fn(),
    getPublicBySlug: vi.fn(),
    getReadingProgress: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    recordReadingProgress: vi.fn(),
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => authState,
}));

const mocked = vi.mocked(seriesApi);

const SERIES = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "xing-yu-kai-fa-ri-zhi",
  description: "系列简介",
  hasSubscribed: false,
  author: { username: "alice", displayName: "Alice", avatar: null },
  chapters: [
    { id: "ch-2", articleId: "art-2", title: "第二章", position: 2 },
    { id: "ch-1", articleId: "art-1", title: "第一章", position: 1 },
  ],
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/series/ser-1"]}>
      <Routes>
        <Route path="/series/:seriesId" element={<PublicSeriesDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  /* A signed-in page asks for private progress; no record is the neutral case. */
  mocked.getReadingProgress.mockResolvedValue({ readingHistoryEnabled: true, chapterCount: 2 });
});

describe("PublicSeriesDetailPage", () => {
  it("shows the unavailable state on 404", async () => {
    mocked.getPublicById.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderDetail();
    expect(await screen.findByText("系列不存在或尚未公开")).toBeInTheDocument();
  });

  it("renders title, description and chapters sorted by position", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();

    // The title appears in both the breadcrumb and the heading, so target the heading.
    expect(
      await screen.findByRole("heading", { level: 1, name: "星语开发日志" }),
    ).toBeInTheDocument();
    expect(screen.getByText("系列简介")).toBeInTheDocument();

    const first = screen.getByRole("link", { name: "第一章" });
    const second = screen.getByRole("link", { name: "第二章" });
    expect(first).toHaveAttribute("href", "/series/ser-1/read?chapter=art-1");
    expect(second).toHaveAttribute("href", "/series/ser-1/read?chapter=art-2");
    // position ordering: 第一章 (position 1) renders before 第二章 (position 2)
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("falls back to a positional label when the backend sends a null chapter title", async () => {
    mocked.getPublicById.mockResolvedValue({
      ...SERIES,
      chapters: [{ id: "ch-1", articleId: "art-1", title: null, position: 1 }],
    });
    renderDetail();

    expect(await screen.findByRole("link", { name: "第 1 章" })).toHaveAttribute(
      "href",
      "/series/ser-1/read?chapter=art-1",
    );
    expect(screen.queryByText("无标题文章")).not.toBeInTheDocument();
  });

  it("links to the reader only when chapters exist", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();
    expect(await screen.findByRole("link", { name: "开始阅读" })).toHaveAttribute(
      "href",
      "/series/ser-1/read",
    );
  });

  it("offers a login link to guests instead of a subscribe button", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();
    const link = await screen.findByRole("link", { name: "登录后订阅" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fseries%2Fser-1");
    expect(screen.queryByRole("button", { name: "订阅系列" })).not.toBeInTheDocument();
  });

  it("shows the public author homepage link", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();
    expect(await screen.findByRole("link", { name: "Alice" })).toHaveAttribute("href", "/u/alice");
  });

  it("shows a subscribe button to signed-in users", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();
    expect(await screen.findByRole("button", { name: "订阅系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登录后订阅" })).not.toBeInTheDocument();
  });

  it("starts from the persisted subscribed state after refresh", async () => {
    // Series Subscription Closure：hasSubscribed 来自服务端，刷新后按钮停在正确状态
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: true });
    renderDetail();
    expect(await screen.findByRole("button", { name: "已订阅" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("unsubscribes via the toggle and returns to the subscribe label", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: true });
    mocked.unsubscribe.mockResolvedValue(undefined);
    renderDetail();
    const button = await screen.findByRole("button", { name: "已订阅" });
    await userEvent.click(button);
    await waitFor(() => expect(mocked.unsubscribe).toHaveBeenCalledWith("ser-1"));
    expect(await screen.findByRole("button", { name: "订阅系列" })).toBeInTheDocument();
  });

  it("rolls back the optimistic subscription state on failure", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: true });
    mocked.unsubscribe.mockRejectedValue(new Error("500"));
    renderDetail();
    const button = await screen.findByRole("button", { name: "已订阅" });
    await userEvent.click(button);
    await waitFor(() => expect(mocked.unsubscribe).toHaveBeenCalledWith("ser-1"));
    expect(await screen.findByRole("button", { name: "已订阅" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("取消订阅失败");
  });

  it("shows the empty chapter state when chapters is []", async () => {
    mocked.getPublicById.mockResolvedValue({ ...SERIES, chapters: [] });
    renderDetail();
    expect(await screen.findByText("暂无章节")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始阅读" })).not.toBeInTheDocument();
  });

  it("gives the work a cover with the same identity as the plaza card", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();

    const cover = await screen.findByTestId("generated-series-cover");
    /* Same key as the plaza: the tone follows the series, not the title. */
    expect(cover).toHaveAttribute("data-cover-key", "ser-1:xing-yu-kai-fa-ri-zhi");
    expect(cover.className).toContain("aspect-[3/4]");
  });

  it("never asks for private progress as a guest", async () => {
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();

    await screen.findByRole("link", { name: "开始阅读" });
    expect(mocked.getReadingProgress).not.toHaveBeenCalled();
  });

  it("starts at the first chapter when a signed-in reader has no progress", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    renderDetail();

    expect(await screen.findByRole("link", { name: "开始阅读" })).toHaveAttribute(
      "href",
      "/series/ser-1/read",
    );
    expect(mocked.getReadingProgress).toHaveBeenCalledWith("ser-1");
    expect(screen.queryByText(/上次读到/)).not.toBeInTheDocument();
  });

  it("resumes the recorded chapter and names it in chapters, not percent", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    mocked.getReadingProgress.mockResolvedValue({
      readingHistoryEnabled: true,
      chapterArticleId: "art-2",
      chapterIndex: 2,
      chapterCount: 2,
      lastReadAt: "2026-10-18T10:00:00Z",
    });
    renderDetail();

    expect(await screen.findByRole("link", { name: "继续阅读" })).toHaveAttribute(
      "href",
      "/series/ser-1/read?chapter=art-2",
    );
    expect(screen.getByText("上次读到第 2 / 2 章")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("treats a disabled reading history as no progress", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    mocked.getReadingProgress.mockResolvedValue({
      readingHistoryEnabled: false,
      chapterCount: 2,
    });
    renderDetail();

    expect(await screen.findByRole("link", { name: "开始阅读" })).toBeInTheDocument();
    expect(screen.queryByText(/上次读到/)).not.toBeInTheDocument();
  });

  it("falls back to start reading when progress itself cannot be read", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    mocked.getReadingProgress.mockRejectedValue(new Error("500"));
    renderDetail();

    expect(await screen.findByRole("link", { name: "开始阅读" })).toBeInTheDocument();
    expect(await screen.findByText("阅读进度暂时无法读取")).toBeInTheDocument();
  });

  it("measures the recorded position with a bar instead of a percentage", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    mocked.getReadingProgress.mockResolvedValue({
      readingHistoryEnabled: true,
      chapterArticleId: "art-1",
      chapterIndex: 1,
      chapterCount: 2,
      lastReadAt: "2026-10-18T10:00:00Z",
    });
    const { container } = renderDetail();

    const meter = await screen.findByRole("progressbar");
    expect(meter).toHaveAttribute("aria-valuenow", "1");
    expect(meter).toHaveAttribute("aria-valuemax", "2");
    expect(meter).toHaveAccessibleName("已读到第 1 章，共 2 章");
    /* The fill is a real fraction of the track, not a decoration: half of two
       chapters has to paint half the bar. */
    const fill = container.querySelector(".series-detail-meter-fill") as HTMLElement;
    expect(fill.style.width).toBe("50%");
    /* The sentence above already says "第 1 / 2 章"; a percentage would repeat it. */
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("draws no bar when nothing is recorded", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    renderDetail();

    /* An empty track would assert a 0% the backend never recorded. */
    expect(await screen.findByRole("link", { name: "开始阅读" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("draws no bar for a guest, who has no recorded position at all", async () => {
    mocked.getPublicById.mockResolvedValue({ ...SERIES, hasSubscribed: false });
    renderDetail();

    expect(await screen.findByRole("link", { name: "开始阅读" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
