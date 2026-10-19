import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("offers a direct create entry instead of a decorative empty state", async () => {
    mocked.listMine.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("还没有系列")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一个系列" })).toHaveAttribute(
      "href",
      "/studio/series/new",
    );
  });

  it("renders the management facts and puts chapter management first", async () => {
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
    // ACTIVE means publicly listed, never "still serialising".
    expect(screen.getByText("公开中")).toBeInTheDocument();
    expect(screen.queryByText("进行中")).not.toBeInTheDocument();
    expect(screen.getByText("3 章")).toBeInTheDocument();
    expect(screen.queryByText("阅读量")).not.toBeInTheDocument();
    expect(screen.queryByText("订阅人数")).not.toBeInTheDocument();

    const manage = screen.getByRole("link", { name: /管理章节/ });
    const edit = screen.getByRole("link", { name: /编辑信息/ });
    expect(manage).toHaveAttribute("href", "/studio/series/ser-1/articles");
    expect(edit).toHaveAttribute("href", "/studio/series/ser-1/edit");
    // Primary action is rendered before the secondary one.
    expect(manage.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "查看公开页" })).toHaveAttribute(
      "href",
      "/series/ser-1",
    );
  });

  it("does not offer a public link for an archived series", async () => {
    mocked.listMine.mockResolvedValue([
      {
        id: "ser-2",
        title: "归档系列",
        slug: "archived",
        description: null,
        status: "ARCHIVED",
        chapterCount: 0,
        updatedAt: "2026-09-25T14:15:36Z",
      },
    ]);
    renderList();
    expect(await screen.findByText("已归档")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "查看公开页" })).not.toBeInTheDocument();
    expect(screen.getByText("暂无简介")).toBeInTheDocument();
  });

  it("keeps a long title inside the row", async () => {
    const longTitle = "这是一个非常长的系列标题".repeat(8);
    mocked.listMine.mockResolvedValue([
      {
        id: "ser-3",
        title: longTitle,
        slug: "long",
        description: null,
        status: "ACTIVE",
        chapterCount: 1,
        updatedAt: "2026-09-25T14:15:36Z",
      },
    ]);
    renderList();
    const heading = await screen.findByRole("heading", { name: longTitle });
    expect(heading.className).toContain("break-words");
  });

  it("shows backend list errors and allows a retry", async () => {
    mocked.listMine.mockRejectedValueOnce(
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
    mocked.listMine.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText("还没有系列")).toBeInTheDocument();
  });
});
