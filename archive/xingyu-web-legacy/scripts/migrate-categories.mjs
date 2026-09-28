#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function toCamel(s) {
  return s
    .split("-")
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function globalToLocal(cls, strip, rootClass) {
  const base = strip.replace(/-$/, "");
  if (cls === base || cls === `xy-category-${base.replace("xy-category-", "")}`) return rootClass;
  if (cls === "xy-category-page") return "categoryPage";
  if (cls === "xy-category-real") return "categoryReal";
  if (cls.startsWith(strip)) {
    let rest = cls.slice(strip.length).replace(/^-+/, "");
    if (rest.includes("--")) {
      const [b, mod] = rest.split("--");
      return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
    }
    return toCamel(rest);
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css) {
  const strip = "xy-category-";
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
    if (!cls.startsWith("xy-category") && !cls.startsWith("is-")) return full;
    if (cls === "xy-category-page") return ".categoryPage";
    if (cls === "xy-category-real") return ".categoryReal";
    if (!cls.startsWith(strip) && !cls.startsWith("is-")) return full;
    return "." + globalToLocal(cls, strip, "categoryPage");
  });
}

const browsePath = resolve(root, "components/community/browse-secondary.module.css");
const browseLines = readFileSync(browsePath, "utf8").split("\n");
const start = browseLines.findIndex((l) => l.includes("分类浏览") || l.includes(".xy-category-page"));
const end = browseLines.findIndex((l, i) => i > start && (l.startsWith(".plaza {") || (l.startsWith("/* ") && l.includes(".plaza"))));
if (start < 0 || end < 0) {
  console.log("Category block not found", start, end);
  process.exit(1);
}

const extracted = browseLines.slice(start, end).join("\n");
writeFileSync(resolve(root, "app/categories/categories.module.css"), transformCss(extracted).trim() + "\n", "utf8");
writeFileSync(
  browsePath,
  [...browseLines.slice(0, start), ...browseLines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n"),
  "utf8",
);

const pagePath = resolve(root, "app/categories/page.tsx");
let page = readFileSync(pagePath, "utf8");
page = page.replace(
  'import styles from "@/components/community/browse-secondary.module.css";',
  'import styles from "./categories.module.css";',
);
page = page.replace(/className="([^"]*xy-category[^"]+)"/g, (match, classes) => {
  const parts = classes.split(/\s+/).filter(Boolean);
  const map = {};
  const re = /xy-category-[a-z0-9-]+/g;
  let m;
  const content = readFileSync(pagePath, "utf8");
  while ((m = re.exec(content)) !== null) {
    map[m[0]] = globalToLocal(m[0], "xy-category-", "categoryPage");
  }
  map["xy-category-page"] = "categoryPage";
  map["xy-category-real"] = "categoryReal";
  map["active"] = "active";
  const expr = parts.map((p) => (map[p] ? `styles.${map[p]}` : `"${p}"`)).join(", ");
  return `className={cn(${expr})}`;
});
page = page.replace(/className=\{activeType === type \? "active" : ""\}/g, "className={activeType === type ? styles.active : undefined}");
if (!page.includes('import { cn }')) {
  page = page.replace(/import styles/, 'import { cn } from "@/lib/utils";\nimport styles');
}
writeFileSync(pagePath, page, "utf8");
console.log("OK categories.module.css");
