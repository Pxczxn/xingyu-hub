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
    status: "PENDING",
    outcome: "PENDING",
    decidedAt: null,
    decisionNote: null,
    targetType: "ARTICLE",
    targetId: "a1",
    targetTitle: "被隐藏的文章",
    targetSummary: null,
    measureType: "HIDE_CONTENT",
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

  it("renders the original object and measure, never the case UUID", async () => {
    mockedGet.mockResolvedValue(
      appeal({ caseId: "case-zzz", targetTitle: "被隐藏的文章", measureType: "HIDE_CONTENT" }),
    );
    renderPage();
    expect(await screen.findByText("被隐藏的文章")).toBeInTheDocument();
    expect(screen.getByText("隐藏内容")).toBeInTheDocument();
    // Neither the case id nor the object id may appear.
    expect(screen.queryByText(/case-zzz/)).not.toBeInTheDocument();
    expect(screen.queryByText("a1")).not.toBeInTheDocument();
  });

  it("labels PENDING and claims no result yet", async () => {
    mockedGet.mockResolvedValue(appeal({ status: "PENDING", outcome: "PENDING" }));
    renderPage();
    expect(await screen.findByText("待处理")).toBeInTheDocument();
    expect(screen.getByText(/申诉正在处理中/)).toBeInTheDocument();
    // Nothing may assert a consequence while undecided.
    expect(screen.queryByText(/原处理措施已撤销/)).not.toBeInTheDocument();
    expect(screen.queryByText(/原处理继续有效/)).not.toBeInTheDocument();
  });

  it("APPROVED states the executed fact: the measure was revoked", async () => {
    mockedGet.mockResolvedValue(
      appeal({
        status: "APPROVED",
        outcome: "APPROVED",
        decisionNote: "申诉成立，恢复内容",
        decidedAt: "2026-09-25T10:00:00Z",
      }),
    );
    renderPage();
    await screen.findByText("申诉详情");
    // "已批准" appears twice on purpose: the header status chip and the 最终结果
    // value. Both are the same word — that is the point of the contract.
    expect(screen.getAllByText("已批准").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/原处理措施已撤销/)).toBeInTheDocument();
    expect(screen.getByText("申诉成立，恢复内容")).toBeInTheDocument();
    expect(screen.getByText("处理说明")).toBeInTheDocument();
    // A rejected-consequence sentence must not appear.
    expect(screen.queryByText(/原处理继续有效/)).not.toBeInTheDocument();
  });

  it("REJECTED states the executed fact: the measure stands", async () => {
    mockedGet.mockResolvedValue(
      appeal({
        status: "REJECTED",
        outcome: "REJECTED",
        decisionNote: "维持原决定",
        decidedAt: "2026-09-25T10:00:00Z",
      }),
    );
    renderPage();
    await screen.findByText("申诉详情");
    expect(screen.getAllByText("已驳回").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/原处理继续有效/)).toBeInTheDocument();
    expect(screen.getByText("维持原决定")).toBeInTheDocument();
    // A rejected appeal must not read as approved.
    expect(screen.queryByText("已批准")).not.toBeInTheDocument();
    expect(screen.queryByText(/原处理措施已撤销/)).not.toBeInTheDocument();
  });

  it("never uses the dead word 「已决定」", async () => {
    mockedGet.mockResolvedValue(
      appeal({ status: "APPROVED", outcome: "APPROVED", decidedAt: "2026-09-25T10:00:00Z" }),
    );
    renderPage();
    await screen.findByText("申诉详情");
    expect(screen.queryByText(/已决定/)).not.toBeInTheDocument();
  });

  it("echoes an unknown status verbatim", async () => {
    mockedGet.mockResolvedValue(appeal({ status: "WITHDRAWN" }));
    renderPage();
    expect(await screen.findByText("WITHDRAWN")).toBeInTheDocument();
  });

  it("does not render a case status, because the DTO does not carry one", async () => {
    // The appeal DTO carries the original object and the measure, but no case
    // status. Claiming one here would be inventing data. (It lives on the report
    // detail as `caseStatus`.)
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
