#!/usr/bin/env node
/*
 * Bundle budget gate (P1-5).
 *
 * Why this exists
 * ---------------
 * After P1-1 every feature page is `lazy()`, so the *entry* chunk is no longer a
 * proxy for what the browser must download before first paint.  Shrinking the
 * entry by moving code into `modulepreload` chunks is a fake win.  So the primary
 * metric here is the **statically reachable first-paint set**:
 *
 *   index.html <script>/<link> + every `modulepreload` + their transitive
 *   *static* `import` / `export … from` dependencies, plus all CSS.
 *
 * Dynamic `import()` targets (the lazy route chunks) are deliberately excluded —
 * they are not part of first paint.
 *
 * Checks
 * ------
 *   1. first-paint JS+CSS gzip            <= 200 kB
 *   2. entry chunk editor/read markers     == 0      (proves the read pipeline and
 *                                                     the editor did not leak back)
 *   3. dangling chunk references           == 0      (every referenced file exists)
 *
 * gzip is measured with zlib level 6, matching the numbers documented in the
 * refactor plan.  Do NOT mix these with the build reporter's own gzip figures —
 * it uses its own implementation and reports ~1 % larger.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST = path.resolve(process.argv[2] ?? "dist");
const ASSETS = path.join(DIST, "assets");

const FIRST_PAINT_GZIP_LIMIT = 200 * 1024;

const LEAK_MARKERS = [
  "micromark",
  "remark",
  "rehype",
  "unified",
  "mdast",
  "turndown",
  "milkdown",
  "crepe",
  "prosemirror",
  "CodeMirror",
];

// `from"./x.js"` covers both `import … from` and `export … from`.
// `import"./x.js"` covers side-effect imports.  Neither matches `import("./x.js")`,
// which is exactly what we want — dynamic targets are not first paint.
const STATIC_DEP = /(?:from|import)\s*["'`]\.\/([A-Za-z0-9_.-]+\.js)["'`]/g;
// Anything a chunk might reference at runtime, including backtick dynamic imports
// (rolldown emits `import(\`./clike-XXXX.js\`)`) and the vite mapDeps list.
const ANY_DEP =
  /["'`]\.\/([A-Za-z0-9_.-]+\.(?:js|css))["'`]|["'`]assets\/([A-Za-z0-9_.-]+\.(?:js|css))["'`]/g;

const failures = [];

function fail(message) {
  failures.push(message);
  console.error("  FAIL  " + message);
}

function gzipSize(buf) {
  return zlib.gzipSync(buf, { level: 6 }).length;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(2) + " kB";
}

if (!fs.existsSync(DIST) || !fs.existsSync(ASSETS)) {
  console.error(`dist not found at ${DIST} — run \`npm run build\` first.`);
  process.exit(2);
}

const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const present = new Set(fs.readdirSync(ASSETS));

// ---------------------------------------------------------------- 1. first paint
const cssNames = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);

const queue = [
  ...[...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/rel="modulepreload"[^>]*href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]),
];

const seenJs = new Set();
const firstPaintJs = [];
while (queue.length > 0) {
  const name = queue.shift();
  if (!name || seenJs.has(name)) continue;
  seenJs.add(name);
  if (!present.has(name)) {
    fail(`index.html references missing asset: ${name}`);
    continue;
  }
  const buf = fs.readFileSync(path.join(ASSETS, name));
  const source = buf.toString("utf8");
  firstPaintJs.push({ name, raw: buf.length, gzip: gzipSize(buf) });
  for (const m of source.matchAll(STATIC_DEP)) queue.push(m[1]);
}

const cssRows = cssNames.map((name) => {
  if (!present.has(name)) {
    fail(`index.html references missing stylesheet: ${name}`);
    return { name, raw: 0, gzip: 0 };
  }
  const buf = fs.readFileSync(path.join(ASSETS, name));
  return { name, raw: buf.length, gzip: gzipSize(buf) };
});

const rows = [...firstPaintJs, ...cssRows];
const totalRaw = rows.reduce((sum, r) => sum + r.raw, 0);
const totalGzip = rows.reduce((sum, r) => sum + r.gzip, 0);

console.log("First paint = index.html refs + modulepreload + transitive static deps + CSS");
for (const r of [...rows].sort((a, b) => b.gzip - a.gzip)) {
  console.log(
    `  ${r.name.padEnd(32)} raw ${String(r.raw).padStart(9)}  gzip ${String(r.gzip).padStart(8)}`,
  );
}
console.log(
  `  ${"TOTAL".padEnd(32)} raw ${String(totalRaw).padStart(9)}  gzip ${String(totalGzip).padStart(8)}`,
);
console.log(
  `  budget ${kb(FIRST_PAINT_GZIP_LIMIT)} gzip — used ${((totalGzip / FIRST_PAINT_GZIP_LIMIT) * 100).toFixed(1)} %`,
);
if (totalGzip > FIRST_PAINT_GZIP_LIMIT) {
  fail(`first paint gzip ${kb(totalGzip)} exceeds the ${kb(FIRST_PAINT_GZIP_LIMIT)} budget`);
}

// ------------------------------------------------------------- 2. leak markers
const entryName = firstPaintJs.map((f) => f.name).find((n) => /^index-.*\.js$/.test(n));
if (!entryName) {
  fail("no entry chunk (index-*.js) found among the first-paint assets");
} else {
  const entrySource = fs.readFileSync(path.join(ASSETS, entryName), "utf8");
  const hits = LEAK_MARKERS.map((marker) => ({
    marker,
    count: (entrySource.match(new RegExp(marker, "gi")) ?? []).length,
  })).filter((h) => h.count > 0);

  console.log(`\nEntry chunk leak scan (${entryName}) — all markers must be 0`);
  if (hits.length === 0) {
    console.log(`  ok    all ${LEAK_MARKERS.length} markers absent`);
  } else {
    for (const h of hits) fail(`entry chunk contains "${h.marker}" ×${h.count}`);
  }
}

// -------------------------------------------------------- 3. dangling references
let dangling = 0;
for (const file of fs.readdirSync(ASSETS)) {
  if (!file.endsWith(".js")) continue;
  const source = fs.readFileSync(path.join(ASSETS, file), "utf8");
  for (const m of source.matchAll(ANY_DEP)) {
    const target = m[1] ?? m[2];
    if (target && !present.has(target)) {
      fail(`${file} references missing ${target}`);
      dangling += 1;
    }
  }
}
console.log(`\nDangling chunk references: ${dangling}`);

// --------------------------------------------------------------------- verdict
console.log();
if (failures.length > 0) {
  console.error(
    `Bundle budget FAILED (${failures.length} problem${failures.length === 1 ? "" : "s"}).`,
  );
  process.exit(1);
}
console.log("Bundle budget OK.");
