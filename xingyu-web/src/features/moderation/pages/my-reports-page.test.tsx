import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { UserReportView } from "@/api/moderation/moderation.types";
import { MyReportsPage } from "./MyReportsPage";

const mockedList = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  reportsApi: {
    listMine: (...args: unknown[]) => mockedList(...args),
  },
}));

function report(overrides: Partial<UserReportView> = {}): UserReportView {
  return {
    id: "r1",
    status: "SUBMITTED",
    targetType: "ARTICLE",
    targetId: "a1",
    updatedAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyReportsPage />
    </MemoryRouter>
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyReportsPage", () => {
  it("calls listMine with no arguments, because the endpoint takes no limit", async () => {
    mockedList.mockResolvedValue([report()]);
    renderPage();
    await screen.findByLabelText("我的举报列表");
    expect(mockedList).toHaveBeenCalledWith();
  });

  it("renders the target type and id", async () => {
    mockedList.mockResolvedValue([report({ targetType: "MOMENT", targetId: "m-9" })]);
    renderPage();
    const list = await screen.findByLabelText("我的举报列表");
    expect(list).toHaveTextContent("MOMENT");
    expect(list).toHaveTextContent("m-9");
  });

  it("labels SUBMITTED with a real Chinese label", async () => {
    mockedList.mockResolvedValue([report({ status: "SUBMITTED" })]);
    renderPage();
    expect(await screen.findByText("已提交")).toBeInTheDocument();
  });

  it("labels TRIAGED, which Legacy's map did not know about", async () => {
    // Legacy maps PENDING/UNDER_REVIEW/RESOLVED/CLOSED — none of which the
    // backend writes. TRIAGED is a real backend value Legacy would have shown raw.
    mockedList.mockResolvedValue([report({ status: "TRIAGED" })]);
    renderPage();
    expect(await screen.findByText("已受理")).toBeInTheDocument();
  });

  it("labels CLOSED", async () => {
    mockedList.mockResolvedValue([report({ status: "CLOSED" })]);
    renderPage();
    expect(await screen.findByText("已关闭")).toBeInTheDocument();
  });

  it("echoes an unknown status verbatim instead of guessing", async () => {
    // If the backend adds a status, showing it as itself beats showing a wrong word.
    mockedList.mockResolvedValue([report({ status: "ESCALATED" })]);
    renderPage();
    expect(await screen.findByText("ESCALATED")).toBeInTheDocument();
  });

  it("never renders Legacy's invented labels", async () => {
    mockedList.mockResolvedValue([report({ status: "SUBMITTED" })]);
    renderPage();
    await screen.findByText("已提交");
    for (const wrong of ["处理中", "审核中", "已处理"]) {
      expect(screen.queryByText(wrong)).not.toBeInTheDocument();
    }
  });

  it("links each row to the report detail page", async () => {
    mockedList.mockResolvedValue([report({ id: "r-42", targetId: "a1" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: "a1" });
    expect(link).toHaveAttribute("href", "/reports/r-42");
  });

  it("offers a link to the appeals page", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("link", { name: "我的申诉" })).toHaveAttribute(
      "href",
      "/appeals"
    );
  });

  it("shows an empty state when there are no reports", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无举报记录")).toBeInTheDocument();
  });

  it("treats a 401 as an expired session and offers a login link", async () => {
    mockedList.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.getByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("surfaces the server detail for a non-auth failure", async () => {
    mockedList.mockRejectedValue(problem(500, "INTERNAL_ERROR", "服务暂时不可用"));
    renderPage();
    expect(await screen.findByText("服务暂时不可用")).toBeInTheDocument();
    expect(screen.queryByText("登录状态已过期，请重新登录。")).not.toBeInTheDocument();
  });

  it("offers no pagination, because the endpoint returns every report", async () => {
    mockedList.mockResolvedValue([report()]);
    renderPage();
    await screen.findByLabelText("我的举报列表");
    expect(screen.queryByRole("button", { name: /更多|加载/ })).not.toBeInTheDocument();
  });
});

