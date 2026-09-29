import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { meInsightsApi, momentsApi } from "@/api/moments/moments.api";
import type { MomentView } from "@/api/moments/moments.types";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { MyMomentsPage } from "./MyMomentsPage";

/*
 * My moments (Phase 2I-5).
 *
 * The page joins three reads with DIFFERENT failure policies, and that is the
 * behaviour worth pinning:
 *   /me/moments   required — its failure is the page's failure
 *   /me/profile   decoration — failure degrades the header only
 *   /me/insights  decoration — failure renders 「—」, never a fake 0
 *
 * The last one is the subtle one: insights counters are non-null longs
 * server-side, so 0 is a real value. Showing 0 for a failed read would claim the
 * user has written nothing.
 */

vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: { listMine: vi.fn() },
  meInsightsApi: { get: vi.fn() },
}));
vi.mock("@/api/users/users.api", () => ({
  usersApi: { getMyProfile: vi.fn() },
}));

const mockedMoments = vi.mocked(momentsApi);
const mockedInsights = vi.mocked(meInsightsApi);
const mockedUsers = vi.mocked(usersApi);

function moment(overrides: Partial<MomentView> = {}): MomentView {
  return {
    id: "m1",
    body: "今天看到了一颗流星",
    authorId: "u1",
    createdAt: "2026-09-27T02:00:00Z",
    ...overrides,
  };
}

function profile(overrides: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    username: "tester",
    displayName: "测试用户",
    bio: "在星语记录灵感",
    ...overrides,
  };
}

function insights(overrides: Partial<Awaited<ReturnType<typeof meInsightsApi.get>>> = {}) {
  return {
    articleCount: 3,
    draftCount: 1,
    followerCount: 12,
    followingCount: 7,
    commentCount: 5,
    likeCount: 42,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyMomentsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedMoments.listMine.mockResolvedValue([]);
  mockedUsers.getMyProfile.mockResolvedValue(profile());
  mockedInsights.get.mockResolvedValue(insights());
});

describe("MyMomentsPage — loading and errors", () => {
  it("shows a loading state while the list is in flight", () => {
    // Keep the decoration reads pending too, otherwise they resolve after the
    // assertion and React warns about an un-acted update.
    mockedMoments.listMine.mockReturnValue(new Promise(() => {}));
    mockedUsers.getMyProfile.mockReturnValue(new Promise(() => {}));
    mockedInsights.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("asks the user to sign in again when the session expired", async () => {
    mockedMoments.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        code: "AUTH_REQUIRED",
        detail: "",
      }),
    );
    renderPage();

    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("prefers the backend's own wording for a non-auth failure", async () => {
    mockedMoments.listMine.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "动态列表暂时不可用",
        code: "INTERNAL_ERROR",
      }),
    );
    renderPage();
    expect(await screen.findByText("动态列表暂时不可用")).toBeInTheDocument();
  });

  it("still lists the moments when the profile read fails", async () => {
    // The header is decoration; its failure must not take the page down.
    mockedMoments.listMine.mockResolvedValue([moment({ body: "一条动态" })]);
    mockedUsers.getMyProfile.mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText("一条动态")).toBeInTheDocument();
    // Falls back to a neutral heading rather than inventing a name.
    expect(screen.getByRole("heading", { name: "我的动态" })).toBeInTheDocument();
  });

  it("still lists the moments when the insights read fails", async () => {
    mockedMoments.listMine.mockResolvedValue([moment({ body: "一条动态" })]);
    mockedInsights.get.mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText("一条动态")).toBeInTheDocument();
  });
});

describe("MyMomentsPage — the list", () => {
  it("links each moment to its detail page", async () => {
    mockedMoments.listMine.mockResolvedValue([moment({ id: "m-abc", body: "去看流星" })]);
    renderPage();

    const list = await screen.findByLabelText("我的动态列表");
    expect(within(list).getByRole("link", { name: "去看流星" })).toHaveAttribute(
      "href",
      "/moments/m-abc",
    );
  });

  it("marks the newest moment, since the server returns newest-first", async () => {
    mockedMoments.listMine.mockResolvedValue([
      moment({ id: "newest", body: "最新的" }),
      moment({ id: "older", body: "早一点的" }),
    ]);
    renderPage();

    const list = await screen.findByLabelText("我的动态列表");
    const rows = within(list).getAllByRole("listitem");
    expect(within(rows[0]).getByText("最近发布")).toBeInTheDocument();
    expect(within(rows[1]).getByText("发布动态")).toBeInTheDocument();
  });

  it("renders a placeholder for a moment with no body", async () => {
    mockedMoments.listMine.mockResolvedValue([moment({ body: "" })]);
    renderPage();

    const list = await screen.findByLabelText("我的动态列表");
    expect(within(list).getByText("（无内容）")).toBeInTheDocument();
  });

  it("offers an empty state with the way to publish", async () => {
    mockedMoments.listMine.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
    expect(screen.getByText("还没有动态")).toBeInTheDocument();
    // Publishing lives on the feed page, which owns the compose form.
    const publish = screen.getAllByRole("link", { name: /发布动态/ });
    expect(publish.some((link) => link.getAttribute("href") === "/moments")).toBe(true);
  });

  it("asks the server for a bounded page of history, not the whole feed", async () => {
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(mockedMoments.listMine).toHaveBeenCalledWith(50);
  });
});

describe("MyMomentsPage — counters", () => {
  it("shows the insights the server returned", async () => {
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3 篇")).toBeInTheDocument();
  });

  it("renders 「—」 rather than a fake 0 when insights could not be read", async () => {
    // 0 is a real value here (the counters are non-null longs), so a failed read
    // must not be rendered as "you have nothing".
    mockedInsights.get.mockRejectedValue(new Error("network"));
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows a genuine 0 when the server really reports zero", async () => {
    mockedInsights.get.mockResolvedValue(insights({ likeCount: 0, articleCount: 0 }));
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("0 篇")).toBeInTheDocument();
  });

  it("counts the loaded moments, not the insights, for the moment total", async () => {
    mockedMoments.listMine.mockResolvedValue([moment({ id: "a" }), moment({ id: "b" })]);
    renderPage();
    await screen.findByLabelText("我的动态列表");

    expect(screen.getByText("2 条")).toBeInTheDocument();
  });

  it("falls back to the profile's follower count when insights are unavailable", async () => {
    // ProfileDetail also carries followerCount, so the number is not lost.
    mockedInsights.get.mockRejectedValue(new Error("network"));
    mockedUsers.getMyProfile.mockResolvedValue(profile({ followerCount: 9 }));
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getByText("9")).toBeInTheDocument();
  });
});

describe("MyMomentsPage — header", () => {
  it("prefers the display name, falling back to the username", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ displayName: "星野", username: "hoshino" }));
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getByRole("heading", { name: "星野" })).toBeInTheDocument();
    expect(screen.getByText("ID: hoshino")).toBeInTheDocument();
  });

  it("falls back to the username when there is no display name", async () => {
    mockedUsers.getMyProfile.mockResolvedValue(profile({ displayName: null, username: "hoshino" }));
    renderPage();
    await screen.findByTestId("page-state-empty");

    expect(screen.getByRole("heading", { name: "hoshino" })).toBeInTheDocument();
  });
});

