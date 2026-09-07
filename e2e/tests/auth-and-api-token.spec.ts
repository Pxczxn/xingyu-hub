import { expect, test } from "@playwright/test";
import { injectCommunitySession, loginCommunity, uniqueUser } from "../helpers/api";

test.describe("清单 §7-1：注册与登录", () => {
  test("用户可注册并登录进入已登录首页", async ({ page }) => {
    const user = uniqueUser("e2e");

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "加入星语社区" })).toBeVisible();

    await page.locator("#email").fill(user.email);
    await page.locator("#username").fill(user.username);
    await page.locator("#password").fill(user.password);
    await page.getByRole("button", { name: "注册" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("注册成功，请登录。")).toBeVisible();

    await page.locator("#login").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page.getByRole("link", { name: /继续创作/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(new RegExp(user.username))).toBeVisible();
  });
});

test.describe("清单 §7-5：开放 API Token", () => {
  test("设置页创建 Token 后可调用 /open/profile", async ({ page, request }) => {
    const user = uniqueUser("token");
    const registerResponse = await request.post("/api/v1/auth/register", {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: {
        email: user.email,
        username: user.username,
        password: user.password,
        termsVersion: "1.0",
      },
    });
    expect(registerResponse.ok()).toBeTruthy();

    const token = await loginCommunity(request, user.email, user.password);
    await injectCommunitySession(page, token);

    await page.goto("/settings/api-tokens");
    await expect(page.getByRole("heading", { name: "开放 API" })).toBeVisible();

    const tokenName = `E2E Token ${Date.now()}`;
    await page.getByPlaceholder("Token 名称，例如 CI 同步").fill(tokenName);
    await page.getByRole("button", { name: "创建 Token" }).click();

    const createdAlert = page.locator("code").filter({ hasText: /^xy_/ });
    await expect(createdAlert).toBeVisible();
    const apiToken = (await createdAlert.textContent())?.trim();
    expect(apiToken).toBeTruthy();

    const profileResponse = await request.get("/api/v1/open/profile", {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    expect(profileResponse.ok()).toBeTruthy();
    const profile = await profileResponse.json();
    expect(profile.username).toBe(user.username);
  });
});
