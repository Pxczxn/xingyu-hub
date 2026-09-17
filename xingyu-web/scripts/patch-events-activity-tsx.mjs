#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = resolve(root, "app/events/events.module.css");
const tsxFiles = [
  "app/events/starry/results/page.tsx",
  "app/events/starry/rankings/page.tsx",
  "app/events/starry/register/page.tsx",
  "app/events/future-book/rules/page.tsx",
].map((p) => resolve(root, p));

function toCamel(name) {
  const base = name.replace(/^xy-/, "");
  return base
    .split("-")
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

function collectClasses(content) {
  const classes = new Set();
  const re = /\bxy-[a-z0-9-]+\b/g;
  let m;
  while ((m = re.exec(content)) !== null) classes.add(m[0]);
  return classes;
}

const allClasses = new Set();
for (const file of tsxFiles) {
  for (const cls of collectClasses(readFileSync(file, "utf8"))) allClasses.add(cls);
}

const map = new Map([...allClasses].map((cls) => [cls, toCamel(cls)]));
let css = readFileSync(cssPath, "utf8");
const sorted = [...map.keys()].sort((a, b) => b.length - a.length);
for (const global of sorted) {
  const local = map.get(global);
  const escaped = global.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  css = css.replace(new RegExp(`\\.${escaped}(?=[\\s,.:{>+~\\[])`, "g"), `.${local}`);
  css = css.replace(new RegExp(`:not\\(\\.${escaped}\\)`, "g"), `:not(.${local})`);
}
writeFileSync(cssPath, css, "utf8");

function patchTsx(content, importPath) {
  let out = content;
  if (!out.includes(`from "${importPath}"`)) {
    out = out.replace(
      /("use client";\n)?/,
      (m) => `${m || ""}import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n`,
    );
  } else if (!out.includes('from "@/lib/utils"')) {
    out = out.replace(/import styles from/, 'import { cn } from "@/lib/utils";\nimport styles from');
  }

  out = out.replace(/className=\{([^}]*)\s*\?\s*"active"\s*:\s*""\s*\}/g, (_, cond) =>
    `className={cn(${cond.trim()} && styles.active)}`,
  );
  out = out.replace(/className="active"/g, "className={cn(styles.active)}");
  out = out.replace(/className="done"/g, "className={cn(styles.done)}");

  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const parts = classes.split(/\s+/).filter(Boolean);
    const mapped = parts.map((part) => {
      if (map.has(part)) return `styles.${map.get(part)}`;
      if (part === "active") return "styles.active";
      if (part === "done") return "styles.done";
      return JSON.stringify(part);
    });
    if (!mapped.some((m) => m.startsWith("styles."))) return match;
    return `className={cn(${mapped.join(", ")})}`;
  });

  return out;
}

for (const file of tsxFiles) {
  const relImport =
    file.includes("future-book")
      ? "../../events.module.css"
      : "../../events.module.css";
  const patched = patchTsx(readFileSync(file, "utf8"), relImport);
  writeFileSync(file, patched, "utf8");
  console.log("Patched", file.replace(root + "\\", "").replace(root + "/", ""));
}

console.log("Renamed", map.size, "classes in events.module.css");
