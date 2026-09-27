import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  status: "ACTIVE" as const,
  lockVersion: 0,
  updatedAt: "2026-09-27T10:00:00Z",
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
    owner: false,
  };
}

function renderReader() {
  return render(
    <MemoryRouter initialEntries={["/series/ser-1/read"]}>
      <Routes>
        <Route path="/series/:seriesId/read" element={<PublicSeriesReadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
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

  it("does not post reading progress for guests", async () => {
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    expect(mockedSeries.recordReadingProgress).not.toHaveBeenCalled();
  });

  it("posts reading progress for signed-in readers", async () => {
    authState.isAuthenticated = true;
    mockedSeries.getPublicById.mockResolvedValue(SERIES);
    mockedSeries.recordReadingProgress.mockResolvedValue(undefined);
    mockedArticles.getArticle.mockResolvedValue(article("art-1", "第一章 标题"));
    renderReader();

    await screen.findByRole("heading", { level: 1, name: "第一章 标题" });
    await userEvent.click(screen.getByRole("button", { name: /第二章/ }));

    expect(mockedSeries.recordReadingProgress).toHaveBeenCalledWith("ser-1", "art-2");
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
});
