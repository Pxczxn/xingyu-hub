import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, useSearchParams } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesDetail } from "@/api/series/series.types";
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

function EditProbe() {
  const [params] = useSearchParams();
  return <div data-testid="edit-page">{`编辑 created=${params.get("created") ?? ""}`}</div>;
}

function renderNew() {
  const router = createMemoryRouter(
    [
      { path: "/studio/series/new", element: <SeriesNewPage /> },
      { path: "/studio/series", element: <div data-testid="list-page">系列列表</div> },
      { path: "/studio/series/:id/edit", element: <EditProbe /> },
    ],
    { initialEntries: ["/studio/series/new"] },
  );
  render(<RouterProvider router={router} />);
  return router;
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
    expect(await screen.findByText("请填写别名")).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it("suggests a pinyin slug from the title", () => {
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    expect(screen.getByLabelText("别名")).toHaveValue("xing-yu-kai-fa-ri-zhi");
  });

  it("stops overwriting a manually edited slug", () => {
    renderNew();
    const title = screen.getByLabelText("标题");
    const slug = screen.getByLabelText("别名");
    fireEvent.change(title, { target: { value: "星语开发日志" } });
    expect(slug).toHaveValue("xing-yu-kai-fa-ri-zhi");

    fireEvent.change(slug, { target: { value: "my-custom-slug" } });
    fireEvent.change(title, { target: { value: "新的标题" } });
    expect(slug).toHaveValue("my-custom-slug");
  });

  it("can regenerate the slug after a manual edit", () => {
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    fireEvent.change(screen.getByLabelText("别名"), { target: { value: "custom" } });
    fireEvent.click(screen.getByRole("button", { name: /根据标题生成/ }));
    expect(screen.getByLabelText("别名")).toHaveValue("xing-yu-kai-fa-ri-zhi");
  });

  it("creates and guides the creator to the edit page with a success flag", async () => {
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
    expect(await screen.findByTestId("edit-page")).toHaveTextContent("created=1");
  });

  it("guards against duplicate submissions while the request is pending", async () => {
    let resolve: (value: SeriesDetail) => void = () => {};
    mocked.create.mockReturnValue(
      new Promise<SeriesDetail>((done) => {
        resolve = done;
      }),
    );
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "星语开发日志" } });
    const submit = screen.getByRole("button", { name: "创建系列" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocked.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "创建中…" })).toBeDisabled();
    resolve({
      id: "ser-new",
      title: "星语开发日志",
      slug: "xing-yu-kai-fa-ri-zhi",
      description: null,
      status: "ACTIVE",
      lockVersion: 0,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
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

  it("asks before leaving a half-written form and stays when asked", async () => {
    renderNew();
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存的标题" } });
    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));

    const dialog = await screen.findByRole("alertdialog", { name: "有未保存的系列信息" });
    expect(dialog).toHaveTextContent("放弃修改并离开");
    fireEvent.click(screen.getByRole("button", { name: "留在本页" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(screen.getByLabelText("标题")).toHaveValue("未保存的标题");

    fireEvent.click(screen.getByRole("link", { name: /返回系列管理/ }));
    await screen.findByRole("alertdialog", { name: "有未保存的系列信息" });
    fireEvent.click(screen.getByRole("button", { name: "放弃修改并离开" }));
    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
  });
});
