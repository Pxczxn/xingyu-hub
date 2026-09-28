#!/usr/bin/env node
/**
 * Migrate xy-* global CSS blocks to a co-located CSS Module.
 * Usage: node scripts/migrate-css-module.mjs --config <json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

function parseArgs() {
  const configIdx = process.argv.indexOf("--config");
  if (configIdx === -1) throw new Error("Usage: --config <json|string>");
  const raw = process.argv[configIdx + 1];
  return typeof raw === "string" && raw.startsWith("{") ? JSON.parse(raw) : JSON.parse(readFileSync(raw, "utf8"));
}

/** xy-home-hub-greeting-title -> greetingTitle when stripPrefix=xy-home-hub- */
function toCamelCase(className, stripPrefixes = []) {
  let name = className;
  for (const p of stripPrefixes.sort((a, b) => b.length - a.length)) {
    if (name.startsWith(p)) {
      name = name.slice(p.length);
      break;
    }
  }
  if (!name) return "root";
  name = name.replace(/^-+/, "");
  if (!name) return "root";
  return name
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

function buildClassMap(prefixes, stripPrefixes, extraGlobals = {}) {
  const map = { ...extraGlobals };
  const globalsPath = resolve(webRoot, "app/globals.css");
  const css = readFileSync(globalsPath, "utf8");
  const classRe = /\.(xy-[a-z0-9-]+)/g;
  let m;
  while ((m = classRe.exec(css)) !== null) {
    const cls = m[1];
    if (!prefixes.some((p) => cls.startsWith(p) || cls === p.replace(/-$/, ""))) continue;
    if (!map[cls]) {
      map[cls] = toCamelCase(cls, stripPrefixes);
    }
  }
  // state modifiers used in TSX
  for (const mod of ["is-collapsed", "is-loading", "is-empty", "is-active"]) {
    const camel = mod.split("-").map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
    map[mod] = camel;
  }
  for (let i = 0; i <= 3; i++) map[`kind-${i}`] = `kind${i}`;
  return map;
}

function transformCss(css, classMap) {
  let out = css;
  const sorted = Object.keys(classMap).sort((a, b) => b.length - a.length);
  for (const global of sorted) {
    const local = classMap[global];
    const escaped = global.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\.${escaped}(?=[\\s,.:{>+~\\[])`, "g"), `.${local}`);
  }
  return out;
}

function transformTsx(content, classMap, importPath) {
  let out = content;
  if (!out.includes(`from "${importPath}"`) && !out.includes(`from '${importPath}'`)) {
    const insertAt = out.indexOf("\n", out.indexOf('"use client"'));
    out = out.slice(0, insertAt + 1) + `import styles from "${importPath}";\n` + out.slice(insertAt + 1);
    if (!out.includes('from "@/lib/utils"')) {
      // cn may already exist
    } else if (!out.includes("cn(") && !out.includes("import { cn }")) {
      // optional
    }
  }

  const sorted = Object.keys(classMap).sort((a, b) => b.length - a.length);

  // Template literals with modifiers: `xy-home-hub-greeting${x ? " is-collapsed" : ""}`
  out = out.replace(
    /className=\{`([^`]+)`\}/g,
    (match, inner) => {
      let replaced = inner;
      for (const global of sorted) {
        const local = classMap[global];
        replaced = replaced.replaceAll(global, `\${styles.${local}}`);
        replaced = replaced.replaceAll(` ${global}`, ` \${styles.${local}}`);
      }
      replaced = replaced.replace(/\$\{styles\.(\w+)\}\$\{styles\.(\w+)\}/g, "${styles.$1} ${styles.$2}");
      // Fix is-collapsed pattern
      replaced = replaced.replace(
        /\$\{styles\.(\w+)\}\$\{([^}]+)\s*\?\s*" is-collapsed"\s*:\s*""\}/g,
        "${styles.$1}${$2 ? ` ${styles.isCollapsed}` : ''}",
      );
      return `className={\`${replaced}\`}`;
    },
  );

  // className="a b c"
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const parts = classes.split(/\s+/).filter(Boolean);
    const mapped = parts.map((p) => {
      if (classMap[p]) return `\${styles.${classMap[p]}}`;
      return p;
    });
    if (mapped.every((p) => p.startsWith("${styles."))) {
      return `className={\`${mapped.join(" ")}\`}`;
    }
    if (mapped.some((p) => p.startsWith("${styles."))) {
      return `className={\`${mapped.join(" ")}\`}`;
    }
    return match;
  });

  // className={condition ? "is-active" : undefined}
  out = out.replace(
    /className=\{([^}]+)\s*\?\s*"([^"]+)"\s*:\s*undefined\}/g,
    (m, cond, cls) => {
      const local = classMap[cls] || cls;
      return `className={${cond} ? styles.${local} : undefined}`;
    },
  );

  return out;
}

function extractCssByPrefixes(css, prefixes) {
  const lines = css.split("\n");
  const kept = [];
  const removed = [];
  let buffer = [];
  let inBlock = false;
  let braceDepth = 0;

  const matchesPrefix = (line) => prefixes.some((p) => line.includes(`.${p}`) || line.includes(`.${p.replace(/-$/, "")}`));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isCommentStart = /^\/\*/.test(line.trim()) && prefixes.some((p) => line.includes(p.split("-")[1] || p));
    if (!inBlock && (matchesPrefix(line) || (line.trim().startsWith("/*") && i + 1 < lines.length && matchesPrefix(lines[i + 1])))) {
      inBlock = true;
      buffer = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && !line.includes("{")) {
        removed.push(line);
        inBlock = false;
        buffer = [];
      }
      continue;
    }
    if (inBlock) {
      buffer.push(line);
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        removed.push(...buffer);
        inBlock = false;
        buffer = [];
      }
      continue;
    }
    kept.push(line);
  }

  return { kept: kept.join("\n"), removed: removed.join("\n") };
}

function extractCssByLineRanges(css, ranges) {
  const lines = css.split("\n");
  const removed = [];
  const removeSet = new Set();
  for (const [start, end] of ranges) {
    for (let i = start - 1; i < end; i++) removeSet.add(i);
  }
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (removeSet.has(i)) removed.push(lines[i]);
    else kept.push(lines[i]);
  }
  return { kept: kept.join("\n"), removed: removed.join("\n") };
}

function main() {
  const config = parseArgs();
  const {
    prefixes = [],
    stripPrefixes = [],
    tsxFiles = [],
    modulePath,
    lineRanges = null,
    extraClassMap = {},
    globalsReplacements = [],
    dryRun = false,
  } = config;

  const globalsPath = resolve(webRoot, "app/globals.css");
  let globalsCss = readFileSync(globalsPath, "utf8");

  const classMap = buildClassMap(prefixes, stripPrefixes, extraClassMap);

  let extracted;
  if (lineRanges) {
    extracted = extractCssByLineRanges(globalsCss, lineRanges);
  } else {
    extracted = extractCssByPrefixes(globalsCss, prefixes);
  }

  const moduleCss = transformCss(extracted.removed, classMap);
  const moduleFull = resolve(webRoot, modulePath);

  if (!dryRun) {
    writeFileSync(moduleFull, moduleCss.trim() + "\n", "utf8");
    let newGlobals = extracted.kept;
    for (const [from, to] of globalsReplacements) {
      newGlobals = newGlobals.replaceAll(from, to);
    }
    writeFileSync(globalsPath, newGlobals, "utf8");

    const importPath = "./" + modulePath.split("/").pop().replace(/\.module\.css$/, ".module.css");
    for (const tsx of tsxFiles) {
      const tsxPath = resolve(webRoot, tsx);
      let content = readFileSync(tsxPath, "utf8");
      const relImport = tsx.includes("/")
        ? "./" + modulePath.split("/").pop()
        : importPath;
      content = transformTsx(content, classMap, relImport);
      writeFileSync(tsxPath, content, "utf8");
    }
  }

  console.log(JSON.stringify({ classMap, modulePath, removedLines: extracted.removed.split("\n").length }, null, 2));
}

main();
