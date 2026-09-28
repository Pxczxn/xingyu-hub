import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { socialApi } from "@/api/social/social.api";
import { usersApi } from "@/api/users/users.api";
import { ApiError } from "@/api/client";
import { MyFollowingPage, MyFollowersPage } from "./pages/FollowListPage";
import { formatFollowedAt, followUserLabel } from "./FollowUserRow";

vi.mock("@/api/social/social.api", () => ({
  socialApi: {
    listMyFollowing: vi.fn(),
    listMyFollowers: vi.fn(),
    listUserFollowing: vi.fn(),
    listUserFollowers: vi.fn(),
  },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: { followUser: vi.fn(), unfollowUser: vi.fn() },
}));

const mockedSocial = vi.mocked(socialApi);
const mockedUsers = vi.mocked(usersApi);

const ALICE = { userId: "u1", username: "alice", displayName: "爱丽丝", followedAt: "2026-09-20T10:00:00Z" };
const BOB = { userId: "u2", username: "bob", displayName: null, followedAt: null };

function renderFollowing() {
  return render(
    <MemoryRouter initialEntries={["/me/following"]}>
      <MyFollowingPage />
    </MemoryRouter>,
  );
}

function renderFollowers() {
  return render(
    <MemoryRouter initialEntries={["/me/followers"]}>
      <MyFollowersPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("followUserLabel / formatFollowedAt", () => {
  it("prefers the display name and falls back to the username", () => {
    expect(followUserLabel(ALICE)).toBe("爱丽丝");
    expect(followUserLabel(BOB)).toBe("bob");
  });

  it("treats a whitespace display name as missing", () => {
    expect(followUserLabel({ ...ALICE, displayName: "   " })).toBe("alice");
  });

  it("formats a real timestamp", () => {
    expect(formatFollowedAt("2026-09-20T10:00:00Z")).toMatch(/2026/);
  });

  it("returns null (not 'Invalid Date') for a missing or bad timestamp", () => {
    expect(formatFollowedAt(null)).toBeNull();
    expect(formatFollowedAt(undefined)).toBeNull();
    expect(formatFollowedAt("not-a-date")).toBeNull();
  });
});

describe("MyFollowingPage", () => {
  it("lists who you follow, linking each to their profile", async () => {
    mockedSocial.listMyFollowing.mockResolvedValue([ALICE, BOB]);
    renderFollowing();

    expect(await screen.findByRole("link", { name: "爱丽丝" })).toHaveAttribute("href", "/u/alice");
    expect(screen.getByRole("link", { name: "bob" })).toHaveAttribute("href", "/u/bob");
    expect(screen.getByText("共 2 位")).toBeInTheDocument();
  });

  it("shows the 关注 tab as current", async () => {
    mockedSocial.listMyFollowing.mockResolvedValue([ALICE]);
    renderFollowing();
    const nav = await screen.findByRole("navigation", { name: "关注导航" });
    expect(within(nav).getByRole("link", { name: "关注" })).toHaveAttribute("aria-current", "page");
  });

  it("does not offer an unfollow button on the following list", async () => {
    mockedSocial.listMyFollowing.mockResolvedValue([ALICE]);
    renderFollowing();
    await screen.findByRole("link", { name: "爱丽丝" });
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
  });

  it("shows the empty state with guidance", async () => {
    mockedSocial.listMyFollowing.mockResolvedValue([]);
    renderFollowing();
    expect(await screen.findByText("还没有关注任何人")).toBeInTheDocument();
  });

  it("explains an expired session on 401 rather than showing an empty list", async () => {
    mockedSocial.listMyFollowing.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "请先登录", status: 401, detail: "请先登录", code: "AUTH_REQUIRED" }),
    );
    renderFollowing();
    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("shows a generic error for a non-auth failure", async () => {
    mockedSocial.listMyFollowing.mockRejectedValue(new Error("boom"));
    renderFollowing();
    expect(await screen.findByText("无法读取这份列表，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });

  it("omits the 关注于 timestamp when the backend sends no followedAt", async () => {
    mockedSocial.listMyFollowing.mockResolvedValue([BOB]);
    renderFollowing();
    await screen.findByRole("link", { name: "bob" });
    expect(screen.queryByText(/关注于/)).not.toBeInTheDocument();
  });
});

describe("MyFollowersPage", () => {
  it("offers 关注 back for a follower you do not follow yet", async () => {
    // BOB has followedAt: null -> means "you do not follow them back".
    mockedSocial.listMyFollowers.mockResolvedValue([BOB]);
    renderFollowers();

    const list = await screen.findByRole("list");
    expect(within(list).getByRole("button", { name: "关注" })).toBeInTheDocument();
  });

  it("hides 关注 when you already follow them back", async () => {
    // ALICE carries a followedAt -> already followed back.
    mockedSocial.listMyFollowers.mockResolvedValue([ALICE]);
    renderFollowers();

    await screen.findByRole("link", { name: "爱丽丝" });
    expect(screen.queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
  });

  it("follows back through the real endpoint and hides the button on success", async () => {
    mockedSocial.listMyFollowers.mockResolvedValue([BOB]);
    mockedUsers.followUser.mockResolvedValue(undefined);
    renderFollowers();

    const list = await screen.findByRole("list");
    await userEvent.setup().click(within(list).getByRole("button", { name: "关注" }));

    expect(mockedUsers.followUser).toHaveBeenCalledWith("bob");
    // After success the row gains a followedAt, so the button disappears.
    expect(within(list).queryByRole("button", { name: "关注" })).not.toBeInTheDocument();
  });

  it("surfaces a follow failure and keeps the button available", async () => {
    mockedSocial.listMyFollowers.mockResolvedValue([BOB]);
    mockedUsers.followUser.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "t", status: 500, detail: "关注失败", code: "UNKNOWN" }),
    );
    renderFollowers();

    const list = await screen.findByRole("list");
    await userEvent.setup().click(within(list).getByRole("button", { name: "关注" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("关注失败");
    expect(within(list).getByRole("button", { name: "关注" })).toBeInTheDocument();
  });

  it("shows the follower empty state", async () => {
    mockedSocial.listMyFollowers.mockResolvedValue([]);
    renderFollowers();
    expect(await screen.findByText("还没有粉丝")).toBeInTheDocument();
  });
});
