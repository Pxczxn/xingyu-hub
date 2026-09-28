#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function toCamel(s) {
  return s.split("-").filter(Boolean).map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

function globalToLocal(cls, strip, rootClass) {
  const base = strip.replace(/-$/, "");
  if (cls === base) return rootClass;
  if (cls.startsWith(strip)) {
    let rest = cls.slice(strip.length).replace(/^-+/, "");
    if (rest.includes("--")) {
      const [b, mod] = rest.split("--");
      return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
    }
    return toCamel(rest) || rootClass;
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css, strips, defaultStrip, rootClass) {
  let out = css;
  for (const strip of strips) {
    out = out.replace(new RegExp(`@keyframes ${strip.replace(/-$/, "")}-([a-z0-9-]+)`, "g"), (_, anim) => `@keyframes ${toCamel(anim)}`);
  }
  return out.replace(/\.([a-zA-Z][a-zA-Z0-9-]*)/g, (full, cls) => {
    const strip = strips.find((s) => cls === s.replace(/-$/, "") || cls.startsWith(s)) || defaultStrip;
    const base = strip.replace(/-$/, "");
    if (!cls.startsWith(base) && !cls.startsWith("is-")) return full;
    return "." + globalToLocal(cls, strip, rootClass);
  });
}

const MIGRATIONS = [
  {
    name: "search",
    range: [2783, 3338],
    strip: "xy-search-",
    rootClass: "searchHome",
    module: "app/search/search.module.css",
    tsx: ["app/search/page.tsx"],
    importPath: { "app/search/page.tsx": "./search.module.css" },
  },
  {
    name: "article",
    range: [3338, 4045],
    strip: "xy-article-",
    rootClass: "articlePage",
    module: "app/articles/[articleId]/article-detail.module.css",
    tsx: ["app/articles/[articleId]/page.tsx", "components/community/article-detail-sidebar.tsx"],
    importPath: {
      "app/articles/[articleId]/page.tsx": "./article-detail.module.css",
      "components/community/article-detail-sidebar.tsx": "@/app/articles/[articleId]/article-detail.module.css",
    },
    shellReplace: [".xy-app-content > main.xy-article-page", '.xy-app-content > main[data-layout="article"]'],
  },
  {
    name: "profile",
    range: [4368, 6059],
    strip: "xy-profile-",
    rootClass: "profilePage",
    module: "components/user/user-profile.module.css",
    tsx: ["components/user/user-profile-page.tsx", "components/user/profile-works-section.tsx", "components/user/profile-social-dialog.tsx"],
    importPath: {
      "components/user/user-profile-page.tsx": "./user-profile.module.css",
      "components/user/profile-works-section.tsx": "./user-profile.module.css",
      "components/user/profile-social-dialog.tsx": "./user-profile.module.css",
    },
  },
  {
    name: "browse",
    range: [7020, 10760],
    strips: ["xy-hot-", "xy-rank-", "xy-tag-", "xy-moment-", "xy-topic-", "xy-collection-", "xy-creator-", "xy-space-", "xy-search-"],
    strip: "xy-hot-",
    rootClass: "hotPage",
    module: "components/community/browse-secondary.module.css",
    tsx: [
      "app/rankings/page.tsx",
      "app/moments/page.tsx",
      "app/topics/page.tsx",
      "app/collections/public/page.tsx",
      "app/creators/page.tsx",
      "app/spaces/[spaceSlug]/page.tsx",
      "app/categories/page.tsx",
      "app/features/page.tsx",
      "app/moments/[momentId]/page.tsx",
      "app/topics/[slug]/page.tsx",
    ],
    importPath: {
      "app/rankings/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/moments/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/topics/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/collections/public/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/creators/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/spaces/[spaceSlug]/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/categories/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/features/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/moments/[momentId]/page.tsx": "@/components/community/browse-secondary.module.css",
      "app/topics/[slug]/page.tsx": "@/components/community/browse-secondary.module.css",
    },
  },
  {
    name: "events",
    range: [10760, 13530],
    strip: "xy-event-",
    rootClass: "eventPlaza",
    module: "app/events/events.module.css",
    tsx: [
      "app/events/page.tsx",
      "app/events/[eventId]/page.tsx",
      "app/events/[eventId]/submit/page.tsx",
      "app/events/starry/results/page.tsx",
      "app/events/starry/rankings/page.tsx",
      "app/events/starry/works/page.tsx",
      "app/events/future-book/rules/page.tsx",
      "app/me/events/page.tsx",
    ],
    importPath: {
      "app/events/page.tsx": "./events.module.css",
      "app/events/[eventId]/page.tsx": "./events.module.css",
      "app/events/[eventId]/submit/page.tsx": "../events.module.css",
      "app/events/starry/results/page.tsx": "../../events.module.css",
      "app/events/starry/rankings/page.tsx": "../../events.module.css",
      "app/events/starry/works/page.tsx": "../../events.module.css",
      "app/events/future-book/rules/page.tsx": "../../events.module.css",
      "app/me/events/page.tsx": "@/app/events/events.module.css",
    },
  },
  {
    name: "series",
    range: [607, 1338],
    strip: "xy-series-",
    rootClass: "seriesMarket",
    module: "app/series/series.module.css",
    tsx: ["app/series/page.tsx", "app/series/[seriesId]/page.tsx", "app/series/[seriesId]/read/page.tsx"],
    importPath: {
      "app/series/page.tsx": "./series.module.css",
      "app/series/[seriesId]/page.tsx": "./series.module.css",
      "app/series/[seriesId]/read/page.tsx": "../series.module.css",
    },
  },
  {
    name: "galaxy",
    range: [1338, 2284],
    strip: "xy-galaxy-",
    rootClass: "galaxyHome",
    module: "app/galaxies/galaxies.module.css",
    tsx: ["app/galaxies/page.tsx", "app/galaxies/[slug]/page.tsx", "app/galaxies/[slug]/content/page.tsx"],
    importPath: {
      "app/galaxies/page.tsx": "./galaxies.module.css",
      "app/galaxies/[slug]/page.tsx": "./galaxies.module.css",
      "app/galaxies/[slug]/content/page.tsx": "../galaxies.module.css",
    },
  },
  {
    name: "me",
    range: [15227, 15319],
    strip: "xy-me-",
    rootClass: "mePage",
    module: "components/community/me-prototype.module.css",
    tsx: ["components/community/me-prototype-page.tsx"],
    importPath: { "components/community/me-prototype-page.tsx": "./me-prototype.module.css" },
  },
];

function collectClasses(content, prefixes) {
  const set = new Set();
  for (const prefix of prefixes) {
    const base = prefix.replace(/-$/, "");
    const re = new RegExp(`${base.replace(/-/g, "\\-")}(?:--[a-z]+|-[a-z0-9-]+)*|is-[a-z]+`, "g");
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

function patchTsx(file, importPath, classMap, mig) {
  const path = resolve(root, file);
  let out = readFileSync(path, "utf8");
  const modName = importPath.split("/").pop();
  if (!out.includes(modName)) {
    const idx = out.indexOf("\n", out.indexOf('"use client"'));
    out = out.slice(0, idx + 1) + `import styles from "${importPath}";\nimport { cn } from "@/lib/utils";\n` + out.slice(idx + 1);
  }
  out = out.replace(/className=\{([^?]+)\s*\?\s*"is-active"\s*:\s*undefined\}/g, "className={$1 ? styles.isActive : undefined}");
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes, classMap);
    return expr ? `className={${expr}}` : match;
  });
  if (mig.dataLayout) {
    out = out.replace(`className={styles.${mig.rootClass}}`, `className={styles.${mig.rootClass}} data-layout="${mig.dataLayout}"`);
  }
  writeFileSync(path, out, "utf8");
}

const globalsPath = resolve(root, "app/globals.css");
let lines = readFileSync(globalsPath, "utf8").split("\n");

const sorted = [...MIGRATIONS].sort((a, b) => b.range[0] - a.range[0]);

for (const mig of sorted) {
  const [start, end] = mig.range;
  const extracted = lines.slice(start - 1, end - 1).join("\n");
  const strips = mig.strips || [mig.strip];
  const moduleCss = transformCss(extracted, strips, mig.strip, mig.rootClass);
  const moduleFull = resolve(root, mig.module);
  mkdirSync(dirname(moduleFull), { recursive: true });
  writeFileSync(moduleFull, moduleCss.trim() + "\n", "utf8");
  lines = [...lines.slice(0, start - 1), ...lines.slice(end - 1)];
  if (mig.shellReplace) {
    lines = lines.map((l) => l.replace(mig.shellReplace[0], mig.shellReplace[1]));
  }

  const prefixes = strips.map((s) => s.replace(/-$/, ""));
  const classMap = {};
  classMap[mig.strip.replace(/-$/, "")] = mig.rootClass;
  for (const file of mig.tsx) {
    try {
      const content = readFileSync(resolve(root, file), "utf8");
      for (const g of collectClasses(content, prefixes)) {
        const strip = strips.find((s) => g.startsWith(s.replace(/-$/, ""))) || mig.strip;
        classMap[g] = globalToLocal(g, strip, mig.rootClass);
      }
    } catch {
      /* file may not exist */
    }
  }
  for (const file of mig.tsx) {
    try {
      patchTsx(file, mig.importPath[file], classMap, mig);
    } catch (e) {
      console.warn("Skip tsx", file, e.message);
    }
  }
  console.log(`OK ${mig.name}: ${mig.module}`);
}

writeFileSync(globalsPath, lines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
console.log("Done. globals.css lines:", lines.length);
