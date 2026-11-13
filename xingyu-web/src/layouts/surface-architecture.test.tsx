import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { HomeFeedTabs, type HomeFeedTab } from "@/features/home/components/HomeFeedTabs";
import { DiscoverTabs } from "@/features/discover/components/DiscoverTabs";
import { GalaxyTabs, type GalaxyTab } from "@/features/galaxies/components/GalaxyTabs";
import { GalaxyTile } from "@/features/galaxies/components/GalaxyTile";
import { TopicCard } from "@/features/topics/components/TopicCard";
import { ContentCard } from "@/components/shared/ContentCard";
import { underlineTabClassName } from "@/components/ui/underline-tabs";
import { resetChatSocketDouble } from "@/features/chat/chat-socket.test-double";

vi.mock("@/features/chat/chat-socket.context", async () => {
  const actual = await vi.importActual<typeof import("@/features/chat/chat-socket.context")>(
    "@/features/chat/chat-socket.context",
  );
  const double = await import("@/features/chat/chat-socket.test-double");
  return { ...actual, useChatSocket: double.chatSocketValue };
});

vi.mock("@/api/notifications/notifications.api", () => ({
  notificationsApi: { getUnreadCount: vi.fn(async () => 0) },
}));

vi.mock("@/api/users/users.api", () => ({
  usersApi: { getMyProfile: vi.fn() },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn() }),
}));

function FeedTabs() {
  const [value, setValue] = useState<HomeFeedTab>("recommend");
  return <HomeFeedTabs value={value} onChange={setValue} />;
}

function Galaxy() {
  const [value, setValue] = useState<GalaxyTab>("explore");
  return <GalaxyTabs value={value} onChange={setValue} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
});

describe("Phase 2.1 surface", () => {
  it("sizes the header, search and create control from the shared scale", async () => {
    const user = userEvent.setup();
    const tokens = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
    expect(tokens).toContain("--shell-header-height: 4rem");

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole("banner").className).toContain("h-[var(--shell-header-height)]");
    const nav = screen.getByRole("navigation", { name: "主导航" });
    expect(nav.className).toContain("gap-1");
    expect(nav.className).toContain("lg:flex");

    const search = screen.getByRole("searchbox", { name: "搜索" });
    expect(search.className).toContain("h-10");
    expect(search.closest("form")?.className).toContain("md:block");
    expect(search.closest("form")?.className).toContain("w-[clamp(200px,30vw,400px)]");

    const create = screen.getByRole("link", { name: "创作" });
    expect(create.className).toContain("h-10");
    expect(create.className).toContain("sm:inline-flex");

    const menu = screen.getByRole("button", { name: "打开导航菜单" });
    expect(menu.className).toContain("h-11");
    expect(menu.className).toContain("lg:hidden");

    await user.click(menu);

    const sheetSearch = screen.getAllByRole("searchbox", { name: "搜索" }).find((node) =>
      node.className.includes("h-11"),
    );
    expect(sheetSearch).toBeTruthy();

    const home = screen.getAllByRole("link", { name: "首页" }).find((node) =>
      node.className.includes("h-11"),
    );
    expect(home?.className).toContain("h-11");
    expect(home?.closest("nav")?.className).toContain("space-y-2");

    const sheetCreate = screen.getAllByRole("link", { name: "创作" }).find((node) =>
      node.className.includes("w-full"),
    );
    expect(sheetCreate?.className).toContain("h-11");
  });

  it("keeps home and galaxy on underline tabs, and discover categories on pills", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/discover"]}>
        <FeedTabs />
        <DiscoverTabs />
        <Galaxy />
      </MemoryRouter>,
    );

    const home = screen.getByRole("tab", { name: "推荐" });
    const galaxy = screen.getByRole("tab", { name: "探索星系" });
    for (const tab of [home, galaxy]) {
      expect(tab.className).toContain("border-b-2");
      expect(tab.className).toContain("px-4");
      expect(tab.className).toContain("py-2.5");
      expect(tab.className).toContain("font-semibold");
      expect(tab.className).toContain("border-primary");
    }
    expect(underlineTabClassName(true)).toContain("border-primary");

    const discover = screen.getByRole("link", { name: "推荐" });
    expect(discover.className).toContain("bg-blue-50");
    expect(discover.className).toContain("text-blue-600");
    expect(discover.className).not.toContain("border-b-2");
    expect(screen.getByRole("link", { name: "文章" }).className).not.toContain("bg-blue-50");

    for (const path of ["/series", "/topics", "/creators"]) {
      rerender(
        <MemoryRouter initialEntries={[path]}>
          <DiscoverTabs />
        </MemoryRouter>,
      );
      const current = screen.getByRole("link", { current: "page" });
      expect(current.className).toContain("bg-blue-50");
      expect(current.className).toContain("text-blue-600");
      expect(current.className).not.toContain("border-b-2");
    }
  });

  it("uses the shared card radius on topic, galaxy and content cards", () => {
    render(
      <MemoryRouter>
        <ul>
          <TopicCard topic={{ id: "t1", slug: "design", name: "设计" }} />
        </ul>
        <GalaxyTile
          galaxy={{
            id: "g1",
            slug: "xingyu",
            name: "星语",
            official: true,
            memberCount: 3,
            joinMode: "OPEN",
          }}
        />
        <ContentCard item={{ id: "c1", objectType: "ARTICLE", title: "一篇文章" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("article").className).toContain("rounded-card");
    expect(screen.getByRole("article").className).toContain("hover:shadow-md");
    expect(screen.getByRole("link", { name: /星语/ }).className).toContain("rounded-card");
    expect(screen.getByText("一篇文章").closest(".rounded-card")?.className).toContain(
      "hover:shadow-md",
    );
  });
});
