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

function transformCss(css) {
  let out = css.replace(/@keyframes xy-studio-hub-shimmer/g, "@keyframes shimmer");
  out = out.replace(/xy-studio-hub-shimmer/g, "shimmer");
  return out.replace(/\.([a-zA-Z][a-zA-Z0-9-]*)/g, (full, cls) => {
    if (!cls.startsWith("xy-studio-hub") && !cls.startsWith("is-")) return full;
    return "." + globalToLocal(cls);
  });
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

const globalsPath = resolve(root, "app/globals.css");
const lines = readFileSync(globalsPath, "utf8").split("\n");
const extractStart = lines.findIndex((l) => l.includes(".xy-studio-hub {"));
const extractEnd = lines.findIndex((l) => l.includes("Homepage hub:"));
if (extractStart < 0 || extractEnd < 0) throw new Error("Could not find studio-hub block boundaries");

const commentStart = Math.max(0, extractStart - 1);
const extracted = lines.slice(commentStart, extractEnd).join("\n");
writeFileSync(resolve(root, "components/studio/studio-hub.module.css"), transformCss(extracted).trim() + "\n");

const kept = [...lines.slice(0, commentStart), ...lines.slice(extractEnd)];
writeFileSync(globalsPath, kept.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");

const classMap = {};
for (const file of tsxFiles) {
  const content = readFileSync(resolve(root, file), "utf8");
  const re = /xy-studio-hub(?:--[a-z]+|-[a-z0-9-]+)*|is-[a-z]+/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (!classMap[m[0]]) classMap[m[0]] = globalToLocal(m[0]);
  }
}
classMap[base] = "studioHub";
for (const tone of ["draft", "review", "published", "hidden", "returned", "scheduled"]) {
  classMap[`is-${tone}`] = globalToLocal(`is-${tone}`);
}

function patchFile(file) {
  const filePath = resolve(root, file);
  let out = readFileSync(filePath, "utf8");
  const importPath = file.startsWith("app/") ? "@/components/studio/studio-hub.module.css" : "./studio-hub.module.css";
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

  out = out.replace(/className=\{([^?]+)\s*\?\s*"is-active"\s*:\s*undefined\}/g, "className={$1 ? styles.isActive : undefined}");

  const sorted = Object.keys(classMap).sort((a, b) => b.length - a.length);
  for (const g of sorted) {
    const l = classMap[g];
    out = out.replaceAll(`"${g}"`, `{styles.${l}}`).replaceAll(` ${g}"`, ` {styles.${l}}`);
    out = out.replaceAll(`className="${g}"`, `className={styles.${l}}`);
  }

  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const parts = classes.split(/\s+/).filter(Boolean);
    if (!parts.every((p) => classMap[p] || p === "short" || p.startsWith("animate-"))) {
      if (!parts.some((p) => classMap[p])) return match;
    }
    const mapped = parts.map((p) => {
      if (p === "short") return `"short"`;
      if (classMap[p]) return `styles.${classMap[p]}`;
      return `"${p}"`;
    });
    if (mapped.some((m) => m.startsWith("styles."))) return `className={cn(${mapped.join(", ")})}`;
    return match;
  });

  out = out.replace(/className=\{cn\(([^)]*)\{styles\.(\w+)\}([^)]*)\)\}/g, (m) => m.replace(/\{styles\.(\w+)\}/g, "styles.$1"));

  out = out.replace('className={styles.studioHub}', 'className={styles.studioHub} data-layout="studio-hub"');

  writeFileSync(filePath, out, "utf8");
}

for (const f of tsxFiles) patchFile(f);
console.log("Studio hub migrated", Object.keys(classMap).length, "classes");
