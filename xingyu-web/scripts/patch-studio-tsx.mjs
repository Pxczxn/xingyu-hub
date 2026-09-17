#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strip = "xy-studio-hub-";
const base = "xy-studio-hub";

function toCamel(s) {
  return s.split("-").filter(Boolean).map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

function globalToLocal(cls) {
  if (cls === base) return "studioHub";
  if (cls.startsWith(strip)) {
    let rest = cls.slice(strip.length);
    if (rest.includes("--")) {
      const [b, mod] = rest.split("--");
      return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
    }
    return toCamel(rest) || "studioHub";
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

const tsxFiles = [
  "app/studio/page.tsx",
  "components/studio/studio-hub-aside.tsx",
  "components/studio/studio-hub-quick-create.tsx",
  "components/studio/studio-hub-nav.tsx",
  "components/studio/studio-hub-todos.tsx",
  "components/studio/studio-hub-metrics.tsx",
  "components/studio/studio-hub-hero.tsx",
  "components/studio/studio-hub-recent.tsx",
];

const allGlobals = new Set();
for (const file of tsxFiles) {
  const content = readFileSync(resolve(root, file), "utf8");
  const re = /xy-studio-hub(?:--[a-z]+|-[a-z0-9-]+)*|is-[a-z]+/g;
  let m;
  while ((m = re.exec(content)) !== null) allGlobals.add(m[0]);
}
const classMap = {};
for (const g of allGlobals) classMap[g] = globalToLocal(g);

function mapClassString(classes) {
  const parts = classes.split(/\s+/).filter(Boolean);
  const mapped = parts.map((p) => {
    if (p === "short") return { type: "literal", value: '"short"' };
    if (classMap[p]) return { type: "style", value: `styles.${classMap[p]}` };
    return { type: "literal", value: `"${p}"` };
  });
  const hasStyle = mapped.some((m) => m.type === "style");
  if (!hasStyle) return null;
  return `cn(${mapped.map((m) => m.value).join(", ")})`;
}

function patch(content, importPath) {
  let out = content;
  if (!out.includes("studio-hub.module.css")) {
    const idx = out.indexOf("\n", out.indexOf('"use client"'));
    out = out.slice(0, idx + 1) + `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` + out.slice(idx + 1);
  }

  out = out.replace(
    'className={`xy-studio-hub-hero${collapsed ? " is-collapsed" : ""}`}',
    "className={cn(styles.hero, collapsed && styles.isCollapsed)}",
  );

  out = out.replace(
    /className=\{`xy-studio-hub-status is-\$\{status\.tone\}`\}/g,
    "className={cn(styles.status, styles[`is${status.tone.charAt(0).toUpperCase()}${status.tone.slice(1)}` as keyof typeof styles])}",
  );

  out = out.replace(
    /className=\{(\w+)\s*\?\s*"is-active"\s*:\s*undefined\}/g,
    "className={$1 ? styles.isActive : undefined}",
  );

  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes);
    return expr ? `className={${expr}}` : match;
  });

  out = out.replace(
    /<main className=\{styles\.studioHub\}/g,
    '<main className={styles.studioHub} data-layout="studio-hub"',
  );

  return out;
}

for (const file of tsxFiles) {
  const importPath = file.startsWith("app/") ? "@/components/studio/studio-hub.module.css" : "./studio-hub.module.css";
  const path = resolve(root, file);
  writeFileSync(path, patch(readFileSync(path, "utf8"), importPath), "utf8");
}
console.log("Patched", tsxFiles.length, "files");
