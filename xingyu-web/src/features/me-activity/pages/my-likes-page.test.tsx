import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import type { MyLikeView } from "@/api/me-activity/me-activity.types";
import { MyLikesPage } from "./MyLikesPage";

const mockedList = vi.fn();

vi.mock("@/api/me-activity/me-activity.api", () => ({
  myLikesApi: {
    list: (...args: unknown[]) => mockedList(...args),
  },
}));

function like(overrides: Partial<MyLikeView> = {}): MyLikeView {
  return {
    objectType: "ARTICLE",
    objectId: "a1",
    title: "一篇文章",
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyLikesPage />
    </MemoryRouter>
  );
}

function problem(status: number, code: string, detail = ""): ApiError {
  return new ApiError({ type: "about:blank", title: "", status, detail, code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyLikesPage", () => {
  it("asks for the session user's likes with the default limit", async () => {
    mockedList.mockResolvedValue([like()]);
    renderPage();
    await screen.findByLabelText("我的点赞列表");
    expect(mockedList).toHaveBeenCalledWith(20);
  });

  it("renders a like row with its title, type and time", async () => {
    mockedList.mockResolvedValue([like({ title: "星语写作指南", objectType: "SERIES" })]);
    renderPage();
    const list = await screen.findByLabelText("我的点赞列表");
    expect(list).toHaveTextContent("星语写作指南");
    expect(list).toHaveTextContent("SERIES");
  });

  it("keys rows by objectType+objectId because MyLikeView has no id", async () => {
    // Two likes of the same object id but different types must both render —
    // this is exactly what a naive `key={objectId}` would collapse.
    mockedList.mockResolvedValue([
      like({ objectType: "ARTICLE", objectId: "same" }),
      like({ objectType: "MOMENT", objectId: "same" }),
    ]);
    renderPage();
    const list = await screen.findByLabelText("我的点赞列表");
    expect(list.querySelectorAll("li")).toHaveLength(2);
  });

  it("links an ARTICLE like to the article route", async () => {
    mockedList.mockResolvedValue([like({ objectType: "ARTICLE", objectId: "abc" })]);
    renderPage();
    const link = await screen.findByRole("link", { name: "一篇文章" });
    expect(link).toHaveAttribute("href", "/articles/abc");
  });

  it("links a MOMENT like to the moment route", async () => {
    mockedList.mockResolvedValue([
      like({ objectType: "MOMENT", objectId: "m1", title: "一条动态" }),
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "一条动态" });
    expect(link).toHaveAttribute("href", "/moments/m1");
  });

  it("degrades an unmapped objectType to /discover instead of guessing a route", async () => {
    mockedList.mockResolvedValue([
      like({ objectType: "USER", objectId: "u1", title: "某用户" }),
    ]);
    renderPage();
    const link = await screen.findByRole("link", { name: "某用户" });
    // Never /u/u1 — the shared contentHref refuses to guess.
    expect(link).toHaveAttribute("href", "/discover");
  });

  it("falls back to the raw objectId when the server sent no title", async () => {
    // The backend does exactly this when no search_document row exists, so an
    // id-shaped title is real data and must be shown, not prettified away.
    mockedList.mockResolvedValue([like({ title: "", objectId: "dangling-id" })]);
    renderPage();
    const list = await screen.findByLabelText("我的点赞列表");
    expect(list).toHaveTextContent("dangling-id");
  });

  it("shows an empty state when there are no likes", async () => {
    mockedList.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("暂无点赞")).toBeInTheDocument();
  });

  it("treats a 401 as an expired session and offers a login link", async () => {
    mockedList.mockRejectedValue(problem(401, "AUTH_REQUIRED", "请先登录"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.getByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("treats an AUTH_REQUIRED code as expired even without a 401 status", async () => {
    mockedList.mockRejectedValue(problem(403, "AUTH_REQUIRED"));
    renderPage();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
  });

  it("surfaces the server detail for a non-auth failure", async () => {
    mockedList.mockRejectedValue(problem(500, "INTERNAL_ERROR", "服务暂时不可用"));
    renderPage();
    expect(await screen.findByText("服务暂时不可用")).toBeInTheDocument();
    // A non-auth failure must NOT be reported as an expired session.
    expect(screen.queryByText("登录状态已过期，请重新登录。")).not.toBeInTheDocument();
  });

  it("does not offer pagination, because the endpoint returns a bare array", async () => {
    mockedList.mockResolvedValue([like()]);
    renderPage();
    await screen.findByLabelText("我的点赞列表");
    expect(screen.queryByRole("button", { name: /更多|加载/ })).not.toBeInTheDocument();
  });
});

