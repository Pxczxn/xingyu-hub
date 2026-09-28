import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/*
 * ⚠️ 一次性历史脚本 — 已失效，不要重跑。
 *
 * Legacy 用户端已于 2026-09-28 归档到 `archive/xingyu-web-legacy/`，
 * 下面的 walk 目标 `xingyu-web` 已不存在，脚本只会空跑。
 * 它本意是批量**改写**归档代码里的链接，重跑既无意义也无收益。
 * 保留原样，不要修路径。
 */

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", ".git"].includes(e.name)) await walk(p, out);
    } else if (/\.(tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk("xingyu-web");
for (const f of files) {
  let c = await readFile(f, "utf8");
  let n = c.replace(/\/users\/\$\{/g, "/u/${");
  n = n.replace(/"\/users\/" \+ username/g, '"/u/" + username');
  n = n.replace(/`\/users\/\$\{/g, "`/u/${");
  if (n !== c) {
    await writeFile(f, n);
    console.log(f);
  }
}
