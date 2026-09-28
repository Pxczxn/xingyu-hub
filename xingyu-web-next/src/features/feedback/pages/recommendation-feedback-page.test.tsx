import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { RECOMMENDATION_FEEDBACK_MAX_LENGTH } from "@/api/recommendation-feedback/recommendation-feedback.types";
import { RecommendationFeedbackPage } from "./RecommendationFeedbackPage";

/*
 * Page tests for /feedback/recommendations (Phase 3F).
 *
 * Behaviours worth pinning beyond the markup:
 *   1. The scope note is rendered — the single biggest misunderstanding risk.
 *   2. NO delete control exists (the backend has no DELETE).
 *   3. A submit prepends from the POST response without refetching.
 */

const list = vi.fn();
const submit = vi.fn();

vi.mock("@/api/recommendation-feedback/recommendation-feedback.api", () => ({
  recommendationFeedbackApi: {
    list: (...args: unknown[]) => list(...args),
    submit: (...args: unknown[]) => submit(...args),
  },
}));

function row(over: Record<string, unknown> = {}) {
  return { id: "f1", body: "推荐太偏技术了", createdAt: "2026-09-28T10:00:00Z", ...over };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/feedback/recommendations"]}>
      <RecommendationFeedbackPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
  submit.mockResolvedValue(row({ id: "new", body: "希望多点设计" }));
});

describe("RecommendationFeedbackPage — loading & error", () => {
  it("shows a loading state first", () => {
    list.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("reports a non-auth failure with the server's detail", async () => {
    list.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "boom", status: 500, detail: "系统繁忙，请稍后再试", code: "INTERNAL_ERROR" }),
    );
    renderPage();
    const alert = await screen.findByTestId("page-state-error");
    expect(alert).toHaveTextContent("系统繁忙，请稍后再试");
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });

  it("tells an expired session to log in again (401)", async () => {
    list.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "请先登录", status: 401, detail: "请先登录", code: "AUTH_REQUIRED" }),
    );
    renderPage();
    await screen.findByTestId("page-state-error");
    expect(screen.getByRole("link", { name: "去登录" })).toBeInTheDocument();
  });
});

describe("RecommendationFeedbackPage — framing", () => {
  it("states the SCOPE up front (whole recommender, not one article)", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "推荐反馈" })).toBeInTheDocument();
    expect(screen.getByText(/整个推荐系统/)).toBeInTheDocument();
    expect(screen.getByText(/不是针对某一篇文章/)).toBeInTheDocument();
  });

  it("warns that submission cannot be undone", async () => {
    renderPage();
    expect(await screen.findByText(/无法修改或删除/)).toBeInTheDocument();
  });

  it("ships NO delete or edit control (the backend has neither)", async () => {
    list.mockResolvedValue([row()]);
    renderPage();
    await screen.findByText("推荐太偏技术了");
    expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /修改/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /撤销/ })).not.toBeInTheDocument();
  });

  it("states the real display ceiling", async () => {
    list.mockResolvedValue([row()]);
    renderPage();
    expect(await screen.findByText(/最多显示最近 20 条/)).toBeInTheDocument();
  });
});

describe("RecommendationFeedbackPage — listing", () => {
  it("renders an explicit empty state", async () => {
    renderPage();
    expect(await screen.findByText("还没有提交过反馈")).toBeInTheDocument();
  });

  it("renders existing rows with their timestamps", async () => {
    list.mockResolvedValue([
      row({ id: "a", body: "推荐太偏技术了" }),
      row({ id: "b", body: "希望多点设计", createdAt: "2026-09-27T08:00:00Z" }),
    ]);
    renderPage();
    expect(await screen.findByText("推荐太偏技术了")).toBeInTheDocument();
    expect(screen.getByText("希望多点设计")).toBeInTheDocument();
    expect(screen.getByText("2 条")).toBeInTheDocument();
  });

  it("preserves multi-line bodies", async () => {
    list.mockResolvedValue([row({ body: "第一行\n第二行" })]);
    renderPage();
    const text = await screen.findByText(/第一行/);
    expect(text).toHaveTextContent("第一行 第二行");
  });
});

describe("RecommendationFeedbackPage — submitting", () => {
  it("disables submit until there is non-whitespace input", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: "提交反馈" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "   " } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "有内容" } });
    expect(button).toBeEnabled();
  });

  it("submits the TRIMMED body", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("反馈内容"), {
      target: { value: "  希望多点设计  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith("希望多点设计");
  });

  it("prepends the response row WITHOUT refetching and clears the textarea", async () => {
    renderPage();
    const textarea = await screen.findByLabelText("反馈内容");
    fireEvent.change(textarea, { target: { value: "希望多点设计" } });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    expect(await screen.findByText("已提交，感谢反馈")).toBeInTheDocument();
    expect(screen.getByText("希望多点设计")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
    // The POST response IS the stored row — no second read.
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("keeps the textarea on a server rejection so the user can retry", async () => {
    submit.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "校验失败", status: 400, detail: "body: 反馈内容不能为空", code: "VALIDATION_FAILED" }),
    );
    renderPage();
    const textarea = await screen.findByLabelText("反馈内容");
    fireEvent.change(textarea, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    expect(await screen.findByText("body: 反馈内容不能为空")).toBeInTheDocument();
    expect(textarea).toHaveValue("x");
  });

  it("blocks an over-limit body locally without calling the API", async () => {
    renderPage();
    const textarea = await screen.findByLabelText("反馈内容");
    fireEvent.change(textarea, { target: { value: "x".repeat(RECOMMENDATION_FEEDBACK_MAX_LENGTH + 1) } });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    expect(await screen.findByText(/不能超过 2000 字/)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("counts down the remaining characters", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("反馈内容"), { target: { value: "abc" } });
    expect(screen.getByText(`还可输入 ${RECOMMENDATION_FEEDBACK_MAX_LENGTH - 3} 字`)).toBeInTheDocument();
  });

  it("does NOT claim a pre-existing row is the just-submitted one", async () => {
    // The reload raced: the list already contains a row, and the new POST
    // returns a row that IS in the list, so confirmation is legitimate —
    // but an unrelated row must never trigger it.
    list.mockResolvedValue([row({ id: "old" })]);
    submit.mockResolvedValue(row({ id: "brand-new" }));
    renderPage();
    await screen.findByText("推荐太偏技术了");
    expect(screen.queryByText("已提交，感谢反馈")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "新反馈" } });
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));
    expect(await screen.findByText("已提交，感谢反馈")).toBeInTheDocument();
  });
});
