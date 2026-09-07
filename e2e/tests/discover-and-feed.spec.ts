import { expect, test } from "@playwright/test";
import { injectCommunitySession, loginCommunity, registerUser, uniqueUser } from "../helpers/api";

test.describe("清单 §7-4：发现页", () => {
  test("登录用户可访问发现页", async ({ page, request }) => {
    const user = uniqueUser("discover");
    await registerUser(request, user);
    const token = await loginCommunity(request, user.email, user.password);
    await injectCommunitySession(page, token);

    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "发现" })).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("清单 §7-5：SEO/RSS", () => {
  test("feed.xml 可访问且返回 RSS", async ({ request }) => {
    const response = await request.get("/api/v1/feed.xml");
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain("<rss");
  });
});
