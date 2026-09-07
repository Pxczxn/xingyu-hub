import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
