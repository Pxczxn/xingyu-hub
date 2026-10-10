import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { ReportTargetView } from "@/api/moderation/moderation.types";
import { NewReportPage } from "./NewReportPage";

const mockedSubmit = vi.fn();
const mockedPreview = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  reportsApi: {
    submit: (...args: unknown[]) => mockedSubmit(...args),
    previewTarget: (...args: unknown[]) => mockedPreview(...args),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function target(overrides: Partial<ReportTargetView> = {}): ReportTargetView {
  return {
    objectType: "MOMENT",
    objectId: "m1",
    title: null,
    summary: "这是被举报的动态正文",
    authorId: "u1",
    authorUsername: "alice",
    authorDisplayName: "Alice",
    alreadyReported: false,
    ...overrides,
  };
}

/** Render with an object context in the query string (the only supported entry). */
function renderPage(query = "?objectType=MOMENT&objectId=m1") {
  return render(
    <MemoryRouter initialEntries={[`/reports/new${query}`]}>
      <Routes>
        <Route path="/reports/new" element={<NewReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NewReportPage", () => {
  it("asks the server what the target is, using only type and id", async () => {
    mockedPreview.mockResolvedValue(target());
    renderPage("?objectType=MOMENT&objectId=m1");
    await screen.findByText("举报对象");
    expect(mockedPreview).toHaveBeenCalledWith("MOMENT", "m1");
  });

  it("shows the server's title, summary and author", async () => {
    mockedPreview.mockResolvedValue(
      target({ objectType: "ARTICLE", title: "一篇文章", summary: "摘要内容", authorDisplayName: "作者甲" }),
    );
    renderPage("?objectType=ARTICLE&objectId=a1");
    expect(await screen.findByText("一篇文章")).toBeInTheDocument();
    expect(screen.getByText("摘要内容")).toBeInTheDocument();
    expect(screen.getByText("作者甲")).toBeInTheDocument();
  });

  it("never renders a raw object id input", async () => {
    // The regression this pass removes: "user manually types a UUID".
    mockedPreview.mockResolvedValue(target());
    renderPage();
    await screen.findByText("举报对象");
    expect(screen.queryByLabelText("对象 ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("对象类型")).not.toBeInTheDocument();
  });

  it("shows where to start when visited with no target", async () => {
    renderPage("");
    expect(
      await screen.findByText("请从需要举报的内容页面发起举报"),
    ).toBeInTheDocument();
    // No dead-end UUID form, and no call to the preview endpoint.
    expect(screen.queryByLabelText("对象 ID")).not.toBeInTheDocument();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  it("offers a safe return path when there is no target", async () => {
    renderPage("");
    expect(await screen.findByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  });

  it("submits the server's identity, not the URL values", async () => {
    mockedPreview.mockResolvedValue(target({ objectType: "MOMENT", objectId: "m1" }));
    mockedSubmit.mockResolvedValue({ reportId: "r-new", id: "r-new", status: "SUBMITTED" });
    renderPage("?objectType=MOMENT&objectId=m1");

    await screen.findByText("举报对象");
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith({
        objectType: "MOMENT",
        objectId: "m1",
        reason: "SPAM",
      }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/reports/r-new"));
  });

  it("includes detail when the user typed one", async () => {
    mockedPreview.mockResolvedValue(target());
    mockedSubmit.mockResolvedValue({ reportId: "r1", id: "r1", status: "SUBMITTED" });
    renderPage();

    await screen.findByText("举报对象");
    fireEvent.change(screen.getByLabelText("补充说明"), { target: { value: "详细描述" } });
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() =>
      expect(mockedSubmit).toHaveBeenCalledWith(expect.objectContaining({ detail: "详细描述" })),
    );
  });

  it("omits detail when the textarea is empty", async () => {
    mockedPreview.mockResolvedValue(target());
    mockedSubmit.mockResolvedValue({ reportId: "r1", id: "r1", status: "SUBMITTED" });
    renderPage();

    await screen.findByText("举报对象");
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    const [payload] = mockedSubmit.mock.calls[0] as [Record<string, unknown>];
    expect("detail" in payload).toBe(false);
  });

  it("says the user already reported this target, honestly", async () => {
    mockedPreview.mockResolvedValue(target({ alreadyReported: true }));
    renderPage();
    expect(
      await screen.findByText("你已经举报过这条内容，再次提交不会重复创建记录。"),
    ).toBeInTheDocument();
  });

  it("explains a 404 target rather than offering the form", async () => {
    mockedPreview.mockRejectedValue(problem(404, "NOT_FOUND"));
    renderPage();
    expect(await screen.findByText("找不到要举报的内容")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交举报" })).not.toBeInTheDocument();
  });

  it("explains that you cannot report your own content", async () => {
    mockedPreview.mockRejectedValue(problem(409, "CONFLICT", "不能举报自己的内容"));
    renderPage();
    expect(await screen.findByText("无法举报这条内容")).toBeInTheDocument();
    expect(screen.getByText("不能举报自己的内容")).toBeInTheDocument();
  });

  it("treats a 401 on the preview as an expired session", async () => {
    mockedPreview.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });

  it("shows the server detail and does not navigate when the submit fails", async () => {
    mockedPreview.mockResolvedValue(target());
    mockedSubmit.mockRejectedValue(problem(409, "CONFLICT", "不能举报自己的内容"));
    renderPage();

    await screen.findByText("举报对象");
    fireEvent.click(screen.getByRole("button", { name: "提交举报" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("不能举报自己的内容");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("offers a cancel link back to the list once a target is loaded", async () => {
    mockedPreview.mockResolvedValue(target());
    renderPage();
    await screen.findByText("举报对象");
    expect(screen.getByRole("link", { name: "取消" })).toHaveAttribute("href", "/reports");
  });
});
