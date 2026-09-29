import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import { ApiError } from "@/api/client";
import { CollectionPublicPage } from "./pages/CollectionPublicPage";

vi.mock("@/api/collections/collections.api", () => ({
  collectionsApi: { getById: vi.fn() },
}));

const mocked = vi.mocked(collectionsApi);

function renderPublic() {
  return render(
    <MemoryRouter initialEntries={["/collections/col-1"]}>
      <Routes>
        <Route path="/collections/:id" element={<CollectionPublicPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CollectionPublicPage", () => {
  it("renders a PUBLIC collection as read-only", async () => {
    mocked.getById.mockResolvedValue({
      id: "col-1",
      title: "公开读物",
      description: null,
      visibility: "PUBLIC",
      items: [],
    });
    renderPublic();
    expect(await screen.findByRole("heading", { name: "公开读物" })).toBeInTheDocument();
    expect(screen.getByText("所有人可查看")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除收藏夹" })).not.toBeInTheDocument();
    expect(screen.queryByText("链接可见")).not.toBeInTheDocument();
    expect(screen.queryByText("获得链接的人可见")).not.toBeInTheDocument();
  });

  it("shows a generic unavailable state for 404", async () => {
    mocked.getById.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPublic();
    expect(await screen.findByText("收藏夹不存在或暂不可访问")).toBeInTheDocument();
    expect(screen.queryByText("这是私密收藏夹")).not.toBeInTheDocument();
    expect(screen.queryByText("你没有权限")).not.toBeInTheDocument();
  });
});
