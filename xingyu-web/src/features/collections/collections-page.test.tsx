import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import { ApiError } from "@/api/client";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CollectionManagePage } from "./pages/CollectionManagePage";
import { COLLECTION_VISIBILITIES } from "@/api/collections/collections.types";

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

const SUMMARY = {
  id: "col-1",
  title: "夜间读物",
  visibility: "PRIVATE",
  itemCount: 2,
};

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/me/collections"]}>
      <Routes>
        <Route path="/me/collections" element={<CollectionsPage />} />
        <Route path="/me/collections/:id" element={<CollectionManagePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CollectionsPage", () => {
  it("shows loading while the list request is in flight", () => {
    mocked.listMine.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows 还没有收藏夹 for an empty array", async () => {
    mocked.listMine.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("还没有收藏夹")).toBeInTheDocument();
    expect(screen.queryByText("收藏文章后会自动出现在这里")).not.toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mocked.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "系统繁忙，请稍后再试",
        status: 500,
        detail: "系统繁忙，请稍后再试",
        code: "INTERNAL_ERROR",
      }),
    );
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("renders title, visibility, and itemCount", async () => {
    mocked.listMine.mockResolvedValue([SUMMARY]);
    renderList();
    expect(await screen.findByRole("link", { name: "夜间读物" })).toHaveAttribute(
      "href",
      "/me/collections/col-1",
    );
    expect(screen.getByText("仅自己可见 · 2 项")).toBeInTheDocument();
  });

  it("rejects an empty title without calling create", async () => {
    mocked.listMine.mockResolvedValue([]);
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "新建收藏夹" }));
    fireEvent.submit(screen.getByRole("button", { name: "创建" }).closest("form")!);
    expect(await screen.findByText("请填写收藏夹名称")).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it("creates with a legal visibility and lists the new collection", async () => {
    mocked.listMine.mockResolvedValue([]);
    mocked.create.mockResolvedValue({
      id: "col-new",
      title: "新夹",
      visibility: "PUBLIC",
      itemCount: 0,
    });
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "新建收藏夹" }));
    const radios = screen.getAllByRole("radio");
    expect(radios.map((el) => (el as HTMLInputElement).value)).toEqual([
      ...COLLECTION_VISIBILITIES,
    ]);
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "新夹" } });
    fireEvent.click(screen.getByDisplayValue("PUBLIC"));
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(await screen.findByRole("link", { name: "新夹" })).toBeInTheDocument();
    expect(mocked.create).toHaveBeenCalledWith({ title: "新夹", visibility: "PUBLIC" });
  });

  it("navigates to the manage detail from the list", async () => {
    mocked.listMine.mockResolvedValue([SUMMARY]);
    mocked.getById.mockReturnValue(new Promise(() => {}));
    renderList();
    fireEvent.click(await screen.findByRole("link", { name: "夜间读物" }));
    await waitFor(() => {
      expect(mocked.getById).toHaveBeenCalledWith("col-1");
    });
  });
});
