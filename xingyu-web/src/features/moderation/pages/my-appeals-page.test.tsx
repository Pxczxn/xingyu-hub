import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { AppealDetailView } from "@/api/moderation/moderation.types";
import { MyAppealsPage } from "./MyAppealsPage";

const mockedList = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  appealsApi: {
    listMine: (...args: unknown[]) => mockedList(...args),
  },
}));

function appeal(overrides: Partial<AppealDetailView> = {}): AppealDetailView {
  return {
    id: "ap1",
    caseId: "case-1",
    body: "我认为该处置不当",
    status: "SUBMITTED",
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyAppealsPage />
    </MemoryRouter>,
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyAppealsPage", () => {
  it("asks for the default limit", async () => {
    mockedList.mockResolvedValue([appeal()]);
    renderPage();
    await screen.findByLabelText("我的申诉列表");
    expect(mockedList).toHaveBeenCalledWith(20);
  });

  it("renders the appeal body and its case id", async () => {
    mockedList.mockResolvedValue([appeal({ body: "处置过重", caseId: "case-xyz" })]);
    renderPage();
    const list = await screen.findByLabelText("我的申诉列表");
    expect(list).toHaveTextContent("处置过重");
    expect(list).toHaveTextContent("case-xyz");
  });

  it("labels SUBMITTED", async () => {
    mockedList.mockResolvedValue([appeal({ status: "SUBMITTED" })]);
    renderPage();
    expect(await screen.findByText("已提交")).toBeInTheDocument();
  });

  it("labels DECIDED", async () => {
    mockedList.mockResolvedValue([appeal({ status: "DECIDED" })]);
    renderPage();
    expect(await screen.findByText("已裁定")).toBeInTheDocument();
  });

  it("echoes an unknown status verbatim", async () => {
    mockedList.mockResolvedValue([appeal({ status: "WITHDRAWN" })]);
    renderPage();
    expect(await screen.findByText("WITHDRAWN")).toBeInTheDocument();
  });

  it("links each row to the appeal detail page", async () => {
    mockedList.mockResolvedValue([appeal({ id: "ap-77", body: "理由在此" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: "理由在此" });
    expect(link).toHaveAttribute("href", "/appeals/ap-77");
  });

  it("renders a placeholder for a blank body", async () => {
    mockedList.mockResolvedValue([appeal({ body: "  " })]);
    renderPage();
    expect(await screen.findByText("（无内容）")).toBeInTheDocument();
  });

  it("offers a link back to the reports page", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("link", { name: "我的举报" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  it("shows an empty state when there are no appeals", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无申诉记录")).toBeInTheDocument();
  });

  it("treats a 401 as an expired session", async () => {
    mockedList.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });

  it("surfaces the server detail for a non-auth failure", async () => {
    mockedList.mockRejectedValue(problem(500, "INTERNAL_ERROR", "服务暂时不可用"));
    renderPage();
    expect(await screen.findByText("服务暂时不可用")).toBeInTheDocument();
  });

  it("does not claim to know the case status, because the DTO has no such field", async () => {
    // AppealDetailView is id/caseId/body/status/createdAt only. The case's own
    // progress is exposed on the REPORT detail, not here.
    mockedList.mockResolvedValue([appeal()]);
    renderPage();
    await screen.findByLabelText("我的申诉列表");
    expect(screen.queryByText("案件状态")).not.toBeInTheDocument();
  });

  it("offers no pagination, because the endpoint returns a bare array", async () => {
    mockedList.mockResolvedValue([appeal()]);
    renderPage();
    await screen.findByLabelText("我的申诉列表");
    expect(screen.queryByRole("button", { name: /更多|加载/ })).not.toBeInTheDocument();
  });
});
