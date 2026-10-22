import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import { articlesApi } from "@/api/articles/articles.api";
import { ApiError } from "@/api/client";
import { GalaxyDetailPage } from "./pages/GalaxyDetailPage";
import { GalaxyMembersPage } from "./pages/GalaxyMembersPage";
import { GalaxyContentPage } from "./pages/GalaxyContentPage";

const authState = { isAuthenticated: false };

vi.mock("@/api/galaxies/galaxies.api", () => ({
  galaxiesApi: {
    list: vi.fn(),
    getBySlug: vi.fn(),
    listMembers: vi.fn(),
    listContent: vi.fn(),
    listMine: vi.fn(),
    join: vi.fn(),
    apply: vi.fn(),
    submitContent: vi.fn(),
    listMySubmissions: vi.fn(),
  },
}));

vi.mock("@/api/articles/articles.api", () => ({
  articlesApi: {
    listMine: vi.fn(),
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => authState,
}));

const mocked = vi.mocked(galaxiesApi);
const mockedArticles = vi.mocked(articlesApi);

const GALAXY = {
  id: "g-1",
  slug: "xingyu-official",
  name: "星语",
  official: true,
  memberCount: 12,
  joinMode: "OPEN",
};

const MEMBERS = [
  {
    userId: "u-1",
    username: "series_probe",
    displayName: "探针",
    role: "OWNER",
    joinedAt: "2026-09-27T10:00:00Z",
  },
  {
    userId: "u-2",
    username: "alice",
    displayName: null,
    role: "MEMBER",
    joinedAt: "2026-09-26T10:00:00Z",
  },
];

const CONTENT = [
  { id: "c-1", objectType: "ARTICLE", objectId: "art-1", title: "第一篇", pinned: false },
  { id: "c-2", objectType: "SERIES", objectId: "ser-1", title: "置顶系列", pinned: true },
  { id: "c-3", objectType: "MOMENT", objectId: "mom-1", title: "一条动态", pinned: false },
];

function renderPage(path: string, element: React.ReactNode, pattern: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  mocked.getBySlug.mockResolvedValue(GALAXY);
  mocked.listMembers.mockResolvedValue(MEMBERS);
  mocked.listContent.mockResolvedValue(CONTENT);
  mocked.listMine.mockResolvedValue([]);
  mocked.listMySubmissions.mockResolvedValue([]);
  mockedArticles.listMine.mockResolvedValue([]);
});

describe("GalaxyShell", () => {
  it("shows the galaxy name and kind in the shared header", async () => {
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");
    expect(await screen.findByRole("heading", { level: 1, name: "星语" })).toBeInTheDocument();
    expect(screen.getByText("官方星系")).toBeInTheDocument();
    expect(screen.getByText("12 位成员")).toBeInTheDocument();
  });

  it("shows the unavailable state when the galaxy 404s", async () => {
    mocked.getBySlug.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );
    renderPage("/galaxies/nope", <GalaxyDetailPage />, "/galaxies/:slug");
    expect(await screen.findByText("星系不存在或尚未公开")).toBeInTheDocument();
  });

  it("distinguishes a transport error from a 404 and offers a retry", async () => {
    mocked.getBySlug.mockRejectedValue(new Error("boom"));
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-current", async () => {
    renderPage(
      "/galaxies/xingyu-official/members",
      <GalaxyMembersPage />,
      "/galaxies/:slug/members",
    );
    const tab = await screen.findByRole("link", { name: "成员" });
    expect(tab).toHaveAttribute("aria-current", "page");
  });

  it("sends guests to login instead of showing a join button", async () => {
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");
    const link = await screen.findByRole("link", { name: "登录后加入星系" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fgalaxies%2Fxingyu-official");
    expect(screen.queryByRole("button", { name: "加入星系" })).not.toBeInTheDocument();
  });

  it("offers the apply flow up-front for APPROVAL galaxies", async () => {
    // Galaxy Identity Contract：joinMode 已暴露，APPROVAL 直接展示申请流（无需 409 探测）
    authState.isAuthenticated = true;
    mocked.getBySlug.mockResolvedValue({ ...GALAXY, joinMode: "APPROVAL", joined: false });
    mocked.apply.mockResolvedValue({
      id: "req-pending",
      galaxyId: "g-1",
      galaxySlug: "xingyu-official",
      galaxyName: "星语",
      message: null,
      status: "PENDING",
      createdAt: "2026-10-10T00:00:00Z",
    });

    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByRole("button", { name: "申请加入" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "申请加入" }));
    await waitFor(() => expect(mocked.apply).toHaveBeenCalledWith("xingyu-official", undefined));
    expect(await screen.findByText("申请已提交，等待审核")).toBeInTheDocument();
    expect(mocked.join).not.toHaveBeenCalled();
  });

  it("shows 已加入星系 when the signed-in user is already a member", async () => {
    authState.isAuthenticated = true;
    // Galaxy Identity Contract：joined 来自详情 payload，不再走 listMine 探测
    mocked.getBySlug.mockResolvedValue({ ...GALAXY, joined: true });
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");
    expect(await screen.findByText("已加入星系")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加入星系" })).not.toBeInTheDocument();
  });
});

describe("GalaxyDetailPage", () => {
  it("sorts pinned content first and links it to its real route", async () => {
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    const pinned = await screen.findByRole("link", { name: "置顶系列" });
    const plain = screen.getByRole("link", { name: "第一篇" });
    expect(pinned).toHaveAttribute("href", "/series/ser-1");
    expect(plain).toHaveAttribute("href", "/articles/art-1");
    expect(pinned.compareDocumentPosition(plain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a member preview with a role label and a profile link", async () => {
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByRole("link", { name: "探针" })).toHaveAttribute(
      "href",
      "/u/series_probe",
    );
    expect(screen.getByText(/创建者/)).toBeInTheDocument();
    // displayName is null for u-2, so the username is the label.
    expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute("href", "/u/alice");
  });

  it("renders the shared GalaxyVisual and caps the content preview at four rows", async () => {
    mocked.listContent.mockResolvedValue([
      ...CONTENT,
      { id: "c-4", objectType: "ARTICLE", objectId: "art-4", title: "第四篇", pinned: false },
      { id: "c-5", objectType: "ARTICLE", objectId: "art-5", title: "第五篇", pinned: false },
    ]);
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByTestId("galaxy-visual")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "第四篇" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第五篇" })).not.toBeInTheDocument();
  });

  it("keeps members visible when content fails", async () => {
    mocked.listContent.mockRejectedValue(new Error("content unavailable"));
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByRole("alert")).toHaveTextContent("最近内容暂时不可用");
    expect(screen.getByRole("link", { name: "探针" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "星语" })).toBeInTheDocument();
  });

  it("keeps content visible when members fail", async () => {
    mocked.listMembers.mockRejectedValue(new Error("members unavailable"));
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByRole("alert")).toHaveTextContent("成员暂时不可用");
    expect(screen.getByRole("link", { name: "置顶系列" })).toBeInTheDocument();
  });

  it("uses compact independent empty states", async () => {
    mocked.listMembers.mockResolvedValue([]);
    mocked.listContent.mockResolvedValue([]);
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");

    expect(await screen.findByText(/暂无内容，运营关联的内容/)).toBeInTheDocument();
    expect(screen.getByText("暂无公开成员")).toBeInTheDocument();
  });
});

describe("GalaxyMembersPage", () => {
  it("lists members with username labels and role text", async () => {
    renderPage(
      "/galaxies/xingyu-official/members",
      <GalaxyMembersPage />,
      "/galaxies/:slug/members",
    );

    expect(await screen.findByText("共 2 位公开成员")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /探针/ })).toHaveAttribute("href", "/u/series_probe");
    expect(screen.getByText("@series_probe")).toBeInTheDocument();
    // "成员" is ambiguous globally (nav tab + section heading + role badge), so
    // scope the role assertions to the list itself.
    const roster = screen.getByRole("list");
    expect(within(roster).getAllByText("成员")).toHaveLength(1);
    expect(within(roster).getByText("创建者")).toBeInTheDocument();
  });

  it("shows the empty state when the roster is empty", async () => {
    mocked.listMembers.mockResolvedValue([]);
    renderPage(
      "/galaxies/xingyu-official/members",
      <GalaxyMembersPage />,
      "/galaxies/:slug/members",
    );
    expect(await screen.findByText("暂无公开成员")).toBeInTheDocument();
  });

  it("does not blank the page when the roster request fails", async () => {
    mocked.listMembers.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "t",
        status: 404,
        detail: "d",
        code: "NOT_FOUND",
      }),
    );
    renderPage(
      "/galaxies/xingyu-official/members",
      <GalaxyMembersPage />,
      "/galaxies/:slug/members",
    );
    // The galaxy header still rendered, and the roster degrades to empty rather
    // than error — a failed side list must not take down the whole page.
    expect(await screen.findByRole("heading", { level: 1, name: "星语" })).toBeInTheDocument();
    expect(await screen.findByText("共 0 位公开成员")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });
});

describe("GalaxyContentPage", () => {
  it("renders every content type and maps each to its route", async () => {
    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );

    expect(await screen.findByRole("link", { name: "第一篇" })).toHaveAttribute(
      "href",
      "/articles/art-1",
    );
    expect(screen.getByRole("link", { name: "置顶系列" })).toHaveAttribute("href", "/series/ser-1");
    expect(screen.getByRole("link", { name: "一条动态" })).toHaveAttribute(
      "href",
      "/moments/mom-1",
    );
  });

  it("filters by object type", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );
    await screen.findByRole("link", { name: "第一篇" });
    const listBefore = screen.getByRole("link", { name: "第一篇" }).closest("ul");

    await userEvent.setup().click(screen.getByRole("button", { name: "系列" }));

    expect(screen.getByRole("link", { name: "置顶系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第一篇" })).not.toBeInTheDocument();

    /*
     * The filter replays the entrance: the <ul> carries a `key` over both
     * controls, so applying a filter unmounts the old list and the surviving rows
     * animate in again. A filter that swaps content with no motion reads as a
     * filter that did nothing (MyEventsPage). Node identity is the assertion that
     * locks it — the class alone would still pass without the key.
     */
    expect(screen.getByRole("link", { name: "置顶系列" }).closest("ul")).not.toBe(listBefore);

    // Inline, because `animate-rise-in` resets `animation-delay` (lib/stagger.ts).
    const row = screen.getByRole("link", { name: "置顶系列" }).closest("li");
    expect(row?.className).toContain("animate-rise-in");
    expect(row?.style.animationDelay).toBe("0ms");
  });

  it("narrows to pinned rows only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );
    await screen.findByRole("link", { name: "第一篇" });
    const listBefore = screen.getByRole("link", { name: "第一篇" }).closest("ul");

    await userEvent.setup().click(screen.getByRole("button", { name: "仅看置顶" }));

    expect(screen.getByRole("link", { name: "置顶系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第一篇" })).not.toBeInTheDocument();

    /*
     * 仅看置顶 replays too, because both controls drive ONE key: to the reader the
     * type chips and the pinned toggle are a single filter, so a key that tracked
     * only the chips would leave half the switches motionless.
     */
    expect(screen.getByRole("link", { name: "置顶系列" }).closest("ul")).not.toBe(listBefore);
  });

  it("shows the empty state when the galaxy has no content", async () => {
    mocked.listContent.mockResolvedValue([]);
    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );
    expect(await screen.findByText("暂无内容")).toBeInTheDocument();
  });
});

/*
 * 内容推荐（V054）。这些用例锁的是三件事，逐条对应业务契约：
 *   1. 入口只对成员出现（`joined` 是 viewer-scoped 三态，guest 为 null，不能当 false 之外的意思用）；
 *   2. 提交成功后状态来自服务端重读，而不是本地猜一个"已通过"；
 *   3. 后端拒绝时原样展示它给的原因，前端不自己编一套资格判断。
 */
describe("GalaxyContentPage contribution", () => {
  const MEMBER_GALAXY = { ...GALAXY, joined: true };

  it("hides the contribution entry from non-members", async () => {
    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );
    await screen.findByRole("link", { name: "第一篇" });
    expect(screen.queryByRole("button", { name: "推荐我的作品" })).not.toBeInTheDocument();
    expect(mocked.listMySubmissions).not.toHaveBeenCalled();
  });

  it("lets a member pick one of their works and submits it for review", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    authState.isAuthenticated = true;
    mocked.getBySlug.mockResolvedValue(MEMBER_GALAXY);
    mockedArticles.listMine.mockResolvedValue([
      { id: "art-1", status: "PUBLISHED", title: "已发布的作品", categoryId: null, updatedAt: "2026-10-01T00:00:00Z" },
      { id: "art-2", status: "DRAFT", title: "还在写", categoryId: null, updatedAt: "2026-10-02T00:00:00Z" },
    ]);
    mocked.submitContent.mockResolvedValue({
      id: "sub-1",
      galaxyId: "g-1",
      galaxySlug: "xingyu-official",
      galaxyName: "星语",
      objectType: "ARTICLE",
      objectId: "art-1",
      title: "已发布的作品",
      summary: null,
      submitterId: "u-9",
      submitterName: "me",
      note: "很合适",
      status: "PENDING",
      rejectReason: null,
      createdAt: "2026-10-22T00:00:00Z",
      resolvedAt: null,
    });
    mocked.listMySubmissions.mockResolvedValue([]);

    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "推荐我的作品" }));

    // 草稿没有发布版本，后端必拒 —— 这里根本不该出现在候选里。
    expect(await screen.findByRole("option", { name: "已发布的作品" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "还在写" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("选择作品"), "art-1");
    await user.type(screen.getByLabelText("推荐语（可选）"), "很合适");
    await user.click(screen.getByRole("button", { name: "提交推荐" }));

    await waitFor(() =>
      expect(mocked.submitContent).toHaveBeenCalledWith("xingyu-official", {
        objectType: "ARTICLE",
        objectId: "art-1",
        note: "很合适",
      }),
    );
    expect(await screen.findByText("已提交，等待星系管理员审核。")).toBeInTheDocument();
    // 提交后重新读一次服务端状态，而不是本地把记录塞进列表。
    await waitFor(() => expect(mocked.listMySubmissions).toHaveBeenCalledTimes(2));
  });

  it("shows the server's rejection reason instead of inventing its own", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    authState.isAuthenticated = true;
    mocked.getBySlug.mockResolvedValue(MEMBER_GALAXY);
    mockedArticles.listMine.mockResolvedValue([
      { id: "art-1", status: "PUBLISHED", title: "已发布的作品", categoryId: null, updatedAt: "2026-10-01T00:00:00Z" },
    ]);
    mocked.submitContent.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "conflict",
        status: 409,
        detail: "该作品已在该星系中",
        code: "CONFLICT",
      }),
    );

    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "推荐我的作品" }));
    await user.selectOptions(await screen.findByLabelText("选择作品"), "art-1");
    await user.click(screen.getByRole("button", { name: "提交推荐" }));

    expect(await screen.findByText("该作品已在该星系中")).toBeInTheDocument();
  });

  it("renders each submission status and degrades a delisted work honestly", async () => {
    authState.isAuthenticated = true;
    mocked.getBySlug.mockResolvedValue(MEMBER_GALAXY);
    mocked.listMySubmissions.mockResolvedValue([
      {
        id: "sub-1",
        galaxyId: "g-1",
        galaxySlug: "xingyu-official",
        galaxyName: "星语",
        objectType: "ARTICLE",
        objectId: "art-1",
        title: "已上架的作品",
        summary: null,
        submitterId: "u-9",
        submitterName: "me",
        note: null,
        status: "APPROVED",
        rejectReason: null,
        createdAt: "2026-10-20T00:00:00Z",
        resolvedAt: "2026-10-21T00:00:00Z",
      },
      {
        id: "sub-2",
        galaxyId: "g-1",
        galaxySlug: "xingyu-official",
        galaxyName: "星语",
        objectType: "ARTICLE",
        objectId: "art-3",
        // 活文档已消失（下架/删除）——不能沿用旧标题。
        title: null,
        summary: null,
        submitterId: "u-9",
        submitterName: "me",
        note: null,
        status: "REJECTED",
        rejectReason: "与星系主题不符",
        createdAt: "2026-10-19T00:00:00Z",
        resolvedAt: "2026-10-20T00:00:00Z",
      },
    ]);

    renderPage(
      "/galaxies/xingyu-official/content",
      <GalaxyContentPage />,
      "/galaxies/:slug/content",
    );

    expect(await screen.findByText("已上架的作品")).toBeInTheDocument();
    expect(screen.getByText("已上架")).toBeInTheDocument();
    expect(screen.getByText("内容不可用")).toBeInTheDocument();
    expect(screen.getByText("未通过")).toBeInTheDocument();
    expect(screen.getByText("与星系主题不符")).toBeInTheDocument();
  });
});
