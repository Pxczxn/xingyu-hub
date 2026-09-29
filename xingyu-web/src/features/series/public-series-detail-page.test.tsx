import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  status: "ACTIVE" as const,
  lockVersion: 2,
  updatedAt: "2026-09-27T10:00:00Z",
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
    expect(first).toHaveAttribute("href", "/articles/art-1");
    expect(second).toHaveAttribute("href", "/articles/art-2");
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
      "/articles/art-1",
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

  it("shows a subscribe button to signed-in users", async () => {
    authState.isAuthenticated = true;
    mocked.getPublicById.mockResolvedValue(SERIES);
    renderDetail();
    expect(await screen.findByRole("button", { name: "订阅系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登录后订阅" })).not.toBeInTheDocument();
  });

  it("shows the empty chapter state when chapters is []", async () => {
    mocked.getPublicById.mockResolvedValue({ ...SERIES, chapters: [] });
    renderDetail();
    expect(await screen.findByText("暂无章节")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始阅读" })).not.toBeInTheDocument();
  });
});

