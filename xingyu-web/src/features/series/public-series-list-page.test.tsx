import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { ApiError } from "@/api/client";
import { PublicSeriesListPage } from "./pages/PublicSeriesListPage";

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

const mocked = vi.mocked(seriesApi);

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/series"]}>
      <Routes>
        <Route path="/series" element={<PublicSeriesListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicSeriesListPage", () => {
  it("shows loading while the public list is in flight", () => {
    mocked.listPublic.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no public series", async () => {
    mocked.listPublic.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("还没有公开的系列")).toBeInTheDocument();
  });

  it("renders each series with a link to its detail page", async () => {
    mocked.listPublic.mockResolvedValue([
      {
        id: "ser-1",
        title: "星语开发日志",
        slug: "xing-yu-kai-fa-ri-zhi",
        description: "系列简介",
        status: "ACTIVE",
        chapterCount: 2,
        updatedAt: "2026-09-27T10:00:00Z",
      },
    ]);
    renderList();
    expect(await screen.findByText("星语开发日志")).toBeInTheDocument();
    expect(screen.getByText("系列简介")).toBeInTheDocument();
    expect(screen.getByText("2 篇文章")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /星语开发日志/ })).toHaveAttribute(
      "href",
      "/series/ser-1",
    );
  });

  it("requests the public list with the 24-item window", async () => {
    mocked.listPublic.mockResolvedValue([]);
    renderList();
    await screen.findByText("还没有公开的系列");
    expect(mocked.listPublic).toHaveBeenCalledWith(24);
  });

  it("shows the error state when the list request fails", async () => {
    mocked.listPublic.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务器错误",
        status: 500,
        detail: "服务器错误",
        code: "INTERNAL",
      }),
    );
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

