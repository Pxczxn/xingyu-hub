import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { articlesApi } from "@/api/articles/articles.api";
import { ApiError } from "@/api/client";
import { SeriesArticlesPage } from "./pages/SeriesArticlesPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listMine: vi.fn(),
  },
}));

const mockedSeries = vi.mocked(seriesApi);
const mockedArticles = vi.mocked(articlesApi);

const DETAIL = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "s",
  description: null,
  status: "ACTIVE" as const,
  lockVersion: 3,
  chapters: [{ id: "ch-1", articleId: "a1", title: "Spring Boot启动流程", position: 1 }],
  updatedAt: "2026-09-25T14:15:36Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/studio/series/ser-1/articles"]}>
      <Routes>
        <Route path="/studio/series/:id/articles" element={<SeriesArticlesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesArticlesPage", () => {
  it("labels untitled drafts instead of rendering a blank row", async () => {
    mockedSeries.getMine.mockResolvedValue({
      ...DETAIL,
      chapters: [{ id: "ch-1", articleId: "50640d78-bac5-43ce-8863-060cf0861748", title: null, position: 1 }],
    });
    mockedArticles.listMine.mockResolvedValue([
      {
        id: "50640d78-bac5-43ce-8863-060cf0861748",
        status: "DRAFT",
        title: null,
        categoryId: null,
        updatedAt: "",
      },
    ]);
    renderPage();
    expect(await screen.findByText("无标题文章")).toBeInTheDocument();
    expect(screen.getByText("50640d78-bac5-43ce-8863-060cf0861748")).toBeInTheDocument();
  });

  it("saves chapterArticleIds with the current lockVersion", async () => {
    mockedSeries.getMine
      .mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce({ ...DETAIL, lockVersion: 4, chapters: DETAIL.chapters });
    mockedArticles.listMine.mockResolvedValue([
      { id: "a1", status: "DRAFT", title: "Spring Boot启动流程", categoryId: null, updatedAt: "" },
    ]);
    mockedSeries.update.mockResolvedValue({ ...DETAIL, lockVersion: 4 });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "保存排序" }));
    await waitFor(() => {
      expect(mockedSeries.update).toHaveBeenCalledWith("ser-1", {
        chapterArticleIds: ["a1"],
        lockVersion: 3,
      });
    });
  });

  it("shows apiError.detail when binding fails", async () => {
    mockedSeries.getMine.mockResolvedValue(DETAIL);
    mockedArticles.listMine.mockResolvedValue([]);
    mockedSeries.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求参数无效",
        status: 400,
        detail: "chapterArticleIds: 章节文章不存在或不属于当前用户",
        code: "VALIDATION_FAILED",
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "保存排序" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "chapterArticleIds: 章节文章不存在或不属于当前用户",
    );
  });
});
