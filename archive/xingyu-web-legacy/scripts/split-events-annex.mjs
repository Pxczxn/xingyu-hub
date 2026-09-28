#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

function normalizeRest(rest) {
  if (rest.includes("__")) {
    const [block, ...elements] = rest.split("__");
    return toCamel(block) + elements.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join("");
  }
  if (rest.includes("--")) {
    const [b, mod] = rest.split("--");
    return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
  }
  return toCamel(rest);
}

function globalToLocal(cls, strip, rootClass, rootAliases = {}) {
  if (rootAliases[cls]) return rootAliases[cls];
  const base = strip.replace(/-$/, "");
  if (cls === base) return rootClass;
  if (cls.startsWith(strip)) {
    const rest = cls.slice(strip.length).replace(/^-+/, "");
    return normalizeRest(rest) || rootClass;
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css, strips, defaultStrip, rootClass, rootAliases = {}) {
  let out = css;
  for (const strip of strips) {
    out = out.replace(
      new RegExp(`@keyframes ${strip.replace(/-$/, "")}-([a-z0-9-]+)`, "g"),
      (_, anim) => `@keyframes ${toCamel(anim)}`,
    );
  }
  return out.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
    const strip =
      strips.find((s) => {
        const base = s.replace(/-$/, "");
        return cls === base || cls.startsWith(s);
      }) || defaultStrip;
    const base = strip.replace(/-$/, "");
    if (!cls.startsWith(base) && !cls.startsWith("is-")) return full;
    return "." + globalToLocal(cls, strip, rootClass, rootAliases);
  });
}

function collectClasses(content, prefixes) {
  const set = new Set();
  for (const prefix of prefixes) {
    const base = prefix.replace(/-$/, "");
    const re = new RegExp(
      `${base.replace(/-/g, "\\-")}(?:__[a-z0-9-]+|--[a-z]+|-[a-z0-9-]+)*|is-[a-z]+`,
      "g",
    );
    let m;
    while ((m = re.exec(content)) !== null) set.add(m[0]);
  }
  return set;
}

function mapClassString(classes, classMap) {
  const parts = classes.split(/\s+/).filter(Boolean);
  if (!parts.some((p) => classMap[p])) return null;
  return `cn(${parts.map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`)).join(", ")})`;
}

function patchTsx(file, importPath, classMap) {
  const path = resolve(root, file);
  let out = readFileSync(path, "utf8");
  const modName = importPath.split("/").pop();
  if (!out.includes(modName)) {
    const idx = out.indexOf("\n", out.indexOf('"use client"'));
    out =
      out.slice(0, idx + 1) +
      `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` +
      out.slice(idx + 1);
  } else if (!out.includes('import { cn }')) {
    out = out.replace(/import styles from/, 'import { cn } from "@/lib/utils";\nimport styles from');
  }
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes, classMap);
    return expr ? `className={${expr}}` : match;
  });
  out = out.replace(/className=\{([^?]+)\s*\?\s*"active"\s*:\s*""\}/g, "className={$1 ? styles.active : undefined}");
  out = out.replace(/className=\{([^?]+)\s*\?\s*"compact"\s*:\s*""\}/g, "className={$1 ? styles.compact : undefined}");
  out = out.replace(
    /className=\{`xy-event-section \$\{compact\?'compact':''\}`\}/g,
    "className={cn(styles.eventSection, compact && styles.compact)}",
  );
  writeFileSync(path, out, "utf8");
}

const eventsPath = resolve(root, "app/events/events.module.css");
const lines = readFileSync(eventsPath, "utf8").split("\n");
const annexStart = lines.findIndex((l) => /\.xy-announcement-real\b/.test(l));
if (annexStart < 0) {
  console.log("No annex found");
  process.exit(0);
}

const annexLines = lines.slice(annexStart);
const findIdx = (pattern) => annexLines.findIndex((l) => pattern.test(l));

const blocks = [
  {
    name: "announcements",
    start: findIdx(/\.xy-announcement-real\b/),
    end: findIdx(/\.xy-moment-compose\b/),
    strip: "xy-announcement-real-",
    strips: ["xy-announcement-real-"],
    rootClass: "announcementReal",
    rootAliases: { "xy-announcement-real": "announcementReal" },
    module: "app/announcements/announcements.module.css",
    tsx: ["app/announcements/page.tsx"],
    importPath: { "app/announcements/page.tsx": "./announcements.module.css" },
  },
  {
    name: "moment-compose",
    start: findIdx(/\.xy-moment-compose\b/),
    end: findIdx(/\.xy-my-events\b/),
    strip: "xy-compose-",
    strips: ["xy-moment-compose", "xy-compose-", "xy-preview-", "xy-upload-", "xy-more-"],
    rootClass: "momentCompose",
    rootAliases: { "xy-moment-compose": "momentCompose" },
    module: "app/studio/moments/new/moment-compose.module.css",
    tsx: ["app/studio/moments/new/page.tsx"],
    importPath: { "app/studio/moments/new/page.tsx": "./moment-compose.module.css" },
  },
  {
    name: "my-events",
    start: findIdx(/\.xy-my-events\b/),
    end: findIdx(/\.works\{max-width:1290px/),
    strip: "xy-my-events-",
    strips: ["xy-my-events-", "xy-events-", "xy-event-", "xy-progress-"],
    rootClass: "myEvents",
    rootAliases: { "xy-my-events": "myEvents", "xy-events-end": "eventsEnd", "xy-events-more": "eventsMore" },
    module: "app/me/events/my-events.module.css",
    tsx: ["app/me/events/page.tsx"],
    importPath: { "app/me/events/page.tsx": "./my-events.module.css" },
    keepGeneric: ["progress", "section", "wideCard", "image", "complete"],
  },
];

let eventsBody = lines.slice(0, annexStart);

for (const block of blocks) {
  const extracted = annexLines.slice(block.start, block.end).join("\n");
  const moduleCss = transformCss(
    extracted,
    block.strips || [block.strip],
    block.strip,
    block.rootClass,
    block.rootAliases,
  );
  const moduleFull = resolve(root, block.module);
  mkdirSync(dirname(moduleFull), { recursive: true });
  writeFileSync(moduleFull, moduleCss.trim() + "\n", "utf8");

  const prefixes = (block.strips || [block.strip]).map((s) => s.replace(/-$/, ""));
  const classMap = { ...block.rootAliases };
  for (const file of block.tsx) {
    const content = readFileSync(resolve(root, file), "utf8");
    for (const g of collectClasses(content, prefixes)) {
      const strip = (block.strips || [block.strip]).find((s) => g.startsWith(s.replace(/-$/, ""))) || block.strip;
      classMap[g] = globalToLocal(g, strip, block.rootClass, block.rootAliases);
    }
    if (block.keepGeneric) {
      for (const g of block.keepGeneric) classMap[g] = g;
    }
  }
  for (const file of block.tsx) {
    patchTsx(file, block.importPath[file], classMap);
  }
  console.log(`OK ${block.name}: ${block.module}`);
}

const worksStart = findIdx(/\.works\{max-width:1290px/);
const deadStart = annexLines.findIndex((l) => /\.xy-published\b/.test(l));
const keepAnnex = annexLines.slice(worksStart, deadStart >= 0 ? deadStart : undefined).join("\n");
writeFileSync(eventsPath, [...eventsBody, keepAnnex.trim()].filter(Boolean).join("\n") + "\n", "utf8");
console.log("Trimmed events.module.css, kept works annex");
