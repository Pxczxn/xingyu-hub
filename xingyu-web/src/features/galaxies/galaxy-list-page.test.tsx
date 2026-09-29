import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import { ApiError } from "@/api/client";
import { GalaxyListPage } from "./pages/GalaxyListPage";

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
});

describe("GalaxyListPage", () => {
  it("links each galaxy by slug, not by id", async () => {
    mocked.list.mockResolvedValue(GALAXIES);
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

  it("labels official and community galaxies", async () => {
    mocked.list.mockResolvedValue(GALAXIES);
    renderList();

    expect(await screen.findByText("官方星系")).toBeInTheDocument();
    expect(screen.getByText("社区星系")).toBeInTheDocument();
  });

  it("shows the empty state when no galaxy exists", async () => {
    mocked.list.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText("还没有星系")).toBeInTheDocument();
  });

  it("shows the error state when the request fails", async () => {
    mocked.list.mockRejectedValue(new Error("boom"));
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });

  it("filters client-side by name without another request", async () => {
    mocked.list.mockResolvedValue(GALAXIES);
    renderList();

    const input = await screen.findByLabelText("搜索星系");
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.setup().type(input, "开发");

    expect(screen.queryByRole("link", { name: /星语/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开发日志/ })).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledTimes(1);
  });

  it("shows a no-match state when the filter matches nothing", async () => {
    mocked.list.mockResolvedValue(GALAXIES);
    renderList();

    const input = await screen.findByLabelText("搜索星系");
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.setup().type(input, "zzz");

    expect(screen.getByText("没有匹配的星系")).toBeInTheDocument();
  });

  it("does not surface a raw 404 as a crash", async () => {
    mocked.list.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "t", status: 500, detail: "d", code: "UNKNOWN" }),
    );
    renderList();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});
