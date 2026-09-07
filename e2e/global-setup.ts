const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:7779";
const webBaseUrl = process.env.WEB_BASE_URL ?? "http://127.0.0.1:7777";
const adminBaseUrl = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:7778";

async function assertReachable(name: string, url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null);
  if (!response?.ok) {
    throw new Error(
      `${name} 未就绪（${url}）。请先启动：后端 7779、社区前端 7777、管理端 7778。`
    );
  }
}

export default async function globalSetup() {
  await assertReachable("后端", `${apiBaseUrl}/health`);
  await assertReachable("社区前端", webBaseUrl);
  await assertReachable("管理端", adminBaseUrl);
}
