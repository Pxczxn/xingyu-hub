import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import { ApiError } from "@/api/client";
import { SeriesEditPage } from "./pages/SeriesEditPage";

vi.mock("@/api/series/series.api", () => ({
  seriesApi: {
    listMine: vi.fn(),
    create: vi.fn(),
    getMine: vi.fn(),
    update: vi.fn(),
  },
}));

const mocked = vi.mocked(seriesApi);

const DETAIL = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "xing-yu-kai-fa-ri-zhi",
  description: "keep-me",
  status: "ACTIVE" as const,
  lockVersion: 1,
  chapters: [],
  updatedAt: "2026-09-25T14:15:36Z",
};

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/studio/series/ser-1/edit"]}>
      <Routes>
        <Route path="/studio/series/:id/edit" element={<SeriesEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesEditPage", () => {
  it("saves with the loaded lockVersion then refreshes from GET", async () => {
    mocked.getMine
      .mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce({ ...DETAIL, description: "keep-me", lockVersion: 2 });
    mocked.update.mockResolvedValue({
      ...DETAIL,
      description: null,
      lockVersion: 2,
    });
    renderEdit();
    fireEvent.change(await screen.findByLabelText("简介"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(mocked.update).toHaveBeenCalledWith("ser-1", {
        title: "星语开发日志",
        description: "",
        status: "ACTIVE",
        lockVersion: 1,
      });
    });
    await waitFor(() => {
      expect(mocked.getMine).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByLabelText("简介")).toHaveValue("keep-me");
  });

  it("shows apiError.detail and a refresh action on 409", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    mocked.update.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求冲突",
        status: 409,
        detail: "系列已被他人更新",
        code: "CONFLICT",
      }),
    );
    renderEdit();
    fireEvent.click(await screen.findByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("系列已被他人更新");
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => {
      expect(mocked.getMine).toHaveBeenCalledTimes(2);
    });
  });

  it("treats missing series as 404", async () => {
    mocked.getMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderEdit();
    expect(await screen.findByText("系列不存在或无权编辑")).toBeInTheDocument();
  });
});

