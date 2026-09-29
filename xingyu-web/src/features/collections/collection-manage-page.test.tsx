import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import { ApiError } from "@/api/client";
import { CollectionManagePage } from "./pages/CollectionManagePage";

vi.mock("@/api/collections/collections.api", () => ({
  collectionsApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const mocked = vi.mocked(collectionsApi);

const OWN_SUMMARY = {
  id: "col-1",
  title: "夜间读物",
  visibility: "PRIVATE",
  itemCount: 2,
};

const DETAIL = {
  id: "col-1",
  title: "夜间读物",
  description: null,
  visibility: "PRIVATE",
  items: [
    { id: "it-1", title: "一篇文章", objectType: "ARTICLE", objectId: "art-1" },
    { id: "it-2", title: "一个系列", objectType: "SERIES", objectId: "ser-1" },
  ],
};

const FOREIGN_PUBLIC = {
  id: "foreign-public-id",
  title: "别人的公开收藏夹",
  description: null,
  visibility: "PUBLIC",
  items: [],
};

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderManage(id = "col-1") {
  return render(
    <MemoryRouter initialEntries={[`/me/collections/${id}`]}>
      <Routes>
        <Route path="/me/collections" element={<div data-testid="list-page">列表</div>} />
        <Route path="/me/collections/:id" element={<CollectionManagePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockOwnedDetail() {
  mocked.listMine.mockResolvedValue([OWN_SUMMARY]);
  mocked.getById.mockResolvedValue(DETAIL);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CollectionManagePage", () => {
  it("shows loading while the ownership list is in flight", () => {
    mocked.listMine.mockReturnValue(new Promise(() => {}));
    renderManage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
    expect(mocked.getById).not.toHaveBeenCalled();
  });

  it("hides manage UI when the id is not in listMine", async () => {
    mocked.listMine.mockResolvedValue([OWN_SUMMARY]);
    mocked.getById.mockResolvedValue(FOREIGN_PUBLIC);
    renderManage("foreign-public-id");
    expect(await screen.findByText("收藏夹不存在或暂不可访问")).toBeInTheDocument();
    expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
    expect(screen.queryByText("可见范围")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除收藏夹" })).not.toBeInTheDocument();
    expect(screen.queryByText("别人的公开收藏夹")).not.toBeInTheDocument();
    expect(screen.queryByText("你不是所有者")).not.toBeInTheDocument();
    expect(screen.queryByText("无权限管理")).not.toBeInTheDocument();
    expect(screen.queryByText("这是别人的收藏夹")).not.toBeInTheDocument();
    expect(mocked.getById).not.toHaveBeenCalled();
  });

  it("renders a ready collection without fabricating description", async () => {
    mockOwnedDetail();
    renderManage();
    expect(await screen.findByRole("heading", { name: "夜间读物" })).toBeInTheDocument();
    expect(screen.queryByText("记录我喜欢的内容")).not.toBeInTheDocument();
    expect(screen.getByText("一篇文章")).toBeInTheDocument();
    expect(screen.getByText("系列")).toBeInTheDocument();
    expect(mocked.getById).toHaveBeenCalledWith("col-1");
  });

  it("shows unavailable for 404 after ownership is confirmed", async () => {
    mocked.listMine.mockResolvedValue([OWN_SUMMARY]);
    mocked.getById.mockRejectedValue(notFound());
    renderManage();
    expect(await screen.findByText("收藏夹不存在或暂不可访问")).toBeInTheDocument();
    expect(screen.queryByText("这是私密收藏夹")).not.toBeInTheDocument();
  });

  it("shows a generic error when listMine fails", async () => {
    mocked.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderManage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(mocked.getById).not.toHaveBeenCalled();
  });

  it("shows a generic error when getById fails after ownership is confirmed", async () => {
    mocked.listMine.mockResolvedValue([OWN_SUMMARY]);
    mocked.getById.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderManage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renames via PATCH and keeps the server title", async () => {
    mockOwnedDetail();
    mocked.update.mockResolvedValue({
      id: "col-1",
      title: "改名后",
      visibility: "PRIVATE",
      itemCount: 2,
    });
    renderManage();
    await screen.findByRole("heading", { name: "夜间读物" });
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "改名后" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mocked.update).toHaveBeenCalledWith("col-1", { title: "改名后", visibility: "PRIVATE" });
    });
    expect(await screen.findByRole("heading", { name: "改名后" })).toBeInTheDocument();
  });

  it("updates visibility to PUBLIC", async () => {
    mockOwnedDetail();
    mocked.update.mockResolvedValue({
      id: "col-1",
      title: "夜间读物",
      visibility: "PUBLIC",
      itemCount: 2,
    });
    renderManage();
    await screen.findByRole("heading", { name: "夜间读物" });
    fireEvent.click(screen.getByDisplayValue("PUBLIC"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mocked.update).toHaveBeenCalledWith("col-1", { title: "夜间读物", visibility: "PUBLIC" });
    });
  });

  it("asks for delete confirmation then navigates to the list", async () => {
    mockOwnedDetail();
    mocked.remove.mockResolvedValue(undefined);
    renderManage();
    fireEvent.click(await screen.findByRole("button", { name: "删除收藏夹" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("确定删除这个收藏夹吗？此操作无法撤销。");
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      expect(mocked.remove).toHaveBeenCalledWith("col-1");
    });
    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
  });

  it("does not expose item add, remove, or move controls", async () => {
    mockOwnedDetail();
    renderManage();
    await screen.findByRole("heading", { name: "夜间读物" });
    expect(screen.queryByRole("button", { name: /加入收藏夹|添加条目|移除|移动/ })).not.toBeInTheDocument();
    expect(screen.queryByText("加入收藏夹")).not.toBeInTheDocument();
  });
});

