import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleMarkdownBody } from "@/lib/article-markdown";

describe("article image zoom", () => {
  it("opens the same picture in a dialog", async () => {
    const user = userEvent.setup();
    render(<ArticleMarkdownBody body={"![示意图](https://example.com/a.png)"} />);

    await user.click(screen.getByRole("button", { name: "放大查看：示意图" }));

    const dialog = await screen.findByRole("dialog");
    const enlarged = dialog.querySelector("img");
    expect(enlarged).toHaveAttribute("src", "https://example.com/a.png");
    expect(enlarged).toHaveAttribute("alt", "示意图");
  });
});
