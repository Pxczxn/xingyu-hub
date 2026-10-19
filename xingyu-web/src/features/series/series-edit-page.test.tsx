import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail } from "@/api/series/series.types";
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

const DETAIL: SeriesDetail = {
  id: "ser-1",
  title: "星语开发日志",
  slug: "xing-yu-kai-fa-ri-zhi",
  description: "keep-me",
  status: "ACTIVE",
  lockVersion: 1,
  chapters: [],
  updatedAt: "2026-09-25T14:15:36Z",
};

function renderEdit(entry = "/studio/series/ser-1/edit") {
  const router = createMemoryRouter(
    [
      { path: "/studio/series/:id/edit", element: <SeriesEditPage /> },
      { path: "/studio/series", element: <div data-testid="list-page">系列列表</div> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesEditPage", () => {
  it("keeps the save button disabled until something actually changes", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    renderEdit();
    expect(await screen.findByLabelText("标题")).toHaveValue("星语开发日志");
    expect(screen.getByLabelText("别名")).toHaveValue("xing-yu-kai-fa-ri-zhi");
    expect(screen.getByLabelText("别名")).toHaveAttribute("readonly");
    expect(screen.getByRole("radio", { name: /公开中/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /已归档/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(mocked.update).not.toHaveBeenCalled();
  });

  it("shows the public-state semantics instead of a serialisation status", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    renderEdit();
    await screen.findByLabelText("标题");
    expect(screen.getByText(/会出现在系列广场/)).toBeInTheDocument();
    expect(screen.queryByText(/连载中/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已完结/)).not.toBeInTheDocument();
  });

  it("saves with the loaded lockVersion and adopts the response", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    mocked.update.mockResolvedValue({
      ...DETAIL,
      description: "新的简介",
      lockVersion: 2,
    });
    renderEdit();
    fireEvent.change(await screen.findByLabelText("简介"), {
      target: { value: "新的简介" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => {
      expect(mocked.update).toHaveBeenCalledWith("ser-1", {
        title: "星语开发日志",
        description: "新的简介",
        status: "ACTIVE",
        lockVersion: 1,
      });
    });
    expect(await screen.findByText("已保存。")).toBeInTheDocument();
    expect(screen.getByLabelText("简介")).toHaveValue("新的简介");
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    // The PUT response is built from the database; no extra GET is required.
    expect(mocked.getMine).toHaveBeenCalledTimes(1);
  });

  it("handles a 409 by keeping local input and only reloading after confirmation", async () => {
    mocked.getMine.mockResolvedValueOnce(DETAIL).mockResolvedValueOnce(DETAIL);
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
    fireEvent.change(await screen.findByLabelText("简介"), {
      target: { value: "本地未保存的简介" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("版本冲突");
    expect(screen.getByLabelText("简介")).toHaveValue("本地未保存的简介");

    fireEvent.click(screen.getByRole("button", { name: "载入服务端最新内容" }));
    expect(await screen.findByRole("group", { name: "确认载入服务端版本" })).toHaveTextContent(
      "覆盖你当前未保存的修改",
    );
    fireEvent.click(screen.getByRole("button", { name: "确认载入" }));
    await waitFor(() => {
      expect(mocked.getMine).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("已载入服务端最新内容。")).toBeInTheDocument();
    expect(screen.getByLabelText("简介")).toHaveValue("keep-me");
    // It never silently resubmits the old list with a new version.
    expect(mocked.update).toHaveBeenCalledTimes(1);
  });

  it("keeps edits made while the save request is in flight", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    let resolve: (value: SeriesDetail) => void = () => {};
    mocked.update.mockReturnValue(
      new Promise<SeriesDetail>((done) => {
        resolve = done;
      }),
    );
    renderEdit();
    fireEvent.change(await screen.findByLabelText("简介"), { target: { value: "第一版" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("简介"), { target: { value: "保存期间的修改" } });
    resolve({ ...DETAIL, description: "第一版", lockVersion: 2 });
    expect(
      await screen.findByText("已保存上一版内容；保存期间的修改尚未提交。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("简介")).toHaveValue("保存期间的修改");
    expect(screen.getByText("有未保存的修改")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeEnabled();
  });

  it("validates an empty title without sending a request", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    renderEdit();
    fireEvent.change(await screen.findByLabelText("标题"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(await screen.findByText("请填写标题")).toBeInTheDocument();
    expect(mocked.update).not.toHaveBeenCalled();
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

  it("asks before leaving with unsaved edits", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    renderEdit();
    fireEvent.change(await screen.findByLabelText("标题"), { target: { value: "改过的标题" } });
    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));

    await screen.findByRole("alertdialog", { name: "有未保存的系列信息" });
    fireEvent.click(screen.getByRole("button", { name: "留在本页" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByLabelText("标题")).toHaveValue("改过的标题");

    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));
    await screen.findByRole("alertdialog", { name: "有未保存的系列信息" });
    fireEvent.click(screen.getByRole("button", { name: "放弃修改并离开" }));
    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
  });

  it("registers beforeunload only while dirty", async () => {
    mocked.getMine.mockResolvedValue(DETAIL);
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    renderEdit();
    await screen.findByLabelText("标题");
    const registered = () => addSpy.mock.calls.filter(([type]) => type === "beforeunload").length;
    expect(registered()).toBe(0);

    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "改过的标题" } });
    await waitFor(() => expect(registered()).toBe(1));
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    await waitFor(() =>
      expect(removeSpy.mock.calls.filter(([type]) => type === "beforeunload").length).toBe(1),
    );
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
