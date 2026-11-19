import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ArticleOutlineItem } from "@/lib/article-markdown";
import { ReaderOutlineButton } from "./ReaderOutlineButton";

const items: ArticleOutlineItem[] = [
  { id: "h2-a", text: "阅读布局", level: 2 },
  { id: "h3-a", text: "标题层级", level: 3 },
  { id: "h2-b", text: "滚动目录", level: 2 },
];

describe("ReaderOutlineButton", () => {
  it("renders nothing when the outline is empty", () => {
    const { container } = render(<ReaderOutlineButton items={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "目录" })).not.toBeInTheDocument();
  });

  it("opens a left sheet with nested heading links and closes after a jump", async () => {
    const user = userEvent.setup();
    render(
      <div>
        {items.map((item) => (
          <h2 key={item.id} id={item.id}>
            {item.text}
          </h2>
        ))}
        <ReaderOutlineButton items={items} label="文章目录" />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "目录" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "目录" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const nav = within(dialog).getByRole("navigation", { name: "文章目录" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#h2-a",
      "#h3-a",
      "#h2-b",
    ]);
    expect(within(nav).getByRole("link", { name: "标题层级" }).parentElement).toHaveStyle({
      paddingLeft: "12px",
    });
    expect(nav.closest("article")).toBeNull();

    await user.click(within(nav).getByRole("link", { name: "滚动目录" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes from the sheet close control", async () => {
    const user = userEvent.setup();
    render(<ReaderOutlineButton items={items} />);

    await user.click(screen.getByRole("button", { name: "目录" }));
    expect(screen.getByRole("dialog", { name: "目录" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
