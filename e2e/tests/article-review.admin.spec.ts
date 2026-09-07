import { expect, test } from "@playwright/test";
import {
  approveSubmission,
  loginCommunity,
  registerUser,
  seedArticleForReview,
  uniqueUser,
} from "../helpers/api";

test.describe("清单 §7-1：管理端审核", () => {
  test("管理员可在审核页通过投稿", async ({ page, request }) => {
    const user = uniqueUser("adminui");
    await registerUser(request, user);
    const token = await loginCommunity(request, user.email, user.password);

    const title = `E2E 管理端审核 ${Date.now()}`;
    const { articleId } = await seedArticleForReview(request, token, title);

    await page.goto("/login");
    await page.getByPlaceholder("请输入用户名").fill("admin");
    await page.getByPlaceholder("请输入密码").fill("admin123");
    await page.getByRole("button", { name: "登 录" }).click();

    await page.goto("/community/review");
    await expect(page.getByText("内容审核")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });

    const row = page.locator("tr").filter({ hasText: title });
    await row.getByRole("button", { name: "通过" }).click();
    await page.getByRole("button", { name: "提交" }).click();
    await expect(page.locator(".n-message").filter({ hasText: "已处理" })).toBeVisible({ timeout: 15_000 });

    const articleResponse = await request.get(`/api/v1/articles/${articleId}`);
    expect(articleResponse.ok()).toBeTruthy();
    const article = await articleResponse.json();
    expect(article.title).toBe(title);
  });
});
