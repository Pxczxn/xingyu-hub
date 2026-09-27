import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import { SubmissionDetailPage } from "./SubmissionDetailPage";

/*
 * /studio/submissions/:submissionId (Phase 2K-2).
 *
 * ⚠️ The withdraw control is NEW FUNCTIONALITY, not a migration — Legacy defined
 * the API function but never called it, so its detail page was read-only.
 *
 * The rules the server enforces, and that these tests pin:
 *  - withdraw is offered ONLY for PENDING (else CONFLICT);
 *  - the confirmation states the article returns to an editable state;
 *  - on success the row takes the SERVER's status (WITHDRAWN), no refetch;
 *  - a 409 keeps the page usable and explains, rather than pretending success;
 *  - a 404 makes the page unavailable.
 */

vi.mock("@/api/submissions/submissions.api", () => ({
  submissionsApi: { listMine: vi.fn(), getById: vi.fn(), withdraw: vi.fn() },
}));

const mocked = vi.mocked(submissionsApi);

function submission(
  overrides: Partial<ReviewSubmissionDetailView> = {}
): ReviewSubmissionDetailView {
  return {
    id: "s1",
    articleId: "a1",
    title: "我的投稿",
    coverUrl: null,
    status: "PENDING",
    submittedAt: "2026-09-20T10:00:00Z",
    decision: null,
    decisionComment: null,
    ...overrides,
  };
}

function renderPage(submissionId = "s1") {
  return render(
    <MemoryRouter initialEntries={[`/studio/submissions/${submissionId}`]}>
      <Routes>
        <Route path="/studio/submissions/:submissionId" element={<SubmissionDetailPage />} />
        <Route path="/studio/submissions" element={<p>列表页</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function problem(status: number, code: string, detail = "") {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubmissionDetailPage — states", () => {
  it("shows loading first", () => {
    mocked.getById.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows a generic error for a non-404 failure", async () => {
    mocked.getById.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("treats 404 as unavailable — missing OR not ours, indistinguishable", async () => {
    mocked.getById.mockRejectedValue(problem(404, "NOT_FOUND"));
    renderPage();
    expect(await screen.findByText("投稿不存在或无权查看")).toBeInTheDocument();
  });

  it("treats a missing route param as unavailable without calling the API", () => {
    render(
      <MemoryRouter initialEntries={["/studio/submissions"]}>
        <Routes>
          <Route path="/studio/submissions" element={<SubmissionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("投稿不存在或无权查看")).toBeInTheDocument();
    expect(mocked.getById).not.toHaveBeenCalled();
  });
});

describe("SubmissionDetailPage — content", () => {
  it("renders the title, status label and submitted time", async () => {
    mocked.getById.mockResolvedValue(submission());
    renderPage();
    expect(await screen.findByRole("heading", { name: "我的投稿" })).toBeInTheDocument();
    expect(screen.getByTestId("submission-status")).toHaveTextContent("待审核");
    expect(screen.getByText(/2026-09-20T10:00:00Z/)).toBeInTheDocument();
  });

  it("falls back for a null title", async () => {
    mocked.getById.mockResolvedValue(submission({ title: null, articleId: "aX" }));
    renderPage();
    expect(await screen.findByText("未命名投稿（aX）")).toBeInTheDocument();
  });

  it("shows an explicit empty note when there is no reviewer comment", async () => {
    // Must not invent a reviewer opinion.
    mocked.getById.mockResolvedValue(submission({ decisionComment: null }));
    renderPage();
    expect(await screen.findByTestId("submission-no-feedback")).toHaveTextContent("暂无审核意见");
  });

  it("shows the reviewer comment when present", async () => {
    mocked.getById.mockResolvedValue(
      submission({ status: "REJECTED", decision: "REJECTED", decisionComment: "标题需修改" }),
    );
    renderPage();
    expect(await screen.findByText("标题需修改")).toBeInTheDocument();
  });

  it("links APPROVED content to the public article page", async () => {
    mocked.getById.mockResolvedValue(submission({ status: "APPROVED" }));
    renderPage();
    expect(await screen.findByRole("link", { name: "查看文章" })).toHaveAttribute(
      "href",
      "/articles/a1",
    );
  });

  it("links non-approved content back to the editor", async () => {
    mocked.getById.mockResolvedValue(submission({ status: "RETURNED" }));
    renderPage();
    expect(await screen.findByRole("link", { name: "去编辑稿件" })).toHaveAttribute(
      "href",
      "/studio/content/a1",
    );
  });

  it("renders no article link at all when articleId is missing", async () => {
    mocked.getById.mockResolvedValue(submission({ articleId: "" }));
    renderPage();
    await screen.findByRole("heading", { name: "投稿详情" });
    expect(screen.queryByRole("link", { name: /查看文章|去编辑稿件/ })).not.toBeInTheDocument();
  });
});

describe("SubmissionDetailPage — withdraw is offered only for PENDING", () => {
  for (const status of ["APPROVED", "REJECTED", "RETURNED", "WITHDRAWN"]) {
    it(`hides the withdraw button for ${status}`, async () => {
      mocked.getById.mockResolvedValue(submission({ status }));
      renderPage();
      await screen.findByRole("heading", { name: "投稿详情" });
      expect(screen.queryByRole("button", { name: "撤回投稿" })).not.toBeInTheDocument();
    });
  }

  it("shows the withdraw button for PENDING", async () => {
    mocked.getById.mockResolvedValue(submission({ status: "PENDING" }));
    renderPage();
    expect(await screen.findByRole("button", { name: "撤回投稿" })).toBeInTheDocument();
  });
});

describe("SubmissionDetailPage — withdraw flow", () => {
  it("asks for confirmation first and states the article becomes editable again", async () => {
    mocked.getById.mockResolvedValue(submission());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));

    const dialog = screen.getByRole("alertdialog", { name: "确认撤回投稿" });
    expect(dialog).toHaveTextContent("回到可编辑状态");
    // Nothing sent until the user confirms.
    expect(mocked.withdraw).not.toHaveBeenCalled();
  });

  it("can cancel without calling the API", async () => {
    mocked.getById.mockResolvedValue(submission());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mocked.withdraw).not.toHaveBeenCalled();
  });

  it("applies the SERVER's status after a successful withdraw, without refetching", async () => {
    mocked.getById.mockResolvedValue(submission({ status: "PENDING" }));
    mocked.withdraw.mockResolvedValue({ id: "s1", status: "WITHDRAWN" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    await waitFor(() => expect(screen.getByTestId("submission-status")).toHaveTextContent("已撤回"));
    expect(mocked.withdraw).toHaveBeenCalledWith("s1");
    // The server's answer is the truth — no second GET.
    expect(mocked.getById).toHaveBeenCalledTimes(1);
    // The control disappears with the new status.
    expect(screen.queryByRole("button", { name: "撤回投稿" })).not.toBeInTheDocument();
  });

  it("reports a 409 clearly and keeps the page usable", async () => {
    mocked.getById.mockResolvedValue(submission({ status: "PENDING" }));
    mocked.withdraw.mockRejectedValue(problem(409, "CONFLICT", "只能撤回待审核的提交"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("只能撤回待审核的提交");
    // Did NOT flip to a fake WITHDRAWN state.
    expect(screen.getByTestId("submission-status")).toHaveTextContent("待审核");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("falls back to a generic 409 message when the server sends no detail", async () => {
    mocked.getById.mockResolvedValue(submission());
    mocked.withdraw.mockRejectedValue(problem(409, "CONFLICT", ""));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("不允许撤回");
  });

  it("turns the page unavailable on a 404 withdraw", async () => {
    mocked.getById.mockResolvedValue(submission());
    mocked.withdraw.mockRejectedValue(problem(404, "NOT_FOUND"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    expect(await screen.findByText("投稿不存在或无权查看")).toBeInTheDocument();
  });

  it("surfaces the server's detail on an unexpected failure and keeps the page usable", async () => {
    mocked.getById.mockResolvedValue(submission());
    mocked.withdraw.mockRejectedValue(problem(500, "INTERNAL_ERROR", "服务器开小差了"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    // When the server explains itself we show that text, not our own wording.
    expect(await screen.findByRole("alert")).toHaveTextContent("服务器开小差了");
    expect(screen.getByTestId("submission-status")).toHaveTextContent("待审核");
  });

  it("falls back to generic copy when the server sends no detail", async () => {
    mocked.getById.mockResolvedValue(submission());
    mocked.withdraw.mockRejectedValue(problem(500, "INTERNAL_ERROR", ""));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "撤回投稿" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤回" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("撤回失败");
    expect(screen.getByTestId("submission-status")).toHaveTextContent("待审核");
  });
});
