import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import { MySubmissionsPage } from "./MySubmissionsPage";

/*
 * /studio/submissions (Phase 2K-2).
 *
 * This page lists ALL submissions, not just the failed ones (Legacy only showed
 * RETURNED/REJECTED). The behaviours worth pinning:
 *  - every status is labelled with its own copy;
 *  - a null title falls back instead of rendering a blank heading;
 *  - the list is a single bounded read with no pagination control;
 *  - 401 gets its own message (the session expired) vs a generic failure.
 */

vi.mock("@/api/submissions/submissions.api", () => ({
  submissionsApi: { listMine: vi.fn(), getById: vi.fn(), withdraw: vi.fn() },
}));

const mocked = vi.mocked(submissionsApi);

function submission(
  overrides: Partial<ReviewSubmissionDetailView> = {},
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

function renderPage() {
  return render(
    <MemoryRouter>
      <MySubmissionsPage />
    </MemoryRouter>,
  );
}

function problem(status: number, code: string) {
  return new ApiError({ type: "about:blank", title: "", status, detail: "", code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MySubmissionsPage — states", () => {
  it("shows loading first", () => {
    mocked.listMine.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("shows a session-expired message on 401", async () => {
    mocked.listMine.mockRejectedValue(problem(401, "AUTH_REQUIRED"));
    renderPage();
    expect(await screen.findByText("登录状态已过期")).toBeInTheDocument();
  });

  it("shows a generic error on other failures", async () => {
    mocked.listMine.mockRejectedValue(problem(500, "INTERNAL_ERROR"));
    renderPage();
    expect(await screen.findByText("投稿列表加载失败")).toBeInTheDocument();
    expect(screen.queryByText("登录状态已过期")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no submissions", async () => {
    mocked.listMine.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无投稿记录")).toBeInTheDocument();
  });

  it("does NOT paginate — it is a single bounded read", async () => {
    mocked.listMine.mockResolvedValue([submission()]);
    renderPage();
    await screen.findByLabelText("我的投稿列表");
    expect(mocked.listMine).toHaveBeenCalledTimes(1);
    // No limit argument invented either.
    expect(mocked.listMine).toHaveBeenCalledWith();
    expect(screen.queryByRole("button", { name: /下一页|加载更多/ })).not.toBeInTheDocument();
  });
});

describe("MySubmissionsPage — every status is labelled", () => {
  it("labels all five backend statuses with distinct copy", async () => {
    mocked.listMine.mockResolvedValue([
      submission({ id: "s1", status: "PENDING" }),
      submission({ id: "s2", status: "APPROVED" }),
      submission({ id: "s3", status: "REJECTED" }),
      submission({ id: "s4", status: "RETURNED" }),
      submission({ id: "s5", status: "WITHDRAWN" }),
    ]);
    renderPage();

    const list = await screen.findByLabelText("我的投稿列表");
    for (const label of ["待审核", "已通过", "未通过", "已退回", "已撤回"]) {
      expect(within(list).getByText(label)).toBeInTheDocument();
    }
  });

  it("echoes an unknown status verbatim", async () => {
    mocked.listMine.mockResolvedValue([submission({ status: "ESCALATED" })]);
    renderPage();
    const list = await screen.findByLabelText("我的投稿列表");
    expect(within(list).getByText("ESCALATED")).toBeInTheDocument();
  });

  it("lists ALL statuses, not just the failed ones Legacy filtered to", async () => {
    mocked.listMine.mockResolvedValue([
      submission({ id: "s1", status: "PENDING", title: "待审的" }),
      submission({ id: "s2", status: "APPROVED", title: "通过的" }),
    ]);
    renderPage();
    const list = await screen.findByLabelText("我的投稿列表");
    expect(within(list).getByText("待审的")).toBeInTheDocument();
    expect(within(list).getByText("通过的")).toBeInTheDocument();
  });
});

describe("MySubmissionsPage — row content", () => {
  it("falls back for a null title instead of rendering a blank heading", async () => {
    mocked.listMine.mockResolvedValue([submission({ title: null, articleId: "aX" })]);
    renderPage();
    expect(await screen.findByText("未命名投稿（aX）")).toBeInTheDocument();
  });

  it("links the title to the detail page", async () => {
    mocked.listMine.mockResolvedValue([submission({ id: "s9" })]);
    renderPage();
    const list = await screen.findByLabelText("我的投稿列表");
    expect(within(list).getByRole("link", { name: "我的投稿" })).toHaveAttribute(
      "href",
      "/studio/submissions/s9",
    );
  });

  it("offers 查看文章 for APPROVED and 去编辑 otherwise", async () => {
    mocked.listMine.mockResolvedValue([
      submission({ id: "s1", status: "APPROVED", title: "通过的", articleId: "a1" }),
      submission({ id: "s2", status: "PENDING", title: "待审的", articleId: "a2" }),
    ]);
    renderPage();
    const list = await screen.findByLabelText("我的投稿列表");

    expect(within(list).getByRole("link", { name: "查看文章" })).toHaveAttribute(
      "href",
      "/articles/a1",
    );
    expect(within(list).getByRole("link", { name: "去编辑" })).toHaveAttribute(
      "href",
      "/studio/content/a2",
    );
  });

  it("renders the submitted timestamp", async () => {
    mocked.listMine.mockResolvedValue([submission({ submittedAt: "2026-09-20T10:00:00Z" })]);
    renderPage();
    await screen.findByLabelText("我的投稿列表");
    expect(screen.getByText(/提交于/)).toBeInTheDocument();
  });

  it("does not print 'Invalid Date' for an unparseable timestamp", async () => {
    mocked.listMine.mockResolvedValue([submission({ submittedAt: "not-a-date" })]);
    renderPage();
    await screen.findByLabelText("我的投稿列表");
    expect(screen.getByText(/not-a-date/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it("shows the status description for the row", async () => {
    mocked.listMine.mockResolvedValue([submission({ status: "PENDING" })]);
    renderPage();
    await screen.findByLabelText("我的投稿列表");
    expect(screen.getByText(/审核队列/)).toBeInTheDocument();
  });
});
