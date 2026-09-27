import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { MyCommentView } from "@/api/me-activity/me-activity.types";
import { MyCommentsPage } from "./MyCommentsPage";

const mockedList = vi.fn();

vi.mock("@/api/me-activity/me-activity.api", () => ({
  myCommentsApi: {
    list: (...args: unknown[]) => mockedList(...args),
  },
}));

function comment(overrides: Partial<MyCommentView> = {}): MyCommentView {
  return {
    id: "c1",
    body: "说得有道理",
    objectType: "ARTICLE",
    objectId: "a1",
    objectTitle: "一篇文章",
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyCommentsPage />
    </MemoryRouter>
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyCommentsPage", () => {
  it("asks for the session user's comments with the default limit", async () => {
    mockedList.mockResolvedValue([comment()]);
    renderPage();
    await screen.findByLabelText("我的评论列表");
    expect(mockedList).toHaveBeenCalledWith(20);
  });

  it("renders the comment body and the content it was left on", async () => {
    mockedList.mockResolvedValue([comment({ body: "写得很清楚", objectTitle: "理解 Vite" })]);
    renderPage();
    const list = await screen.findByLabelText("我的评论列表");
    expect(list).toHaveTextContent("写得很清楚");
    expect(list).toHaveTextContent("理解 Vite");
  });

  it("links to the commented CONTENT, not to the comment id", async () => {
    // V2 ships no /comments/:id route, so linking there would be a dead link.
    mockedList.mockResolvedValue([
      comment({ id: "c-999", objectType: "ARTICLE", objectId: "a1", objectTitle: "一篇文章" }),
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "一篇文章" });
    expect(link).toHaveAttribute("href", "/articles/a1");
    expect(link).not.toHaveAttribute("href", "/comments/c-999");
  });

  it("degrades an unmapped objectType to /discover", async () => {
    mockedList.mockResolvedValue([
      comment({ objectType: "TOPIC", objectId: "t1", objectTitle: "某话题" }),
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "某话题" });
    expect(link).toHaveAttribute("href", "/discover");
  });

  it("shows the objectType alongside the target so an unmapped type is visible", async () => {
    mockedList.mockResolvedValue([
      comment({ objectType: "TOPIC", objectId: "t1", objectTitle: "某话题" }),
    ]);
    renderPage();
    const list = await screen.findByLabelText("我的评论列表");
    expect(list).toHaveTextContent("TOPIC");
  });

  it("falls back to the raw objectId when the server sent no objectTitle", async () => {
    // Server-side fallback: document == null → objectTitle = objectId.
    mockedList.mockResolvedValue([comment({ objectTitle: "", objectId: "dangling-id" })]);
    renderPage();
    const list = await screen.findByLabelText("我的评论列表");
    expect(list).toHaveTextContent("dangling-id");
  });

  it("renders a placeholder for a body that is blank", async () => {
    mockedList.mockResolvedValue([comment({ body: "   " })]);
    renderPage();
    expect(await screen.findByText("（无内容）")).toBeInTheDocument();
  });

  it("shows an empty state when there are no comments", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无评论")).toBeInTheDocument();
  });

  it("does NOT claim to show every comment, because hidden ones are filtered out", async () => {
    // The server filters status='VISIBLE'; a missing row is not evidence the
    // user never wrote it, so the copy must not promise a complete record.
    mockedList.mockResolvedValue([comment()]);
    renderPage();
    const list = await screen.findByLabelText("我的评论列表");
    expect(list).toBeInTheDocument();
    expect(screen.queryByText(/全部评论/)).not.toBeInTheDocument();
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

  it("does not offer pagination, because the endpoint returns a bare array", async () => {
    mockedList.mockResolvedValue([comment()]);
    renderPage();
    await screen.findByLabelText("我的评论列表");
    expect(screen.queryByRole("button", { name: /更多|加载/ })).not.toBeInTheDocument();
  });
});
