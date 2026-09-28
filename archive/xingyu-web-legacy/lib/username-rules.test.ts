import { describe, expect, it } from "vitest";
import { USERNAME_FORMAT_HINT, USERNAME_UNAVAILABLE_MESSAGE, mapUsernameFieldError, validateUsernameClient } from "@/lib/username-rules";

describe("username rule helpers", () => {
  it("accepts valid username", () => {
    expect(validateUsernameClient("alice_01")).toBeNull();
  });

  it("rejects invalid username format with unified message", () => {
    expect(validateUsernameClient("ab")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
    expect(validateUsernameClient("user-name")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
  });

  it("maps api username errors to unified message", () => {
    expect(mapUsernameFieldError("用户名已被占用")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
    expect(mapUsernameFieldError("用户名格式无效")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
  });

  it("exposes standard format hint", () => {
    expect(USERNAME_FORMAT_HINT).toBe("小写字母、数字、下划线，3-32 位");
  });
});
