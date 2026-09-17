#!/usr/bin/env node
/**
 * Migrate a globals.css block (by line range) to a shared CSS Module.
 * node scripts/migrate-prefix.mjs --prefix xy-studio-hub --strip xy-studio-hub- --module components/studio/studio-hub.module.css --lines 15893-17033 --tsx app/studio/page.tsx,components/studio/studio-hub-hero.tsx
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const get = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : null;
  };
  const lines = get("--lines");
  const [start, end] = lines.split("-").map(Number);
  return {
    prefix: get("--prefix"),
    strip: get("--strip") || get("--prefix") + "-",
    modulePath: get("--module"),
    lineStart: start,
    lineEnd: end,
    tsxFiles: get("--tsx").split(",").map((s) => s.trim()),
    rootClass: get("--root-class") || null,
    dataLayout: get("--data-layout") || null,
  };
}

function toCamel(s) {
  return s
    .split("-")
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function globalToLocal(cls, strip, rootClass) {
  if (cls === strip.replace(/-$/, "")) return rootClass || "root";
  if (cls.startsWith(strip)) {
    let rest = cls.slice(strip.length);
    rest = rest.replace(/^-+/, "");
    if (rest.includes("--")) {
      const [base, mod] = rest.split("--");
      return toCamel(base) + mod.charAt(0).toUpperCase() + mod.slice(1);
    }
    return toCamel(rest) || (rootClass || "root");
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  if (cls.startsWith("kind-")) return "kind" + cls.slice(-1);
  return cls;
}

function transformCss(css, strip, rootClass) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9-]*)/g, (full, cls) => {
    if (!cls.startsWith("xy-") && !cls.startsWith("is-") && !cls.startsWith("kind-")) return full;
    if (cls.startsWith("xy-") && !cls.startsWith(strip.replace(/-$/, "")) && cls !== strip.replace(/-$/, "")) {
      // only transform classes matching our prefix
      const base = strip.replace(/-$/, "");
      if (!cls.startsWith(base)) return full;
    }
    return "." + globalToLocal(cls, strip, rootClass);
  }).replace(/@keyframes xy-[a-z0-9-]+/g, (m) => {
    const name = m.replace("@keyframes ", "");
    return `@keyframes ${globalToLocal(name, strip, rootClass)}`;
  }).replace(/animation:\s*([a-zA-Z][a-zA-Z0-9-]*)/g, (m, anim) => {
    if (!anim.startsWith("xy-")) return m;
    return `animation: ${globalToLocal(anim, strip, rootClass)}`;
  });
}

function collectClassesFromFiles(tsxFiles, strip) {
  const map = {};
  const base = strip.replace(/-$/, "");
  for (const file of tsxFiles) {
    const content = readFileSync(resolve(root, file), "utf8");
    const re = new RegExp(`${base.replace(/-/g, "\\-")}(?:\\-\\-[a-z]+|-[a-z0-9-]+)*|is-[a-z]+`, "g");
    let m;
    while ((m = re.exec(content)) !== null) {
      const g = m[0];
      if (!map[g]) map[g] = globalToLocal(g, strip, parseArgs().rootClass);
    }
  }
  return map;
}

function patchTsxFile(filePath, modulePath, classMap, strip, opts) {
  let out = readFileSync(filePath, "utf8");
  const relDir = dirname(filePath);
  const moduleFull = resolve(root, modulePath);
  let importPath = relative(relDir, moduleFull).replace(/\\/g, "/");
  if (!importPath.startsWith(".")) importPath = "./" + importPath;
  const importLine = `import styles from "${importPath}";\n`;
  if (!out.includes(importPath)) {
    const idx = out.indexOf("\n", out.indexOf('"use client"'));
    out = out.slice(0, idx + 1) + importLine + out.slice(idx + 1);
  }
  if (!out.includes('from "@/lib/utils"') && out.includes("cn(")) {
    // ok
  } else if (!out.includes("import { cn }") && out.match(/cn\(/)) {
    out = out.replace(importLine, importLine + 'import { cn } from "@/lib/utils";\n');
  } else if (!out.includes("cn(")) {
    // will add cn only if needed
  }

  const sorted = Object.keys(classMap).sort((a, b) => b.length - a.length);

  // template literals with modifiers
  const base = strip.replace(/-$/, "");
  out = out.replace(
    new RegExp(`className=\\{\`${base}([^$]*)\$\{([^}]+)\\s*\\?\\s*" ([^"]+)"\\s*:\\s*""\\}\`\\}`, "g"),
    (match, middle, cond, mod) => {
      const modLocal = classMap[mod.trim()] || globalToLocal(mod.trim(), strip, opts.rootClass);
      return `className={cn(styles.${classMap[base] || opts.rootClass || "root"}${middle ? `, ...` : ""})}`;
    },
  );

  // `prefix-hero${x ? " is-collapsed" : ""}`
  out = out.replace(
    new RegExp(`className=\\{\`${base.replace(/-/g, "\\-")}([^$]*?)\\$\{([^}]+)\\s*\\?\\s*" (is-[a-z-]+)"\\s*:\\s*""\\}\`\\}`, "g"),
    (match, suffix, cond, mod) => {
      const baseLocal = globalToLocal(base + suffix.replace(/-/g, ""), strip, opts.rootClass);
      // simpler: match known patterns
      return match;
    },
  );

  for (const global of sorted) {
    const local = classMap[global];
    // multi-class
    out = out.replace(new RegExp(`className="([^"]*\\b${global}\\b[^"]*)"`, "g"), (match, classes) => {
      const parts = classes.split(/\s+/).filter(Boolean);
      const mapped = parts.map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`));
      return `className={cn(${mapped.join(", ")})}`;
    });
    out = out.replaceAll(`className="${global}"`, `className={styles.${local}}`);
  }

  // Fix patterns like `xy-studio-hub-status is-draft`
  out = out.replace(/className=\{cn\(([^)]+)\)\}/g, (m, inner) => m);
  out = out.replace(
    /className="([^"]+)"/g,
    (match, classes) => {
      const parts = classes.split(/\s+/).filter(Boolean);
      if (!parts.some((p) => classMap[p])) return match;
      const mapped = parts.map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`));
      return `className={cn(${mapped.join(", ")})}`;
    },
  );

  // is-active ternary
  out = out.replace(
    /className=\{([^?]+)\s*\?\s*"is-active"\s*:\s*undefined\}/g,
    "className={$1 ? styles.isActive : undefined}",
  );

  if (opts.dataLayout && out.includes(`className={styles.${opts.rootClass || "root"}}`)) {
    out = out.replace(
      `className={styles.${opts.rootClass || "root"}}`,
      `className={styles.${opts.rootClass || "root"}} data-layout="${opts.dataLayout}"`,
    );
  }

  if (!out.includes("cn(") && out.includes("{cn(")) {
    // fine
  } else if (out.includes("cn(") && !out.includes('import { cn }')) {
    const firstImport = out.indexOf('import ');
    out = 'import { cn } from "@/lib/utils";\n' + out;
  }

  writeFileSync(filePath, out, "utf8");
}

function main() {
  const opts = parseArgs();
  const globalsPath = resolve(root, "app/globals.css");
  const lines = readFileSync(globalsPath, "utf8").split("\n");
  const extracted = lines.slice(opts.lineStart - 1, opts.lineEnd).join("\n");
  const moduleCss = transformCss(extracted, opts.strip, opts.rootClass);
  writeFileSync(resolve(root, opts.modulePath), moduleCss.trim() + "\n", "utf8");

  const kept = [...lines.slice(0, opts.lineStart - 1), ...lines.slice(opts.lineEnd)];
  writeFileSync(globalsPath, kept.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");

  const classMap = collectClassesFromFiles(opts.tsxFiles, opts.strip);
  if (opts.rootClass) {
    classMap[opts.strip.replace(/-$/, "")] = opts.rootClass;
  }

  for (const file of opts.tsxFiles) {
    patchTsxFile(resolve(root, file), opts.modulePath, classMap, opts.strip, opts);
  }

  console.log("Migrated", opts.prefix, "->", opts.modulePath, Object.keys(classMap).length, "classes");
}

main();
