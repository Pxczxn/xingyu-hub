import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { bookshelfApi } from "@/api/bookshelf/bookshelf.api";
import { ApiError } from "@/api/client";
import { BookshelfPage } from "./pages/BookshelfPage";

vi.mock("@/api/bookshelf/bookshelf.api", () => ({
  bookshelfApi: { list: vi.fn() },
}));

const mocked = vi.mocked(bookshelfApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/bookshelf"]}>
      <Routes>
        <Route path="/me/bookshelf" element={<BookshelfPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookshelfPage", () => {
  it("shows loading while the request is in flight", () => {
    mocked.list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows the empty series-subscription copy", async () => {
    mocked.list.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderPage();
    expect(await screen.findByText("暂时还没有订阅的系列")).toBeInTheDocument();
    expect(screen.queryByText("加入收藏夹后显示在这里")).not.toBeInTheDocument();
    expect(screen.queryByText("想读")).not.toBeInTheDocument();
    expect(screen.queryByText("在读")).not.toBeInTheDocument();
    expect(screen.queryByText("已读")).not.toBeInTheDocument();
    expect(screen.queryByText("收藏的文章")).not.toBeInTheDocument();
  });

  it("shows an error state", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renders subscribed series without fake reading metrics", async () => {
    mocked.list.mockResolvedValue({
      items: [
        {
          id: "ser-1",
          objectType: "SERIES",
          title: "星语长篇",
          summary: "简介",
          cover: null,
          authorName: null,
          updatedAt: "2026-09-22T11:37:47Z",
        },
      ],
      nextCursor: null,
      total: 1,
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "星语长篇" })).toBeInTheDocument();
    expect(screen.getByText("简介")).toBeInTheDocument();
    expect(screen.getAllByText("系列").length).toBeGreaterThan(0);
    expect(screen.queryByText("阅读时长")).not.toBeInTheDocument();
    expect(screen.queryByText("年度目标")).not.toBeInTheDocument();
  });
});

