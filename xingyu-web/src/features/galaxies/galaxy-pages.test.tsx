import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
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
  },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => authState,
}));

const mocked = vi.mocked(galaxiesApi);

const GALAXY = { id: "g-1", slug: "xingyu-official", name: "星语", official: true, memberCount: 12 };

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
      new ApiError({ type: "about:blank", title: "资源不存在", status: 404, detail: "资源不存在", code: "NOT_FOUND" }),
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
    renderPage("/galaxies/xingyu-official/members", <GalaxyMembersPage />, "/galaxies/:slug/members");
    const tab = await screen.findByRole("link", { name: "成员" });
    expect(tab).toHaveAttribute("aria-current", "page");
  });

  it("sends guests to login instead of showing a join button", async () => {
    renderPage("/galaxies/xingyu-official", <GalaxyDetailPage />, "/galaxies/:slug");
    const link = await screen.findByRole("link", { name: "登录后加入星系" });
    expect(link).toHaveAttribute("href", "/login?returnTo=%2Fgalaxies%2Fxingyu-official");
    expect(screen.queryByRole("button", { name: "加入星系" })).not.toBeInTheDocument();
  });

  it("shows 已加入星系 when the signed-in user is already a member", async () => {
    authState.isAuthenticated = true;
    mocked.listMine.mockResolvedValue([GALAXY]);
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

    expect(await screen.findByRole("link", { name: "探针" })).toHaveAttribute("href", "/u/series_probe");
    expect(screen.getByText(/创建者/)).toBeInTheDocument();
    // displayName is null for u-2, so the username is the label.
    expect(screen.getByRole("link", { name: "alice" })).toHaveAttribute("href", "/u/alice");
  });
});

describe("GalaxyMembersPage", () => {
  it("lists members with username labels and role text", async () => {
    renderPage("/galaxies/xingyu-official/members", <GalaxyMembersPage />, "/galaxies/:slug/members");

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
    renderPage("/galaxies/xingyu-official/members", <GalaxyMembersPage />, "/galaxies/:slug/members");
    expect(await screen.findByText("暂无公开成员")).toBeInTheDocument();
  });

  it("does not blank the page when the roster request fails", async () => {
    mocked.listMembers.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "t", status: 404, detail: "d", code: "NOT_FOUND" }),
    );
    renderPage("/galaxies/xingyu-official/members", <GalaxyMembersPage />, "/galaxies/:slug/members");
    // The galaxy header still rendered, and the roster degrades to empty rather
    // than error — a failed side list must not take down the whole page.
    expect(await screen.findByRole("heading", { level: 1, name: "星语" })).toBeInTheDocument();
    expect(await screen.findByText("共 0 位公开成员")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-error")).not.toBeInTheDocument();
  });
});

describe("GalaxyContentPage", () => {
  it("renders every content type and maps each to its route", async () => {
    renderPage("/galaxies/xingyu-official/content", <GalaxyContentPage />, "/galaxies/:slug/content");

    expect(await screen.findByRole("link", { name: "第一篇" })).toHaveAttribute("href", "/articles/art-1");
    expect(screen.getByRole("link", { name: "置顶系列" })).toHaveAttribute("href", "/series/ser-1");
    expect(screen.getByRole("link", { name: "一条动态" })).toHaveAttribute("href", "/moments/mom-1");
  });

  it("filters by object type", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage("/galaxies/xingyu-official/content", <GalaxyContentPage />, "/galaxies/:slug/content");
    await screen.findByRole("link", { name: "第一篇" });

    await userEvent.setup().click(screen.getByRole("button", { name: "系列" }));

    expect(screen.getByRole("link", { name: "置顶系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第一篇" })).not.toBeInTheDocument();
  });

  it("narrows to pinned rows only", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderPage("/galaxies/xingyu-official/content", <GalaxyContentPage />, "/galaxies/:slug/content");
    await screen.findByRole("link", { name: "第一篇" });

    await userEvent.setup().click(screen.getByRole("button", { name: "仅看置顶" }));

    expect(screen.getByRole("link", { name: "置顶系列" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第一篇" })).not.toBeInTheDocument();
  });

  it("shows the empty state when the galaxy has no content", async () => {
    mocked.listContent.mockResolvedValue([]);
    renderPage("/galaxies/xingyu-official/content", <GalaxyContentPage />, "/galaxies/:slug/content");
    expect(await screen.findByText("暂无内容")).toBeInTheDocument();
  });
});

