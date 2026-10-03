import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import { GalaxyListPage } from "./pages/GalaxyListPage";

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

const GALAXIES = [
  { id: "g-1", slug: "xingyu-official", name: "星语", official: true, memberCount: 12 },
  { id: "g-2", slug: "dev-log", name: "开发日志", official: false, memberCount: 3 },
];

function renderList() {
  return render(
    <MemoryRouter initialEntries={["/galaxies"]}>
      <GalaxyListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  mocked.list.mockResolvedValue(GALAXIES);
  mocked.listMine.mockResolvedValue([]);
});

describe("GalaxyListPage", () => {
  it("does not request or show my galaxies for a guest", async () => {
    renderList();

    expect(await screen.findByRole("heading", { name: "官方星系" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的星系" })).not.toBeInTheDocument();
    expect(mocked.listMine).not.toHaveBeenCalled();
  });

  it("shows joined galaxies for an authenticated user", async () => {
    authState.isAuthenticated = true;
    mocked.listMine.mockResolvedValue([GALAXIES[1]]);
    renderList();

    const section = (await screen.findByRole("heading", { name: "我的星系" })).closest("section");
    expect(section).not.toBeNull();
    expect(within(section!).getByRole("link", { name: /开发日志/ })).toHaveAttribute(
      "href",
      "/galaxies/dev-log",
    );
    expect(within(section!).getByRole("link", { name: "查看全部 →" })).toHaveAttribute(
      "href",
      "/me/galaxies",
    );
  });

  it("uses a light inline state when my galaxies is empty", async () => {
    authState.isAuthenticated = true;
    renderList();

    expect(await screen.findByText(/你还没有加入星系/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "还没有加入任何星系" })).not.toBeInTheDocument();
  });

  it("keeps public galaxies visible when my galaxies fails", async () => {
    authState.isAuthenticated = true;
    mocked.listMine.mockRejectedValue(new Error("mine unavailable"));
    renderList();

    expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法读取你加入的星系");
    expect(screen.getByRole("heading", { name: "官方星系" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "探索星系" })).toBeInTheDocument();
  });

  it("separates official galaxies from explorable community galaxies", async () => {
    renderList();

    const official = (await screen.findByRole("heading", { name: "官方星系" })).closest("section");
    const explore = screen.getByRole("heading", { name: "探索星系" }).closest("section");
    expect(official).not.toBeNull();
    expect(explore).not.toBeNull();
    expect(within(official!).getByRole("link", { name: /星语/ })).toBeInTheDocument();
    expect(within(official!).queryByRole("link", { name: /开发日志/ })).not.toBeInTheDocument();
    expect(within(explore!).getByRole("link", { name: /开发日志/ })).toBeInTheDocument();
    expect(within(explore!).queryByRole("link", { name: /星语/ })).not.toBeInTheDocument();
  });

  it("links every galaxy by slug, not id", async () => {
    renderList();

    expect(await screen.findByRole("link", { name: /星语/ })).toHaveAttribute(
      "href",
      "/galaxies/xingyu-official",
    );
    expect(screen.getByRole("link", { name: /开发日志/ })).toHaveAttribute(
      "href",
      "/galaxies/dev-log",
    );
  });

  it("hides the explore section when no community galaxy exists", async () => {
    mocked.list.mockResolvedValue([GALAXIES[0]]);
    renderList();

    expect(await screen.findByRole("heading", { name: "官方星系" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "探索星系" })).not.toBeInTheDocument();
  });

  it("filters client-side by name without another public request", async () => {
    renderList();
    const input = await screen.findByLabelText("搜索星系");
    await userEvent.setup().type(input, "开发");

    expect(screen.queryByRole("link", { name: /星语/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开发日志/ })).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledTimes(1);
  });

  it("filters by slug and switches to a unified search mode", async () => {
    authState.isAuthenticated = true;
    mocked.listMine.mockResolvedValue([GALAXIES[1]]);
    renderList();
    const input = await screen.findByLabelText("搜索星系");
    await userEvent.setup().type(input, "xingyu-official");

    expect(screen.getByRole("heading", { name: "搜索结果" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /星语/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "我的星系" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "官方星系" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "探索星系" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "如何开始？" })).not.toBeInTheDocument();
  });

  it("restores the home sections after clearing search", async () => {
    renderList();
    const input = await screen.findByLabelText("搜索星系");
    const user = userEvent.setup();
    await user.type(input, "开发");
    await user.clear(input);

    expect(screen.getByRole("heading", { name: "官方星系" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "探索星系" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "如何开始？" })).toBeInTheDocument();
  });

  it("shows a compact no-match state", async () => {
    renderList();
    const input = await screen.findByLabelText("搜索星系");
    await userEvent.setup().type(input, "zzz");

    expect(screen.getByText("没有匹配的星系")).toBeInTheDocument();
  });

  it("always explains the galaxy product on the non-search home", async () => {
    renderList();

    expect(await screen.findByRole("heading", { name: "如何开始？" })).toBeInTheDocument();
    expect(screen.getByText("找到星系")).toBeInTheDocument();
    expect(screen.getByText("加入星系")).toBeInTheDocument();
    expect(screen.getByText("参与其中")).toBeInTheDocument();
    expect(screen.getByText(/话题连接讨论方向/)).toBeInTheDocument();
  });

  it("shows the empty state while retaining product education when no public galaxy exists", async () => {
    mocked.list.mockResolvedValue([]);
    renderList();

    expect(await screen.findByText(/还没有星系/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "如何开始？" })).toBeInTheDocument();
  });

  it("shows the public error state when the request fails", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "t", status: 500, detail: "d", code: "UNKNOWN" }),
    );
    renderList();

    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("does not expose invented galaxy metadata or join actions", async () => {
    renderList();

    expect(await screen.findByRole("heading", { name: "官方星系" })).toBeInTheDocument();
    expect(screen.queryByText(/活跃成员|今日新增|推荐理由|内容数/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /加入/ })).not.toBeInTheDocument();
  });
});
