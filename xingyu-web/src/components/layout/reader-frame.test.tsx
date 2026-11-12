import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReaderFrame, ReaderProgress } from "./ReaderFrame";

/*
 * ReaderFrame — the ONE reading layout shared by every content-reading page.
 *
 * jsdom has no layout engine, so these tests pin the part that is expressible:
 * the three `data-reader-track` hooks and which one owns the title/body. The
 * pixel measurements (1910 → `235 | 297 | 64 | 718 | 64 | 297 | 235`) are
 * verified in a real browser, not here.
 */

describe("ReaderFrame", () => {
  it("keeps the title and body in the main track", () => {
    const { container } = render(
      <ReaderFrame>
        <h1>标题</h1>
        <p>正文</p>
      </ReaderFrame>,
    );

    const main = container.querySelector('[data-reader-track="main"]');
    expect(main).not.toBeNull();
    expect(main?.querySelector("h1")?.textContent).toBe("标题");
    expect(main?.querySelector("p")?.textContent).toBe("正文");
  });

  it("renders the main track alone when neither rail is provided", () => {
    const { container } = render(<ReaderFrame>正文</ReaderFrame>);

    expect(container.querySelectorAll("[data-reader-track]")).toHaveLength(1);
    expect(container.querySelector('[data-reader-track="left"]')).toBeNull();
    expect(container.querySelector('[data-reader-track="right"]')).toBeNull();
  });

  it("renders all three tracks when both rails have content", () => {
    const { container } = render(
      <ReaderFrame
        asideLeft={<p>作者信息</p>}
        asideRight={
          <div>
            <p>工具与目录</p>
            <ReaderProgress />
          </div>
        }
      >
        <h1>标题</h1>
      </ReaderFrame>,
    );

    expect(container.querySelectorAll("[data-reader-track]")).toHaveLength(3);
    expect(container.querySelector('[data-reader-track="left"]')?.textContent).toContain(
      "作者信息",
    );
    expect(container.querySelector('[data-reader-track="right"]')?.textContent).toContain(
      "工具与目录",
    );
    /* The progress block lives in the right track; its name is distinct from
       the fixed 2px line so neither is ambiguous. */
    expect(screen.getByRole("progressbar", { name: "阅读进度" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "阅读进度条" })).toBeInTheDocument();
  });

  it("falls back to the single column when only one rail is passed", () => {
    const { container } = render(<ReaderFrame asideRight={<p>只有右栏</p>}>正文</ReaderFrame>);

    expect(container.querySelectorAll("[data-reader-track]")).toHaveLength(1);
    /* The lone rail is not lost: it renders after the text instead of creating
       a one-sided (off-axis) grid track. */
    expect(screen.getByText("只有右栏")).toBeInTheDocument();
  });
});
