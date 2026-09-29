import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { ApiError } from "@/api/client";
import { SeriesListPage } from "./pages/SeriesListPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

const mocked = vi.mocked(seriesApi);

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/studio/series"]}>
      <Routes>
        <Route path="/studio/series" element={<SeriesListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesListPage", () => {
  it("shows loading while the list request is in flight", () => {
    mocked.listMine.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows an empty state for []", async () => {
    mocked.listMine.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("还没有系列")).toBeInTheDocument();
  });

  it("renders title, description, status, chapter count, and updated time", async () => {
    mocked.listMine.mockResolvedValue([
      {
        id: "ser-1",
        title: "[WEB-V2 TEST] 星语开发日志",
        slug: "xing-yu-kai-fa-ri-zhi",
        description: "Phase 2F",
        status: "ACTIVE",
        chapterCount: 3,
        updatedAt: "2026-09-25T14:15:36Z",
      },
    ]);
    renderList();
    expect(await screen.findByText("[WEB-V2 TEST] 星语开发日志")).toBeInTheDocument();
    expect(screen.getByText("Phase 2F")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("3 篇文章")).toBeInTheDocument();
    expect(screen.queryByText("封面")).not.toBeInTheDocument();
    expect(screen.queryByText("阅读量")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑" })).toHaveAttribute("href", "/studio/series/ser-1/edit");
    expect(screen.getByRole("link", { name: "文章编排" })).toHaveAttribute(
      "href",
      "/studio/series/ser-1/articles",
    );
  });

  it("shows backend list errors in the error state", async () => {
    mocked.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

