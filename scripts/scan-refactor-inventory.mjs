#!/usr/bin/env node
/**
 * v4.1 refactor inventory scanner — generates FRONTEND/BACKEND/DATABASE_INVENTORY.md + REFACTOR_BASELINE.md
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WEB = join(ROOT, "xingyu-web");
const BACKEND = join(ROOT, "xingyu-backend");
const SQL_DIR = join(ROOT, "sql");

async function walk(dir, filter) {
  const out = [];
  async function go(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "target" || e.name === ".git") continue;
        await go(p);
      } else if (filter(p)) out.push(p);
    }
  }
  await go(dir);
  return out.sort();
}

function routeFromPage(file) {
  const rel = relative(join(WEB, "app"), file).replace(/\\/g, "/");
  const route = "/" + rel.replace(/\/page\.tsx$/, "").replace(/\[([^\]]+)\]/g, "{$1}");
  return route === "/" ? "/" : route.replace(/\/$/, "") || "/";
}

async function scanFrontend() {
  const pages = await walk(join(WEB, "app"), (p) => p.endsWith("page.tsx"));
  const routes = pages.map(routeFromPage);
  const groups = { studio: 0, messages: 0, me: 0, settings: 0, users: 0, spaces: 0, studio_articles: 0 };
  for (const r of routes) {
    if (r.startsWith("/studio/articles")) groups.studio_articles++;
    else if (r.startsWith("/studio")) groups.studio++;
    else if (r.startsWith("/messages")) groups.messages++;
    else if (r.startsWith("/me")) groups.me++;
    else if (r.startsWith("/settings")) groups.settings++;
    else if (r.startsWith("/users")) groups.users++;
    else if (r.startsWith("/spaces")) groups.spaces++;
  }

  const components = await walk(join(WEB, "components"), (p) => /(Card|List|Table|Form|Modal).*\.tsx$/i.test(p));
  const apiHits = [];
  for (const dir of [join(WEB, "app"), join(WEB, "components"), join(WEB, "lib")]) {
    const files = await walk(dir, (p) => /\.(tsx?|jsx?)$/.test(p));
    for (const f of files) {
      const content = await readFile(f, "utf8");
      if (/users|profile|space|creator|followUser|followCreator|\/users\//.test(content)) {
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        const lines = content.split("\n").map((l, i) => ({ l, i: i + 1 })).filter(({ l }) =>
          /users|profile|space|creator|followUser|followCreator|\/users\//.test(l)
        );
        if (lines.length) apiHits.push({ file: rel, count: lines.length });
      }
    }
  }

  let md = `# 前端资产盘点报告\n\n生成时间: ${new Date().toISOString()}\n\n`;
  md += `## 1. 页面路由统计\n\n总页面数: **${pages.length}**\n\n`;
  routes.forEach((r, i) => { md += `${i + 1}. \`${r}\`\n`; });

  md += `\n## 2. 路由分类统计\n\n`;
  md += `| 分组 | 数量 |\n|------|------|\n`;
  md += `| studio | ${groups.studio} |\n| studio/articles | ${groups.studio_articles} |\n`;
  md += `| messages | ${groups.messages} |\n| me | ${groups.me} |\n`;
  md += `| settings | ${groups.settings} |\n| users | ${groups.users} |\n| spaces | ${groups.spaces} |\n`;

  md += `\n## 3. Card/List/Form/Modal 组件\n\n`;
  components.forEach((c) => { md += `- \`${relative(ROOT, c).replace(/\\/g, "/")}\`\n`; });

  md += `\n## 4. 用户/关注/Space API 引用文件 (${apiHits.length} 个)\n\n`;
  apiHits.sort((a, b) => b.count - a.count).forEach(({ file, count }) => {
    md += `- \`${file}\` (${count} 处匹配)\n`;
  });

  md += `\n## 5. /users/ 硬编码链接\n\n`;
  const usersLinkFiles = [];
  for (const f of await walk(join(WEB), (p) => /\.(tsx?)$/.test(p))) {
    const c = await readFile(f, "utf8");
    if (c.includes("/users/")) usersLinkFiles.push(relative(ROOT, f).replace(/\\/g, "/"));
  }
  usersLinkFiles.forEach((f) => { md += `- \`${f}\`\n`; });

  return { md, pageCount: pages.length, groups, usersLinkFiles };
}

async function scanBackend() {
  const controllers = await walk(BACKEND, (p) => p.endsWith("Controller.java"));
  const services = await walk(BACKEND, (p) => p.endsWith("Service.java") && !p.includes("test"));
  const entities = await walk(BACKEND, (p) =>
    (p.endsWith("Entity.java") || p.endsWith("DO.java") || (p.includes("/entity/") && p.endsWith(".java"))) && !p.includes("test")
  );

  const creatorFollowRefs = [];
  const allJava = await walk(BACKEND, (p) => p.endsWith(".java") && !p.includes("test"));
  for (const f of allJava) {
    const c = await readFile(f, "utf8");
    if (/CreatorFollow|creator_follow/.test(c)) creatorFollowRefs.push(relative(ROOT, f).replace(/\\/g, "/"));
  }

  const endpoints = [];
  for (const f of controllers) {
    const c = await readFile(f, "utf8");
    const classMatch = c.match(/@RequestMapping\(["']([^"']+)["']\)/);
    const base = classMatch ? classMatch[1] : "";
    const mappings = [...c.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(["']([^"']*)["']\))?/g)];
    for (const m of mappings) {
      endpoints.push({
        controller: relative(ROOT, f).replace(/\\/g, "/"),
        method: m[1].toUpperCase(),
        path: (base + (m[2] || "")).replace("//", "/") || base,
      });
    }
  }

  let md = `# 后端资产盘点报告\n\n生成时间: ${new Date().toISOString()}\n\n`;
  md += `## 1. Controller 统计 (${controllers.length})\n\n`;
  controllers.forEach((c) => { md += `- \`${relative(ROOT, c).replace(/\\/g, "/")}\`\n`; });

  md += `\n## 2. Service 统计 (${services.length})\n\n`;
  services.slice(0, 80).forEach((s) => { md += `- \`${relative(ROOT, s).replace(/\\/g, "/")}\`\n`; });
  if (services.length > 80) md += `\n... 另有 ${services.length - 80} 个 Service\n`;

  md += `\n## 3. Entity 统计 (${entities.length})\n\n`;
  entities.forEach((e) => { md += `- \`${relative(ROOT, e).replace(/\\/g, "/")}\`\n`; });

  md += `\n## 4. creator_follow 引用 (${creatorFollowRefs.length} 文件)\n\n`;
  creatorFollowRefs.forEach((f) => { md += `- \`${f}\`\n`; });

  md += `\n## 5. API 端点清单 (前 100)\n\n| Method | Path | Controller |\n|--------|------|------------|\n`;
  endpoints.slice(0, 100).forEach((e) => {
    md += `| ${e.method} | \`${e.path}\` | \`${e.controller.split("/").pop()}\` |\n`;
  });
  if (endpoints.length > 100) md += `\n... 另有 ${endpoints.length - 100} 个端点\n`;

  return { md, controllerCount: controllers.length, creatorFollowRefs };
}

async function scanDatabase() {
  const sqlFiles = await walk(SQL_DIR, (p) => p.endsWith(".sql"));
  const tables = new Set();
  const fks = [];
  let indexCount = 0;

  for (const f of sqlFiles) {
    const c = await readFile(f, "utf8");
    for (const m of c.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? [`']?(\w+)[`']?/gi)) tables.add(m[1]);
    for (const line of c.split("\n")) {
      if (/FOREIGN KEY|REFERENCES/i.test(line)) fks.push(line.trim());
      if (/\b(KEY|INDEX)\b/i.test(line) && !/PRIMARY KEY/i.test(line)) indexCount++;
    }
  }

  let md = `# 数据库资产盘点报告\n\n生成时间: ${new Date().toISOString()}\n\n`;
  md += `## 1. 表清单 (${tables.size})\n\n`;
  [...tables].sort().forEach((t, i) => { md += `${i + 1}. \`${t}\`\n`; });

  md += `\n## 2. 外键关系 (${fks.length} 条)\n\n`;
  [...new Set(fks)].sort().slice(0, 50).forEach((fk) => { md += `- \`${fk}\`\n`; });

  md += `\n## 3. 索引统计\n\n非 PRIMARY KEY 索引约 **${indexCount}** 条（跨所有迁移文件）\n`;
  md += `\n## 4. 迁移文件\n\n`;
  sqlFiles.forEach((f) => { md += `- \`${relative(ROOT, f).replace(/\\/g, "/")}\`\n`; });

  return { md, tableCount: tables.size, hasCreatorFollow: tables.has("creator_follow") };
}

async function main() {
  const [fe, be, db] = await Promise.all([scanFrontend(), scanBackend(), scanDatabase()]);

  await writeFile(join(ROOT, "FRONTEND_INVENTORY.md"), fe.md);
  await writeFile(join(ROOT, "BACKEND_INVENTORY.md"), be.md);
  await writeFile(join(ROOT, "DATABASE_INVENTORY.md"), db.md);

  let baseline = `# 重构基线汇总 (REFACTOR_BASELINE)\n\n生成时间: ${new Date().toISOString()}\n\n`;
  baseline += `## 数量基线\n\n| 指标 | 当前值 | 目标值 |\n|------|--------|--------|\n`;
  baseline += `| 前端 page.tsx | ${fe.pageCount} | 130-140 |\n`;
  baseline += `| studio 页面 | ${fe.groups.studio + fe.groups.studio_articles} | 10-12 |\n`;
  baseline += `| messages 页面 | ${fe.groups.messages} | 5-6 |\n`;
  baseline += `| 后端 Controller | ${be.controllerCount} | — |\n`;
  baseline += `| 数据库表 | ${db.tableCount} | — |\n`;
  baseline += `| creator_follow 表 | ${db.hasCreatorFollow ? "存在" : "已迁移"} | user_follow |\n`;
  baseline += `| /users/ 链接文件 | ${fe.usersLinkFiles.length} | 0 |\n\n`;

  baseline += `## 差距矩阵\n\n`;
  baseline += `| 任务 | 状态 |\n|------|------|\n`;
  baseline += `| Phase -1 资产盘点 | 完成 |\n`;
  baseline += `| /u/[username] 路由 | 完成 |\n`;
  baseline += `| creator_follow → user_follow | 后端完成 (SQL V036 待执行) |\n`;
  baseline += `| FeedService | 完成 |\n`;
  baseline += `| Studio 收敛 | 进行中 (redirects + modals) |\n`;
  baseline += `| Messages 收敛 | 进行中 (统一会话页) |\n`;
  baseline += `| ROUTE_MIGRATION_MAP | 完成 |\n`;
  baseline += `| COMPONENT_GUIDELINES | 完成 |\n\n`;

  baseline += `## creator_follow 待改文件\n\n`;
  be.creatorFollowRefs.forEach((f) => { baseline += `- \`${f}\`\n`; });

  baseline += `\n## /users/ 待替换文件\n\n`;
  fe.usersLinkFiles.forEach((f) => { baseline += `- \`${f}\`\n`; });

  await writeFile(join(ROOT, "REFACTOR_BASELINE.md"), baseline);
  console.log("Generated FRONTEND_INVENTORY.md, BACKEND_INVENTORY.md, DATABASE_INVENTORY.md, REFACTOR_BASELINE.md");
}

main().catch((e) => { console.error(e); process.exit(1); });
