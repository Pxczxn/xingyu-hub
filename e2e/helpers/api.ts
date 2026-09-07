import type { APIRequestContext } from "@playwright/test";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:7779";
export const TEST_PASSWORD = "Test1234!@#ab";

export type RegisteredUser = {
  email: string;
  username: string;
  password: string;
  userId: string;
};

export function uniqueUser(prefix: string): Omit<RegisteredUser, "userId"> {
  const nonce = `${Date.now()}${Math.floor(Math.random() * 1_000)}`;
  return {
    email: `${prefix}${nonce}@example.com`,
    username: `${prefix}${nonce.slice(-9)}`,
    password: TEST_PASSWORD,
  };
}

export async function registerUser(
  request: APIRequestContext,
  input: Omit<RegisteredUser, "userId">
): Promise<RegisteredUser> {
  const response = await request.post(`${API_BASE_URL}/api/v1/auth/register`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      email: input.email,
      username: input.username,
      password: input.password,
      termsVersion: "1.0",
    },
  });
  if (!response.ok()) {
    throw new Error(`注册失败: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return { ...input, userId: String(body.userId) };
}

export async function loginCommunity(
  request: APIRequestContext,
  login: string,
  password: string
): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/v1/auth/login`, {
    data: { login, password, rememberMe: false },
  });
  if (!response.ok()) {
    throw new Error(`社区登录失败: ${response.status()} ${await response.text()}`);
  }
  const token = response.headers()["satoken"];
  if (!token) {
    throw new Error("社区登录未返回 satoken");
  }
  return token;
}

export async function loginAdmin(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/v1/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  if (!response.ok()) {
    throw new Error(`管理端登录失败: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const token = body?.data?.token;
  if (!token) {
    throw new Error("管理端登录未返回 token");
  }
  return token as string;
}

export async function seedArticleForReview(
  request: APIRequestContext,
  token: string,
  title: string
): Promise<{ articleId: string; submissionId: string }> {
  await request.patch(`${API_BASE_URL}/api/v1/me/profile`, {
    headers: { satoken: token },
    data: { visibility: "PUBLIC", lockVersion: 0 },
  });

  const createResponse = await request.post(`${API_BASE_URL}/api/v1/me/articles`, {
    headers: { satoken: token },
    data: {},
  });
  if (!createResponse.ok()) {
    throw new Error(`创建文章失败: ${createResponse.status()}`);
  }
  const created = await createResponse.json();
  const articleId = String(created.articleId);

  const draftResponse = await request.put(`${API_BASE_URL}/api/v1/me/articles/${articleId}/draft`, {
    headers: { satoken: token },
    data: {
      title,
      summary: "E2E 摘要",
      bodyMode: "MARKDOWN",
      body: "E2E 正文",
      lockVersion: 0,
      visibility: "PUBLIC",
    },
  });
  if (!draftResponse.ok()) {
    throw new Error(`保存草稿失败: ${draftResponse.status()}`);
  }

  const submitResponse = await request.post(`${API_BASE_URL}/api/v1/me/articles/${articleId}/submit`, {
    headers: { satoken: token },
  });
  if (!submitResponse.ok()) {
    throw new Error(`提交审核失败: ${submitResponse.status()}`);
  }

  const adminToken = await loginAdmin(request);
  const queueResponse = await request.get(`${API_BASE_URL}/api/v1/admin/review/queue`, {
    headers: { Authorization: adminToken },
  });
  if (!queueResponse.ok()) {
    throw new Error(`读取审核队列失败: ${queueResponse.status()}`);
  }
  const queue = await queueResponse.json();
  const item = (queue as Array<{ articleId: string; submissionId: string }>).find(
    (entry) => entry.articleId === articleId
  );
  if (!item?.submissionId) {
    throw new Error("审核队列中未找到刚提交的文章");
  }
  return { articleId, submissionId: item.submissionId };
}

export async function approveSubmission(
  request: APIRequestContext,
  submissionId: string,
  comment = "E2E 自动通过"
) {
  const adminToken = await loginAdmin(request);
  const response = await request.post(`${API_BASE_URL}/api/v1/admin/review/${submissionId}/decide`, {
    headers: { Authorization: adminToken },
    data: { decision: "APPROVED", comment },
  });
  if (!response.ok()) {
    throw new Error(`审核通过失败: ${response.status()} ${await response.text()}`);
  }
}

export async function injectCommunitySession(page: import("@playwright/test").Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem("xingyu-satoken", value);
  }, token);
}
