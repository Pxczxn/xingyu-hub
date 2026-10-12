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
    targetTitle: "被举报的文章",
    targetSummary: null,
    reason: "SPAM",
    detail: "这是广告",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-21T10:00:00Z",
    // A freshly created report always has a case: submitReport opens one.
    caseId: "case-1",
    caseStatus: "OPEN",
    measureId: null,
    supplements: [],
    ...overrides,
  };
}

function renderPage(reportId = "r1") {
  return render(
    <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
      <Routes>
        <Route path="/reports/:reportId" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
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

  it("renders the reason in user language and the reporter's detail", async () => {
    mockedGet.mockResolvedValue(detail({ reason: "HARASSMENT", detail: "辱骂他人" }));
    renderPage();
    // The reason must be the label the user picked, not the stored enum.
    expect(await screen.findByText("骚扰或人身攻击")).toBeInTheDocument();
    expect(screen.queryByText("HARASSMENT")).not.toBeInTheDocument();
    expect(screen.getByText("辱骂他人")).toBeInTheDocument();
  });

  it("describes the subject in user language and never shows a UUID", async () => {
    mockedGet.mockResolvedValue(
      detail({
        targetType: "ARTICLE",
        targetId: "11111111-2222-3333-4444-555555555555",
        targetTitle: "一篇被举报的文章",
      }),
    );
    renderPage();
    await screen.findByText("举报详情");
    expect(screen.getByText("文章")).toBeInTheDocument();
    expect(screen.getByText("一篇被举报的文章")).toBeInTheDocument();
    expect(screen.queryByText(/11111111-2222-3333-4444-555555555555/)).not.toBeInTheDocument();
    expect(screen.queryByText("ARTICLE")).not.toBeInTheDocument();
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

  it("renders a 处理结果 block when a case exists — no raw case id", async () => {
    mockedGet.mockResolvedValue(detail({ caseId: "case-abc", caseStatus: "OPEN" }));
    renderPage();
    expect(await screen.findByText("处理结果")).toBeInTheDocument();
    // The case id must not be rendered.
    expect(screen.queryByText("case-abc")).not.toBeInTheDocument();
    expect(screen.queryByText("关联案件")).not.toBeInTheDocument();
  });

  it("omits the 处理结果 block entirely when caseId is null", async () => {
    // Nullable server-side; an empty box would invent case structure.
    mockedGet.mockResolvedValue(detail({ caseId: null, caseStatus: null }));
    renderPage();
    await screen.findByText("举报详情");
    expect(screen.queryByText("处理结果")).not.toBeInTheDocument();
    expect(screen.queryByText("关联案件")).not.toBeInTheDocument();
  });

  it("orders sections 对象 → 状态 → 原因说明 → 补充内容 → 处理结果 → 时间", async () => {
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: "meas-9" }));
    renderPage();
    await screen.findByText("举报详情");
    const headings = ["举报详情", "当前状态", "举报原因与说明", "补充内容", "处理结果", "时间"];
    const positions = headings.map((h) => {
      const el = screen.getByText(h);
      return el.getBoundingClientRect().top;
    });
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
    }
  });

  it("never offers an appeal control — the reader is always the reporter", async () => {
    // /reports/:id is the reporter's own view. The server 404s an appeal attempt
    // by anyone but the measure owner (verified), so a link here would be a
    // control that always fails.
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: "meas-9" }));
    renderPage();
    await screen.findByText("处理结果");
    expect(screen.queryByRole("link", { name: /申诉/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /申诉/ })).not.toBeInTheDocument();
    expect(screen.queryByText("meas-9")).not.toBeInTheDocument();
  });

  it("says a result exists once a measure was issued", async () => {
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: "meas-9" }));
    renderPage();
    await screen.findByText("处理结果");
    expect(
      screen.getByText("该举报对应的案件已作出处置。被处理方可以对该处置提出申诉。"),
    ).toBeInTheDocument();
  });

  it("says the case is still being handled while no measure exists", async () => {
    // Without a measure nothing has been executed yet, so the page must not
    // claim a result it cannot see.
    mockedGet.mockResolvedValue(detail({ caseId: "case-1", measureId: null }));
    renderPage();
    await screen.findByText("处理结果");
    expect(screen.getByText(/相关案件正在处理中/)).toBeInTheDocument();
    expect(screen.queryByText(/已作出处置/)).not.toBeInTheDocument();
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

  it("renders supplements that the server already persisted", async () => {
    // The read half of the supplement feature. Before this, a supplement only
    // lived in component state and disappeared on reload; the server now returns
    // the list, so a previously written supplement must be visible immediately.
    mockedGet.mockResolvedValue(
      detail({
        supplements: [
          { id: "s-old", body: "第一次补充", createdAt: "2026-09-21T10:00:00Z" },
          { id: "s-new", body: "第二次补充", createdAt: "2026-09-22T10:00:00Z" },
        ],
      }),
    );
    renderPage();
    const list = await screen.findByLabelText("补充说明列表");
    expect(list).toHaveTextContent("第一次补充");
    expect(list).toHaveTextContent("第二次补充");
    // Ordering is the server's (createdAt ASC); the oldest renders first.
    expect(list.textContent?.indexOf("第一次补充")).toBeLessThan(
      list.textContent?.indexOf("第二次补充") ?? -1,
    );
  });

  it("shows no supplement list when the server returns none", async () => {
    mockedGet.mockResolvedValue(detail({ supplements: [] }));
    renderPage();
    await screen.findByText("举报详情");
    expect(screen.queryByLabelText("补充说明列表")).not.toBeInTheDocument();
    expect(screen.getByText("暂无补充内容。")).toBeInTheDocument();
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
    await waitFor(() =>
      expect((screen.getByLabelText("补充信息") as HTMLTextAreaElement).value).toBe(""),
    );
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
