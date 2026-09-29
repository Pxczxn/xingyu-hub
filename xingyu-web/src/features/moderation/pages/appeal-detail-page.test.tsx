import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { AppealDetailView } from "@/api/moderation/moderation.types";
import { AppealDetailPage } from "./AppealDetailPage";

const mockedGet = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  appealsApi: {
    getById: (...args: unknown[]) => mockedGet(...args),
  },
}));

function appeal(overrides: Partial<AppealDetailView> = {}): AppealDetailView {
  return {
    id: "ap1",
    caseId: "case-1",
    body: "我认为该处置过重",
    status: "SUBMITTED",
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage(appealId = "ap1") {
  return render(
    <MemoryRouter initialEntries={[`/appeals/${appealId}`]}>
      <Routes>
        <Route path="/appeals/:appealId" element={<AppealDetailPage />} />
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

describe("AppealDetailPage", () => {
  it("fetches the appeal by the route param", async () => {
    mockedGet.mockResolvedValue(appeal());
    renderPage("ap-5");
    await screen.findByText("申诉详情");
    expect(mockedGet).toHaveBeenCalledWith("ap-5");
  });

  it("renders the appeal body", async () => {
    mockedGet.mockResolvedValue(appeal({ body: "处理过重，请复核" }));
    renderPage();
    expect(await screen.findByText("处理过重，请复核")).toBeInTheDocument();
  });

  it("renders the case id", async () => {
    mockedGet.mockResolvedValue(appeal({ caseId: "case-zzz" }));
    renderPage();
    expect(await screen.findByText("case-zzz")).toBeInTheDocument();
  });

  it("labels SUBMITTED", async () => {
    mockedGet.mockResolvedValue(appeal({ status: "SUBMITTED" }));
    renderPage();
    expect(await screen.findByText("已提交")).toBeInTheDocument();
  });

  it("labels DECIDED", async () => {
    mockedGet.mockResolvedValue(appeal({ status: "DECIDED" }));
    renderPage();
    expect(await screen.findByText("已裁定")).toBeInTheDocument();
  });

  it("echoes an unknown status verbatim", async () => {
    mockedGet.mockResolvedValue(appeal({ status: "WITHDRAWN" }));
    renderPage();
    expect(await screen.findByText("WITHDRAWN")).toBeInTheDocument();
  });

  it("does not render a case status, because the DTO does not carry one", async () => {
    // Only the case ID is on AppealDetailView. Claiming a case status here would
    // be inventing data. (It lives on the report detail as `caseStatus`.)
    mockedGet.mockResolvedValue(appeal());
    renderPage();
    await screen.findByText("申诉详情");
    expect(screen.queryByText("案件状态")).not.toBeInTheDocument();
  });

  it("links back to the appeal list", async () => {
    mockedGet.mockResolvedValue(appeal());
    renderPage();
    expect(await screen.findByRole("link", { name: /返回申诉列表/ })).toHaveAttribute(
      "href",
      "/appeals",
    );
  });

  it("says the appeal is missing or not yours on a 404", async () => {
    mockedGet.mockRejectedValue(problem(404, "NOT_FOUND"));
    renderPage();
    expect(await screen.findByText("找不到该申诉")).toBeInTheDocument();
    expect(screen.getByText("这条申诉不存在，或者不属于当前账号。")).toBeInTheDocument();
  });

  it("treats a 401 as an expired session", async () => {
    mockedGet.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });

  it("surfaces the server detail for a non-auth, non-404 failure", async () => {
    mockedGet.mockRejectedValue(problem(500, "INTERNAL_ERROR", "服务暂时不可用"));
    renderPage();
    expect(await screen.findByText("服务暂时不可用")).toBeInTheDocument();
  });
});
