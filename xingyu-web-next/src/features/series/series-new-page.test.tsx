import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { ApiError } from "@/api/client";
import { SeriesNewPage } from "./pages/SeriesNewPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

const mocked = vi.mocked(seriesApi);

function renderNew() {
  return render(
    <MemoryRouter initialEntries={["/studio/series/new"]}>
      <Routes>
        <Route path="/studio/series/new" element={<SeriesNewPage />} />
        <Route path="/studio/series/:id/edit" element={<div data-testid="edit-page">编辑</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesNewPage", () => {
  it("requires a slug and does not POST without one", async () => {
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "仅标题" } });
    fireEvent.change(screen.getByLabelText("别名"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));
    expect(await screen.findByText("请填写合法别名")).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it("suggests a pinyin slug from the title", () => {
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    expect(screen.getByLabelText("别名")).toHaveValue("xing-yu-kai-fa-ri-zhi");
  });

  it("creates and goes to the edit page", async () => {
    mocked.create.mockResolvedValue({
      id: "ser-new",
      title: "星语开发日志",
      slug: "xing-yu-kai-fa-ri-zhi",
      description: null,
      status: "ACTIVE",
      lockVersion: 0,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
    });
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));
    await waitFor(() => {
      expect(mocked.create).toHaveBeenCalledWith({
        title: "星语开发日志",
        slug: "xing-yu-kai-fa-ri-zhi",
      });
    });
    expect(await screen.findByTestId("edit-page")).toBeInTheDocument();
  });

  it("shows apiError.detail on create failure", async () => {
    mocked.create.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求参数无效",
        status: 400,
        detail: "slug: 别名已被占用",
        code: "VALIDATION_FAILED",
      }),
    );
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    fireEvent.click(screen.getByRole("button", { name: "创建系列" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("slug: 别名已被占用");
  });
});
