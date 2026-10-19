import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { articlesApi } from "@/api/articles/articles.api";
import { ApiError } from "@/api/client";
import { PublicSeriesReadPage } from "./pages/PublicSeriesReadPage";

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
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    recordReadingProgress: vi.fn(),
  },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: { getArticle: vi.fn() },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => authState,
}));

const mockedSeries = vi.mocked(seriesApi);
const mockedArticles = vi.mocked(articlesApi);

const SERIES = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "s",
  description: null,
  author: { username: "alice", displayName: "Alice", avatar: null },
  chapters: [
    { id: "ch-1", articleId: "art-1", title: "第一章", position: 1 },
    { id: "ch-2", articleId: "art-2", title: "第二章", position: 2 },
  ],
};

function article(id: string, title: string) {
  return {
    id,
    title,
    summary: null,
    body: "正文段落一。\n\n正文段落二。",
    slug: null,
    visibility: "PUBLIC",
    spaceSlug: "s",
    ownerUsername: "u",
    publishedAt: "2026-09-27T10:00:00Z",
    seriesContexts: [],
    owner: false,
  };
}

function renderReader(entry = "/series/ser-1/read") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/series/:seriesId/read" element={<PublicSeriesReadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="reader-location">{`${location.pathname}${location.search}`}</div>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  mockedSeries.recordReadingProgress.mockResolvedValue(undefined);
});

describe("PublicSeriesReadPage", () => {
  it("shows the unavailable state on 404", async () => {
    mockedSeries.getPublicById.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderReader();
    expect(await screen.findByText("系列不存在或无权访问")).toBeInTheDocument();
  });

  it("shows the generic error state for a non-404 failure", async () => {
    mockedSeries.getPublicById.mockRejectedValue(new Error("boom"));
    renderReader();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renders the first chapter and its article body", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    expect(
      await screen.findByRole("heading", { level: 1, name: "第一章 标题" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第 1 / 2 章")).toBeInTheDocument();
    expect(mockedArticles.getArticle).toHaveBeenCalledWith("art-1");
  });

  it("switches chapter and loads the next article", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "第二章 标题" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第 2 / 2 章")).toBeInTheDocument();
  });

  it("opens the chapter named by the URL", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );
    renderReader("/series/ser-1/read?chapter=art-2");

    expect(
      await screen.findByRole("heading", { level: 1, name: "第二章 标题" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第 2 / 2 章")).toBeInTheDocument();
    // The chapter list is the allow-list: only its article was requested.
    expect(mockedArticles.getArticle.mock.calls.map(([id]) => id)).toEqual(["art-2"]);
  });

  it("falls back to the first chapter for an unknown chapter id", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );
    renderReader("/series/ser-1/read?chapter=not-a-chapter");

    expect(
      await screen.findByRole("heading", { level: 1, name: "第一章 标题" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("该章节不存在或已从系列中移除，已从第一章开始。"),
    ).toBeInTheDocument();
    expect(mockedArticles.getArticle.mock.calls.map(([id]) => id)).toEqual(["art-1"]);
  });

  it("keeps the legacy URL working and mirrors switches into the URL", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    expect(screen.getByTestId("reader-location")).toHaveTextContent("/series/ser-1/read");

    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));
    await screen.findByRole("heading", { level: 1, name: "第二章 标题" });
    expect(screen.getByTestId("reader-location")).toHaveTextContent(
      "/series/ser-1/read?chapter=art-2",
    );

    await userEvent.click(screen.getByRole("button", { name: "上一篇" }));
    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    expect(screen.getByTestId("reader-location")).toHaveTextContent(
      "/series/ser-1/read?chapter=art-1",
    );
  });

  it("never shows the previous chapter while the next one is loading", async () => {
    const next = deferred<ReturnType<typeof article>>();
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation((id: string) =>
      id === "art-1" ? Promise.resolve(article("art-1", "第一章 标题")) : next.promise,
    );
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 1, name: "第一章 标题" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 1, name: "正在加载章节…" })).toBeInTheDocument();

    await act(async () => {
      next.resolve(article("art-2", "第二章 标题"));
      await next.promise;
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "第二章 标题" }),
    ).toBeInTheDocument();
  });

  it("ignores a late response from the previous chapter", async () => {
    const first = deferred<ReturnType<typeof article>>();
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation((id: string) =>
      id === "art-1" ? first.promise : Promise.resolve(article("art-2", "第二章 标题")),
    );
    renderReader();

    await screen.findByRole("button", { name: /第二章/ });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));
    await screen.findByRole("heading", { level: 1, name: "第二章 标题" });

    await act(async () => {
      first.resolve(article("art-1", "第一章 标题"));
      await first.promise;
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "第二章 标题" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "第一章 标题" }),
    ).not.toBeInTheDocument();
  });

  it("recovers from an unreadable chapter with an explicit retry", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    expect(await screen.findByText("章节正文暂不可读")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试本章" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "第一章 标题" }),
    ).toBeInTheDocument();
  });

  it("offers a route back to the first chapter when a later chapter fails", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation((id: string) =>
      id === "art-1"
        ? Promise.resolve(article("art-1", "第一章 标题"))
        : Promise.reject(new Error("404")),
    );
    renderReader("/series/ser-1/read?chapter=art-2");

    expect(await screen.findByText("章节正文暂不可读")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "从第一章开始" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "第一章 标题" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reader-location")).toHaveTextContent(
      "/series/ser-1/read?chapter=art-1",
    );
  });

  it("does not record a chapter that failed to load", async () => {
    authState.isAuthenticated = true;
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockRejectedValue(new Error("404"));
    renderReader();

    expect(await screen.findByText("章节正文暂不可读")).toBeInTheDocument();
    expect(mockedSeries.recordReadingProgress).not.toHaveBeenCalled();
  });

  it("does not post reading progress for guests", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    expect(mockedSeries.recordReadingProgress).not.toHaveBeenCalled();
  });

  it("records progress only after a chapter has actually loaded", async () => {
    authState.isAuthenticated = true;
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedSeries.recordReadingProgress.mockResolvedValue(undefined);
    const pending = deferred<ReturnType<typeof article>>();
    mockedArticles.getArticle.mockReturnValueOnce(pending.promise);

    renderReader();

    // Nothing is written while the article is still in flight.
    await waitFor(() => expect(mockedSeries.getPublicById).toHaveBeenCalled());
    expect(mockedSeries.recordReadingProgress).not.toHaveBeenCalled();

    pending.resolve(article("art-1", "第一章 标题"));
    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });

    await waitFor(() =>
      expect(mockedSeries.recordReadingProgress).toHaveBeenCalledWith("ser-1", "art-1"),
    );
    // A re-render must not write the same chapter twice.
    expect(mockedSeries.recordReadingProgress).toHaveBeenCalledTimes(1);
  });

  it("records the new chapter after switching", async () => {
    authState.isAuthenticated = true;
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedSeries.recordReadingProgress.mockResolvedValue(undefined);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );

    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    await screen.findByRole("heading", { level: 1, name: "第二章 标题" });
    await waitFor(() =>
      expect(mockedSeries.recordReadingProgress).toHaveBeenCalledWith("ser-1", "art-2"),
    );
  });

  it("shows the empty state when the series has no chapters", async () => {
    mockedSeries.getPublicById.mockResolvedValue({ ...SERIES, chapters: [] });
    renderReader();
    expect(await screen.findByText("暂无可阅读章节")).toBeInTheDocument();
  });

  it("surfaces an unreadable chapter without crashing", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockRejectedValue(new Error("403"));
    renderReader();
    expect(await screen.findByText("章节正文暂不可读")).toBeInTheDocument();
  });

  /*
    The three cases below lock wiring that no behavioural test could see, and
    the first one exists because a real defect hid here for a long time.

    `.article-body` declares `text-[15px]` on itself, so it beats any
    `font-size` inherited from a wrapper. The A- / A+ control therefore moved
    nothing but the measure — `ch` resolves against the wrapper's own size — so
    pressing A+ widened the column while the glyphs stayed 15px. Nothing failed,
    because every assertion was about behaviour and the control did *something*.

    jsdom applies no stylesheet, so what these lock is the wiring that makes the
    stylesheet work: the reader's size and the measure must stay on the same
    element, and that element must carry `reader-column`.
  */
  it("gives the reading column the reader's size, the measure and the hook", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    const column = screen.getByTestId("reader-column");

    // `.reader-column .article-body { font-size: inherit }` is what lets the
    // body follow the reader instead of its own 15px default.
    expect(column).toHaveClass("reader-column");
    // Same element on purpose: `ch` is relative to the element's OWN font-size,
    // so moving the size to a child would silently stop the measure tracking.
    expect(column).toHaveStyle({ fontSize: "18px", maxWidth: "68ch" });
    expect(column.querySelector(".article-body")).not.toBeNull();
  });

  it("moves the font size and the measure from the reader controls", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    const column = screen.getByTestId("reader-column");

    await userEvent.click(screen.getByRole("button", { name: "增大字号" }));
    expect(column).toHaveStyle({ fontSize: "19px" });
    await userEvent.click(screen.getByRole("button", { name: "减小字号" }));
    expect(column).toHaveStyle({ fontSize: "18px" });

    // `ch`, not px. A px measure and a px font size do not compose, which is how
    // 680/820/960 let the font control change the glyphs per line — the one
    // thing a measure control exists to hold steady. 960 was also unreachable:
    // a 1200px shell leaves a 920px article column.
    await userEvent.click(screen.getByRole("button", { name: "窄" }));
    expect(column).toHaveStyle({ maxWidth: "58ch" });
    await userEvent.click(screen.getByRole("button", { name: "宽" }));
    expect(column).toHaveStyle({ maxWidth: "80ch" });
  });

  it("marks the current chapter by state, leaving its accessible name alone", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockImplementation(async (id: string) =>
      article(id, id === "art-2" ? "第二章 标题" : "第一章 标题"),
    );
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    // The ordinal is `aria-hidden`, so the name is the title and nothing else —
    // which is what a screen reader user needs to hear. The selected state
    // rides on `aria-current` instead of being folded into the label.
    expect(screen.getByRole("button", { name: "第一章 标题" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "第二章" })).not.toHaveAttribute("aria-current");

    await userEvent.click(screen.getByRole("button", { name: "第二章" }));
    await screen.findByRole("heading", { level: 1, name: "第二章 标题" });
    expect(screen.getByRole("button", { name: "第二章 标题" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: "第一章" })).not.toHaveAttribute("aria-current");
  });
});
