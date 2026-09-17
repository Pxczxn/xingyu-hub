#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strip = "xy-discover-";
const base = "xy-discover-page";

function toCamel(s) {
  return s.split("-").filter(Boolean).map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

function globalToLocal(cls) {
  if (cls === base) return "discoverPage";
  if (cls.startsWith(strip)) return toCamel(cls.slice(strip.length)) || "discoverPage";
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9-]*)/g, (full, cls) => {
    if (!cls.startsWith("xy-discover") && !cls.startsWith("is-")) return full;
    return "." + globalToLocal(cls);
  });
}

const globalsPath = resolve(root, "app/globals.css");
const lines = readFileSync(globalsPath, "utf8").split("\n");

// Line ranges containing xy-discover rules (1-based inclusive)
const ranges = [
  [12985, 13035],
  [15277, 15384],
  [15478, 15702],
  [15797, 15873],
];

const removeSet = new Set();
const extracted = [];
for (const [s, e] of ranges) {
  for (let i = s - 1; i < e; i++) {
    removeSet.add(i);
    extracted.push(lines[i]);
  }
}

const moduleCss = transformCss(extracted.join("\n"));
writeFileSync(resolve(root, "components/community/discover-prototype-page.module.css"), moduleCss.trim() + "\n");

// Tab-only rules for search page sharing
const tabCss = moduleCss
  .split("\n")
  .filter((l) => l.includes("typeTabs") || l.includes("sortTabs") || l.includes("sortRow"))
  .join("\n");
writeFileSync(resolve(root, "components/community/discover-tabs.module.css"), tabCss.trim() + "\n");

let kept = lines.filter((_, i) => !removeSet.has(i));
let globalsOut = kept.join("\n");
globalsOut = globalsOut.replace(
  ".xy-app-content > main > .xy-discover-page",
  '.xy-app-content > main[data-layout="discover"]',
);
globalsOut = globalsOut.replace(
  ".xy-app-content > main > .xy-discover-page { width: 100%; }",
  '.xy-app-content > main[data-layout="discover"] { width: 100%; }',
);
writeFileSync(globalsPath, globalsOut, "utf8");

const tsxFiles = [
  { file: "components/community/discover-prototype-page.tsx", module: "./discover-prototype-page.module.css" },
  { file: "app/discover/page.tsx", module: "@/components/community/discover-prototype-page.module.css" },
  { file: "app/search/page.tsx", module: "@/components/community/discover-tabs.module.css" },
];

const allGlobals = new Set();
for (const { file } of tsxFiles) {
  const content = readFileSync(resolve(root, file), "utf8");
  const re = /xy-discover(?:--[a-z]+|-[a-z0-9-]+)*|is-[a-z]+/g;
  let m;
  while ((m = re.exec(content)) !== null) allGlobals.add(m[0]);
}
const classMap = {};
for (const g of allGlobals) classMap[g] = globalToLocal(g);

function mapClassString(classes) {
  const parts = classes.split(/\s+/).filter(Boolean);
  const mapped = parts.map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`));
  if (!parts.some((p) => classMap[p])) return null;
  return `cn(${mapped.join(", ")})`;
}

for (const { file, module: importPath } of tsxFiles) {
  const path = resolve(root, file);
  let out = readFileSync(path, "utf8");
  const moduleFile = importPath.split("/").pop();
  if (!out.includes(moduleFile)) {
    const idx = out.indexOf("\n", out.indexOf('"use client"'));
    out = out.slice(0, idx + 1) + `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` + out.slice(idx + 1);
  }
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes);
    return expr ? `className={${expr}}` : match;
  });
  if (file.includes("discover-prototype-page")) {
    out = out.replace(
      /className=\{cn\(styles\.discoverPage\)\}/,
      'className={styles.discoverPage} data-layout="discover"',
    );
  }
  writeFileSync(path, out, "utf8");
}

console.log("Discover migrated", Object.keys(classMap).length, "classes");
