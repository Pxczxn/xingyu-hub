#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const globalsPath = resolve(root, "app/globals.css");
const tsxPath = resolve(root, "components/community/home-page.tsx");
const modulePath = resolve(root, "components/community/home-page.module.css");

function toCamel(s) {
  return s
    .split("-")
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function globalToLocal(cls) {
  if (cls === "xy-home-hub") return "homeHub";
  if (cls.startsWith("xy-home-hub-thumb--")) return "thumb" + cls.slice(-2).toUpperCase();
  if (cls.startsWith("xy-home-hub-")) return toCamel(cls.slice("xy-home-hub-".length));
  if (cls.startsWith("xy-greeting-")) return toCamel(cls.slice("xy-greeting-".length));
  if (cls.startsWith("xy-username-chip")) return cls === "xy-username-chip" ? "usernameChip" : "usernameChipAt";
  if (cls === "is-collapsed") return "isCollapsed";
  if (cls === "is-loading") return "isLoading";
  if (cls === "is-empty") return "isEmpty";
  if (cls === "is-active") return "isActive";
  if (/^kind-[0-3]$/.test(cls)) return "kind" + cls.slice(-1);
  return cls;
}

function transformCss(css) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9-]*)/g, (full, cls) => {
    if (
      !cls.startsWith("xy-") &&
      !["is-collapsed", "is-loading", "is-empty", "is-active"].includes(cls) &&
      !/^kind-[0-3]$/.test(cls)
    ) {
      return full;
    }
    return "." + globalToLocal(cls);
  });
}

function buildClassMapFromTsx(tsx) {
  const map = {};
  const re = /xy-[a-z0-9-]+|is-collapsed|is-loading|is-empty|is-active|kind-[0-3]/g;
  let m;
  while ((m = re.exec(tsx)) !== null) {
    const g = m[0];
    if (!map[g]) map[g] = globalToLocal(g);
  }
  // thumb sizes from template
  for (const size of ["sm", "md", "lg"]) {
    map[`xy-home-hub-thumb--${size}`] = "thumb" + size.toUpperCase();
  }
  return map;
}

function patchTsx(tsx, classMap) {
  let out = tsx;
  if (!out.includes('import styles from "./home-page.module.css"')) {
    out = out.replace(
      '"use client";\n',
      '"use client";\n\nimport styles from "./home-page.module.css";\nimport { cn } from "@/lib/utils";\n',
    );
  }

  // thumb template
  out = out.replace(
    'className={`xy-home-hub-thumb xy-home-hub-thumb--${size}`}',
    'className={cn(styles.thumb, size === "sm" ? styles.thumbSm : size === "lg" ? styles.thumbLg : styles.thumbMd)}',
  );

  // greeting collapsed
  out = out.replace(
    'className={`xy-home-hub-greeting${greetingCollapsed ? " is-collapsed" : ""}`}',
    'className={cn(styles.greeting, greetingCollapsed && styles.isCollapsed)}',
  );

  // tab active
  out = out.replace(
    /className=\{shortcutTab === "galaxy" \? "is-active" : undefined\}/g,
    'className={shortcutTab === "galaxy" ? styles.isActive : undefined}',
  );
  out = out.replace(
    /className=\{shortcutTab === "series" \? "is-active" : undefined\}/g,
    'className={shortcutTab === "series" ? styles.isActive : undefined}',
  );

  // continue icon kind
  out = out.replace(
    'className="xy-home-hub-continue-icon kind-0"',
    'className={cn(styles.continueIcon, styles.kind0)}',
  );

  const sorted = Object.keys(classMap)
    .filter((k) => !k.includes("${"))
    .sort((a, b) => b.length - a.length);

  for (const global of sorted) {
    const local = classMap[global];
    out = out.replaceAll(`className="${global}"`, `className={styles.${local}}`);
    out = out.replaceAll(`"${global} `, `{styles.${local}} `);
    out = out.replaceAll(` ${global}"`, ` {styles.${local}}`);
  }

  // multi-class strings
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const parts = classes.split(/\s+/).filter(Boolean);
    if (!parts.every((p) => classMap[p] || p.startsWith("animate-"))) return match;
    const expr = parts
      .map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`))
      .join(", ");
    return `className={cn(${expr})}`;
  });

  // main root + data-layout
  out = out.replace(
    '<main className={styles.homeHub} aria-busy={loading}>',
    '<main className={styles.homeHub} data-layout="home-hub" aria-busy={loading}>',
  );

  return out;
}

const lines = readFileSync(globalsPath, "utf8").split("\n");
const extractRanges = [
  [6507, 6558],
  [17091, 17936],
];
const mobileGreetingLines = [15797, 15798];

const extracted = [];
const removeSet = new Set();
for (const [s, e] of extractRanges) {
  for (let i = s - 1; i < e; i++) {
    removeSet.add(i);
    extracted.push(lines[i]);
  }
}
// mobile greeting rules go into module too
for (const i of mobileGreetingLines) {
  removeSet.add(i - 1);
  extracted.push(lines[i - 1]);
}

const rawCss = extracted.join("\n");
const moduleCss = transformCss(rawCss);
writeFileSync(modulePath, moduleCss.trim() + "\n", "utf8");

const kept = lines.filter((_, i) => !removeSet.has(i));
// clean empty media block if only greeting rules were removed
let globalsOut = kept.join("\n");
globalsOut = globalsOut.replace(
  /@media \(max-width: 760px\) \{\s*\}/g,
  "",
);
writeFileSync(globalsPath, globalsOut, "utf8");

let tsx = readFileSync(tsxPath, "utf8");
const classMap = buildClassMapFromTsx(tsx);
tsx = patchTsx(tsx, classMap);
writeFileSync(tsxPath, tsx, "utf8");

console.log("Home page migration done.", Object.keys(classMap).length, "classes");
