import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { UserReportDetailView } from "@/api/moderation/moderation.types";
import { ReportDetailPage } from "./ReportDetailPage";

const mockedGet = vi.fn();
const mockedAddSupplement = vi.fn();

vi.mock("@/api/moderation/moderation.api", () => ({
  reportsApi: {
    getById: (...args: unknown[]) => mockedGet(...args),
    addSupplement: (...args: unknown[]) => mockedAddSupplement(...args),
  },
}));

function detail(overrides: Partial<UserReportDetailView> = {}): UserReportDetailView {
  return {
    id: "r1",
    status: "SUBMITTED",
    targetType: "ARTICLE",
    targetId: "a1",
    reason: "SPAM",
    detail: "这是广告",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-21T10:00:00Z",
    // A freshly created report always has a case: submitReport opens one.
    caseId: "case-1",
    caseStatus: "OPEN",
    measureId: null,
    ...overrides,
  };
}

function renderPage(reportId = "r1") {
  return render(
    <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
      <Routes>
        <Route path="/reports/:reportId" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function problem(status: number, code: string, detailText = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail: detailText, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReportDetailPage", () => {
  it("fetches the report by the route param", async () => {
    mockedGet.mockResolvedValue(detail());
    renderPage("r-9");
    await screen.findByText("举报详情");
    expect(mockedGet).toHaveBeenCalledWith("r-9");
  });

  it("renders the reason and the reporter's detail", async () => {
    mockedGet.mockResolvedValue(detail({ reason: "HARASSMENT", detail: "辱骂他人" }));
    renderPage();
    expect(await screen.findByText("HARASSMENT")).toBeInTheDocument();
    expect(screen.getByText("辱骂他人")).toBeInTheDocument();
  });

  it("labels the status with a real value", async () => {
    mockedGet.mockResolvedValue(detail({ status: "CLOSED" }));
    renderPage();
    expect(await screen.findByText("已关闭")).toBeInTheDocument();
  });

  it("echoes an unknown status verbatim", async () => {
    mockedGet.mockResolvedValue(detail({ status: "ESCALATED" }));
    renderPage();
    expect(await screen.findByText("ESCALATED")).toBeInTheDocument();
  });

  it("renders the case block when a case exists", async () => {
    mockedGet.mockResolvedValue(detail({ caseId: "case-abc", caseStatus: "OPEN" }));
    renderPage();
    expect(await screen.findByText("关联案件")).toBeInTheDocument();
    expect(screen.getByText("case-abc")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
  });

  it("omits the case block entirely when caseId is null", async () => {
    // Nullable server-side; an empty box would invent case structure.
    mockedGet.mockResolvedValue(detail({ caseId: null, caseStatus: null }));
    renderPage();
    await screen.findByText("举报详情");
    expect(screen.queryByText("关联案件")).not.toBeInTheDocument();
    expect(screen.queryByText("案件编号")).not.toBeInTheDocument();
  });

  it("offers the appeal link only when a measure exists", async () => {
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: "meas-9" }));
    renderPage();
    const link = await screen.findByRole("link", { name: "对此处置提出申诉" });
    expect(link).toHaveAttribute(
      "href",
      "/appeals/new?caseId=case-1&measureId=meas-9"
    );
  });

  it("withholds the appeal link and explains why when there is no measure", async () => {
    // Without a measure the server refuses the appeal, so the control must not
    // be offered at all — a button that always fails.
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: null }));
    renderPage();
    await screen.findByText("关联案件");
    expect(screen.queryByRole("link", { name: "对此处置提出申诉" })).not.toBeInTheDocument();
    expect(screen.getByText("尚未对该案件作出处置，暂无可申诉的措施。")).toBeInTheDocument();
  });

  it("shows the supplement form while the report is SUBMITTED", async () => {
    mockedGet.mockResolvedValue(detail({ status: "SUBMITTED" }));
    renderPage();
    expect(await screen.findByLabelText("补充信息")).toBeInTheDocument();
  });

  it("shows the supplement form while the report is TRIAGED", async () => {
    mockedGet.mockResolvedValue(detail({ status: "TRIAGED" }));
    renderPage();
    expect(await screen.findByLabelText("补充信息")).toBeInTheDocument();
  });

  it("hides the supplement form once the report is CLOSED", async () => {
    // The server rejects supplements outside SUBMITTED/TRIAGED, so the form
    // would be a control that always fails.
    mockedGet.mockResolvedValue(detail({ status: "CLOSED" }));
    renderPage();
    expect(await screen.findByText("举报已关闭，无法再补充说明。")).toBeInTheDocument();
    expect(screen.queryByLabelText("补充信息")).not.toBeInTheDocument();
  });

  it("posts a supplement and appends it to the list", async () => {
    mockedGet.mockResolvedValue(detail());
    mockedAddSupplement.mockResolvedValue({
      id: "s1",
      body: "更多证据",
      createdAt: "2026-09-22T10:00:00Z",
    });
    renderPage();

    const box = await screen.findByLabelText("补充信息");
    fireEvent.change(box, { target: { value: "更多证据" } });
    fireEvent.click(screen.getByRole("button", { name: "提交补充说明" }));

    await waitFor(() => expect(mockedAddSupplement).toHaveBeenCalledWith("r1", "更多证据"));
    expect(await screen.findByLabelText("补充说明列表")).toHaveTextContent("更多证据");
  });

  it("clears the textarea after a successful supplement", async () => {
    mockedGet.mockResolvedValue(detail());
    mockedAddSupplement.mockResolvedValue({
      id: "s1",
      body: "更多证据",
      createdAt: "2026-09-22T10:00:00Z",
    });
    renderPage();

    const box = (await screen.findByLabelText("补充信息")) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "更多证据" } });
    fireEvent.click(screen.getByRole("button", { name: "提交补充说明" }));

    await waitFor(() => expect(mockedAddSupplement).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByLabelText("补充信息") as HTMLTextAreaElement).value).toBe(""));
  });

  it("keeps the typed text and shows the error when a supplement fails", async () => {
    // Failure must not look like success, and must not eat the user's input.
    mockedGet.mockResolvedValue(detail());
    mockedAddSupplement.mockRejectedValue(problem(400, "INVALID_FIELD", "补充说明不能为空"));
    renderPage();

    const box = await screen.findByLabelText("补充信息");
    fireEvent.change(box, { target: { value: "尝试提交" } });
    fireEvent.click(screen.getByRole("button", { name: "提交补充说明" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("补充说明不能为空");
    expect((screen.getByLabelText("补充信息") as HTMLTextAreaElement).value).toBe("尝试提交");
  });

  it("does not call the API when the supplement draft is blank", async () => {
    mockedGet.mockResolvedValue(detail());
    renderPage();
    const box = await screen.findByLabelText("补充信息");
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "提交补充说明" }));
    expect(mockedAddSupplement).not.toHaveBeenCalled();
  });

  it("says the report is missing or not yours on a 404", async () => {
    // The server does not distinguish "gone" from "not yours".
    mockedGet.mockRejectedValue(problem(404, "NOT_FOUND"));
    renderPage();
    expect(await screen.findByText("找不到该举报")).toBeInTheDocument();
    expect(screen.getByText("这条举报不存在，或者不属于当前账号。")).toBeInTheDocument();
  });

  it("treats a 401 as an expired session", async () => {
    mockedGet.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });
});

