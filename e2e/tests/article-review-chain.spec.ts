import { expect, test } from "@playwright/test";
import {
  approveSubmission,
  injectCommunitySession,
  loginCommunity,
  registerUser,
  seedArticleForReview,
  uniqueUser,
} from "../helpers/api";

test.describe("清单 §7-1：文章审核发布", () => {
  test("提交审核后管理端通过，用户端可阅读文章", async ({ page, request }) => {
    const user = uniqueUser("review");
    await registerUser(request, user);
    const token = await loginCommunity(request, user.email, user.password);

    const title = `E2E 审核文章 ${Date.now()}`;
    const { articleId, submissionId } = await seedArticleForReview(request, token, title);
    await approveSubmission(request, submissionId);

    await injectCommunitySession(page, token);
    await page.goto(`/articles/${articleId}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("E2E 正文")).toBeVisible();
  });
});

test.describe("清单 §7-1：创作端状态", () => {
  test("提交后创作端审核中列表可见文章", async ({ page, request }) => {
    const user = uniqueUser("studio");
    await registerUser(request, user);
    const token = await loginCommunity(request, user.email, user.password);

    const title = `E2E 审核中 ${Date.now()}`;
    await seedArticleForReview(request, token, title);

    await injectCommunitySession(page, token);
    await page.goto("/studio/reviewing");
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
  });
});
