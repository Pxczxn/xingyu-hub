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

function transformCss(css, strips, defaultStrip, rootClass, rootAliases) {
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
    const useClient = out.includes('"use client"');
    if (useClient) {
      const idx = out.indexOf("\n", out.indexOf('"use client"'));
      out =
        out.slice(0, idx + 1) +
        `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` +
        out.slice(idx + 1);
    } else {
      out = `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` + out;
    }
  } else if (!out.includes('import { cn }')) {
    out = out.replace(/import styles from/, 'import { cn } from "@/lib/utils";\nimport styles from');
  }

  out = out.replace(/className=\{([^?]+)\s*\?\s*"is-active"\s*:\s*undefined\}/g, "className={$1 ? styles.isActive : undefined}");
  out = out.replace(/className=\{([^?]+)\s*\?\s*"active"\s*:\s*""\}/g, "className={$1 ? styles.active : undefined}");
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes, classMap);
    return expr ? `className={${expr}}` : match;
  });
  writeFileSync(path, out, "utf8");
}

const MIGRATIONS = [
  {
    name: "guide",
    range: [607, 1106],
    strip: "xy-guide-",
    rootClass: "guideHome",
    rootAliases: {
      "xy-guide-home": "guideHome",
      "xy-guide-detail": "guideDetail",
    },
    module: "app/guide/guide.module.css",
    tsx: ["app/guide/page.tsx", "app/guide/[slug]/page.tsx"],
    importPath: {
      "app/guide/page.tsx": "./guide.module.css",
      "app/guide/[slug]/page.tsx": "./guide.module.css",
    },
  },
  { name: "moment-dead", range: [1106, 1429], deleteOnly: true },
  {
    name: "badges",
    range: [1429, 1528],
    strip: "xy-badges-",
    rootClass: "badgesPage",
    rootAliases: { "xy-badges-page": "badgesPage" },
    module: "app/me/badges/badges.module.css",
    tsx: ["app/me/badges/page.tsx"],
    importPath: { "app/me/badges/page.tsx": "./badges.module.css" },
  },
  { name: "creator-dead", range: [1528, 1674], deleteOnly: true },
  { name: "category-crud-dead", range: [1684, 1738], deleteOnly: true },
  { name: "studio-legacy-dead", range: [1738, 2392], deleteOnly: true },
  {
    name: "studio-workspace",
    range: [2392, 3852],
    strips: ["xy-content-", "xy-editor-"],
    strip: "xy-content-",
    rootClass: "contentManagement",
    rootAliases: {
      "xy-content-management": "contentManagement",
      "xy-editor-page": "editorPage",
    },
    module: "components/studio/studio-workspace.module.css",
    tsx: [
      "app/studio/content/page.tsx",
      "components/studio/article-editor-page.tsx",
      "components/studio/article-editor-body.tsx",
      "components/studio/article-editor-milkdown-body.tsx",
      "components/studio/article-editor-settings.tsx",
      "components/studio/article-editor-markdown-body.tsx",
      "components/studio/article-editor-link-portal.tsx",
      "components/studio/article-editor-link-control.tsx",
      "components/studio/article-editor-link-popover.tsx",
      "components/studio/article-editor-toolbar.tsx",
      "components/studio/article-editor-outline.tsx",
      "components/studio/article-editor-format-bar.tsx",
    ],
    importPath: {
      "app/studio/content/page.tsx": "@/components/studio/studio-workspace.module.css",
      "components/studio/article-editor-page.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-body.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-milkdown-body.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-settings.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-markdown-body.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-link-portal.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-link-control.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-link-popover.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-toolbar.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-outline.tsx": "./studio-workspace.module.css",
      "components/studio/article-editor-format-bar.tsx": "./studio-workspace.module.css",
    },
  },
  {
    name: "series-manager",
    range: [3852, 3854],
    strip: "xy-series-",
    rootClass: "seriesManager",
    rootAliases: { "xy-series-manager": "seriesManager" },
    module: "app/studio/series/series-manager.module.css",
    tsx: ["app/studio/series/page.tsx"],
    importPath: { "app/studio/series/page.tsx": "./series-manager.module.css" },
  },
  { name: "home-welcome-dead", range: [3854, 3888], deleteOnly: true },
];

const globalsPath = resolve(root, "app/globals.css");
let lines = readFileSync(globalsPath, "utf8").split("\n");

const sorted = [...MIGRATIONS].sort((a, b) => b.range[0] - a.range[0]);

for (const mig of sorted) {
  const [start, end] = mig.range;
  if (mig.deleteOnly) {
    lines = [...lines.slice(0, start - 1), ...lines.slice(end - 1)];
    console.log(`DELETE ${mig.name}: L${start}-${end - 1}`);
    continue;
  }

  const extracted = lines.slice(start - 1, end - 1).join("\n");
  const strips = mig.strips || [mig.strip];
  const moduleCss = transformCss(
    extracted,
    strips,
    mig.strip,
    mig.rootClass,
    mig.rootAliases || {},
  );
  const moduleFull = resolve(root, mig.module);
  mkdirSync(dirname(moduleFull), { recursive: true });
  writeFileSync(moduleFull, moduleCss.trim() + "\n", "utf8");
  lines = [...lines.slice(0, start - 1), ...lines.slice(end - 1)];

  const prefixes = strips.map((s) => s.replace(/-$/, ""));
  const classMap = { ...(mig.rootAliases || {}) };
  for (const alias of Object.values(mig.rootAliases || {})) {
    classMap[alias] = alias;
  }
  classMap[mig.strip.replace(/-$/, "")] = mig.rootClass;
  for (const file of mig.tsx) {
    try {
      const content = readFileSync(resolve(root, file), "utf8");
      for (const g of collectClasses(content, prefixes)) {
        const strip = strips.find((s) => g.startsWith(s.replace(/-$/, ""))) || mig.strip;
        classMap[g] = globalToLocal(g, strip, mig.rootClass, mig.rootAliases || {});
      }
    } catch {
      /* skip */
    }
  }
  for (const file of mig.tsx) {
    try {
      patchTsx(file, mig.importPath[file], classMap);
    } catch (e) {
      console.warn("Skip tsx", file, e.message);
    }
  }
  console.log(`OK ${mig.name}: ${mig.module}`);
}

lines = lines.filter((line) => !/xy-home-welcome/.test(line));
lines = lines.filter((line) => !/\.xy-studio \.xy-studio-hero/.test(line));

writeFileSync(globalsPath, lines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
console.log("Done. globals.css lines:", lines.length);
