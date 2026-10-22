import { describe, expect, it } from "vitest";
import { buildLoginPath } from "./login-return-path";

/*
 * 互动入口的登录引导。用户点「登录后互动」时把当前位置带进 returnTo，
 * 登录页已能按它回跳；这里锁住路径拼装规则和两条边界：
 * 认证页不自我回跳、站外路径不进入 returnTo。
 */
describe("buildLoginPath", () => {
  it("带上当前位置，登录后可以回到原内容", () => {
    expect(buildLoginPath("/articles/abc")).toBe("/login?returnTo=%2Farticles%2Fabc");
  });

  it("保留 query 与 hash，登录后回到同一条内容", () => {
    expect(buildLoginPath("/series/s1/read?chapter=a1")).toBe(
      "/login?returnTo=%2Fseries%2Fs1%2Fread%3Fchapter%3Da1",
    );
    expect(buildLoginPath("/discover#item-3")).toBe("/login?returnTo=%2Fdiscover%23item-3");
  });

  it("首页不带 returnTo：登录回首页就是默认行为", () => {
    expect(buildLoginPath("/")).toBe("/login");
    expect(buildLoginPath("")).toBe("/login");
  });

  it("认证页不自我回跳", () => {
    expect(buildLoginPath("/login")).toBe("/login");
    expect(buildLoginPath("/login?returnTo=%2Farticles%2Fabc")).toBe("/login");
    expect(buildLoginPath("/register")).toBe("/login");
    expect(buildLoginPath("/force-change-password")).toBe("/login");
    expect(buildLoginPath("/reset-password/token-1")).toBe("/login");
  });

  it("站外路径不进入 returnTo", () => {
    expect(buildLoginPath("//evil.example.com/login")).toBe("/login");
    expect(buildLoginPath("https://evil.example.com")).toBe("/login");
  });
});
