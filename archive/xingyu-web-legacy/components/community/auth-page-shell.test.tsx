import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthPageShell } from "./auth-page-shell";

describe("AuthPageShell", () => {
  it("提供可返回首页的品牌入口与表单区域", () => {
    render(
      <AuthPageShell eyebrow="欢迎回来" title="登录星语社区" description="继续你的阅读与创作。">
        <form aria-label="登录表单">
          <button type="submit">登录</button>
        </form>
      </AuthPageShell>
    );

    expect(screen.getByRole("link", { name: "返回星语社区" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("heading", { name: "登录星语社区" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "登录表单" })).toBeTruthy();
  });
});
