import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserMenu } from "./UserMenu";

/*
 * The header's user menu.
 *
 * The shell used to render these destinations INLINE in the header, so they were always in
 * the DOM. The first test below is the one that matters most: it pins the thing that changed
 * — they are now behind a disclosure, which is what the prototype's 用户菜单 asks for.
 */

/**
 * Every route the menu is the sole entry point for.
 *
 * 2026-10-06: 「收藏的私信」 no longer belongs here. The `/messages/saved` ROUTE still
 * exists, but the menu is the only entry to it — and nothing in the message UI can
 * create a saved message, so the page could only ever be empty. The entry is hidden
 * (not the feature) until a real save affordance ships.
 */
const SHORTCUTS = [
  "我的内容",
  "收藏夹",
  "书架",
  "我的动态",
  "我的群聊",
  "我的星系",
  "关注",
  "我的喜欢",
  "我的评论",
  "关系请求",
  "徽章",
  "我的成长",
  /*
   * 治理 (2026-10-07): the minimal, honest way into the governance loop. Not a
   * "治理中心" landing — just the two things a user actually has: what they
   * reported, and the outcome of any appeal.
   */
  "我的举报",
  "我的申诉",
];

function renderMenu(onLogout = vi.fn()) {
  render(
    <MemoryRouter>
      <UserMenu username="alice" onLogout={onLogout} />
    </MemoryRouter>,
  );
  return onLogout;
}

function trigger() {
  return screen.getByRole("button", { name: /alice/ });
}

describe("UserMenu", () => {
  it("keeps the shortcuts out of the DOM until it is opened", () => {
    renderMenu();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "收藏夹" })).not.toBeInTheDocument();
  });

  it("opens to reveal every shortcut, including the way to your own profile", () => {
    renderMenu();

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    // The trigger is a button, not a link, so this is the only route to your profile.
    expect(screen.getByRole("link", { name: /查看主页/ })).toHaveAttribute("href", "/me");
    for (const label of SHORTCUTS) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("closes on Escape and puts focus back on the trigger", () => {
    renderMenu();

    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("link", { name: "收藏夹" })).not.toBeInTheDocument();
    // Without this the next Tab would restart from the top of the page.
    expect(trigger()).toHaveFocus();
  });

  it("closes when the pointer goes down outside it", () => {
    renderMenu();

    fireEvent.click(trigger());
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("link", { name: "收藏夹" })).not.toBeInTheDocument();
  });

  it("closes after following a link, so it does not linger on the next page", () => {
    renderMenu();

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("link", { name: "徽章" }));

    expect(screen.queryByRole("link", { name: "收藏夹" })).not.toBeInTheDocument();
  });

  it("logs out from the menu", () => {
    const onLogout = renderMenu();

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("routes the governance entries to the real report and appeal pages", () => {
    renderMenu();
    fireEvent.click(trigger());

    expect(screen.getByRole("link", { name: "我的举报" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "我的申诉" })).toHaveAttribute("href", "/appeals");
    // No fabricated governance landing page.
    expect(screen.queryByRole("link", { name: /治理中心/ })).not.toBeInTheDocument();
  });

  it("gives 我的活动 a stable entry point to the existing page", () => {
    // /me/events used to be reachable only from the event detail sidebar.
    renderMenu();
    fireEvent.click(trigger());

    expect(screen.getByRole("link", { name: "我的活动" })).toHaveAttribute("href", "/me/events");
  });
});

/*
 * Accessible name at every width (2026-10-03).
 *
 * These two exist because of a specific near-miss. The username label is now
 * hidden below `sm` so the header stops overflowing a 320px viewport. But the
 * trigger had no `aria-label` — the label text WAS its accessible name. Hiding it
 * alone would have left the button unnamed on every phone, and this button is the
 * only way into /me/*.
 *
 * Note why the tests above cannot catch that: happy-dom does not load Tailwind, so
 * `hidden` never becomes `display:none` and the label text still counts toward the
 * name. `getByRole("button", { name: /alice/ })` therefore passes either way. The
 * assertions below look at the attribute itself, which is what actually survives
 * in a browser.
 */
describe("UserMenu — accessible name does not depend on the visible label", () => {
  it("states the name explicitly on the trigger", () => {
    renderMenu();
    // Not derived from the label text: this is what a screen reader reads on a
    // phone, where the label is display:none.
    expect(trigger()).toHaveAttribute("aria-label", "alice，打开账户菜单");
  });

  it("hides the label at the base breakpoint and restores it from `sm`", () => {
    renderMenu();
    const label = screen.getByText("alice");
    expect(label.className).toContain("hidden");
    expect(label.className).toContain("sm:inline");
  });
});
