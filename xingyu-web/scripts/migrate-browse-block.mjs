#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const blockName = process.argv[2];
if (!blockName) {
  console.error("Usage: node migrate-browse-block.mjs <block-name>");
  process.exit(1);
}

const BLOCKS = {
  "moments-feed": {
    start: (l) => l.startsWith(".xy-feed-page {"),
    end: (l) => l.startsWith(".xy-public-collections {"),
    strip: "xy-feed-",
    rootClass: "feedPage",
    rootAliases: { "xy-feed-page": "feedPage" },
    module: "app/moments/moments-feed.module.css",
    tsx: "app/moments/page.tsx",
    importPath: "./moments-feed.module.css",
    dataLayout: "moments-feed",
    extraCss: `
.feedLoading { display: grid; gap: 1rem; padding-top: 1rem; }
.feedLoading span { display: block; height: 150px; border-radius: 1.25rem; border: 1px solid rgb(222 226 235 / .8); background: linear-gradient(135deg,#f1f3f8,#fff); animation: feedPulse 1.5s ease-in-out infinite alternate; }
.feedLoading span:first-child { height: 210px; }
@keyframes feedPulse { from { opacity: .58; } to { opacity: 1; } }
:global(.xy-nav-moments) .main { border-left: 1px solid rgb(93 108 145 / .15); padding-left: clamp(1rem, 3vw, 3rem); }
@media (max-width: 1180px) {
  .feedPage { grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; }
}
@media (max-width: 900px) {
  :global(.xy-nav-moments) .main { border-left: 0; padding-left: 0; }
}
@media (max-width: 760px) {
  .feedPage { grid-template-columns: 1fr; width: min(100% - 20px, 1166px); }
  .side { grid-row: 1; }
  .entry { grid-template-columns: 1fr; }
  .entry > time { display: none; }
}
`,
    globalsRemove: [
      /\.xy-nav-moments \.xy-feed-page[^\n]*\n/g,
      /\.xy-nav-moments \.xy-feed-main[^\n]*\n/g,
      /\.xy-feed-loading[^\n]*\n/g,
    ],
    browseMediaRemove: [
      /  \.xy-feed-page \{[\s\S]*?\}\n/g,
      /  \.xy-feed-side \{[\s\S]*?\}\n/g,
      /  \.xy-feed-entry \{[\s\S]*?\}\n/g,
      /  \.xy-feed-entry > time \{[\s\S]*?\}\n/g,
    ],
  },
  "public-collections": {
    start: (l) => l.startsWith(".xy-public-collections {"),
    end: (l) => l.startsWith(".detail {"),
    strip: "xy-public-",
    rootClass: "collectionsPage",
    rootAliases: { "xy-public-collections": "collectionsPage" },
    module: "app/collections/public/public-collections.module.css",
    tsx: "app/collections/public/page.tsx",
    importPath: "./public-collections.module.css",
    dataLayout: "public-collections",
    extraCss: `
@media (max-width: 1180px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
  .stats { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 760px) {
  .collectionsPage { grid-template-columns: 1fr; }
  .rail { display: none; }
  .content { padding: 20px 12px; }
  .profile { grid-template-columns: 90px 1fr; }
  .profile > img { width: 90px; height: 90px; }
  .avatarFallback { width: 90px; height: 90px; font-size: 28px; }
  .profile blockquote { display: none; }
  .stats { grid-template-columns: 1fr 1fr; }
  .grid { grid-template-columns: 1fr; }
}
`,
    browseMediaRemove: [
      /  \.xy-public-grid \{[\s\S]*?\}\n/g,
      /  \.xy-public-stats \{[\s\S]*?\}\n/g,
      /  \.xy-public-collections \{[\s\S]*?\}\n/g,
      /  \.rail,\n/g,
      /  \.xy-public-content \{[\s\S]*?\}\n/g,
      /  \.xy-public-profile \{[\s\S]*?\}\n/g,
      /  \.xy-public-profile > img \{[\s\S]*?\}\n/g,
      /  \.xy-public-avatar-fallback \{[\s\S]*?\}\n/g,
      /  \.xy-public-profile blockquote \{[\s\S]*?\}\n/g,
      /  \.xy-public-stats \{[\s\S]*?\}\n/g,
      /  \.xy-public-grid \{[\s\S]*?\}\n/g,
    ],
  },
  rankings: {
    start: (l, i, lines) =>
      l.startsWith(".page {") &&
      lines.slice(i, i + 5).join("\n").includes("grid-template-columns: 216px"),
    end: (l) => l.startsWith(".xy-creators-page {"),
    strips: [],
    rootClass: "page",
    rootAliases: {},
    module: "app/rankings/rankings.module.css",
    tsx: "app/rankings/page.tsx",
    importPath: "./rankings.module.css",
    dataLayout: "rankings",
    extraCss: `
.boardEmpty { padding: 12px 0; color: #71809a; font-size: 12px; }
@media (max-width: 1200px) {
  .page { grid-template-columns: 180px 1fr; }
}
@media (max-width: 760px) {
  .page { display: block; }
  .content { padding: 15px; }
  .grid { grid-template-columns: 1fr; }
  .quote { width: 100%; }
  .content > header nav { width: 100%; }
}
`,
    browseMediaRemove: [
      /  \.page,\n  \.page,\n  \.xy-creators-page \{\n    grid-template-columns: 180px 1fr;\n  \}\n/g,
      /  \.page \{\n    grid-template-columns: 180px 1fr;\n  \}\n/g,
      /  \.page,\n  \.page,\n  \.xy-creators-page \{\n    display: block;\n  \}\n/g,
      /  \.grid,\n  \.xy-author-grid \{\n    grid-template-columns: 1fr;\n  \}\n/g,
      /  \.quote \{\n    width: 100%;\n  \}\n/g,
      /  \.content > header nav \{\n    width: 100%;\n  \}\n/g,
    ],
  },
  spaces: {
    start: (l, i, lines) =>
      l.startsWith(".page {") &&
      lines.slice(i, i + 4).join("\n").includes("100% - 60px"),
    end: (l) => l.startsWith(".plaza {"),
    strips: [],
    rootClass: "page",
    rootAliases: {},
    module: "app/spaces/[spaceSlug]/space.module.css",
    tsx: "app/spaces/[spaceSlug]/page.tsx",
    importPath: "./space.module.css",
    dataLayout: "creation-space",
    extraCss: "",
    browseMediaRemove: [],
  },
  creators: {
    start: (l) => l.startsWith(".xy-creators-page {"),
    end: (l, i, lines) =>
      l.startsWith("@media (max-width: 1200px)") &&
      (lines[i - 2] || "").includes("620px"),
    strips: ["xy-creators-", "xy-author-"],
    rootClass: "creatorsPage",
    rootAliases: { "xy-creators-page": "creatorsPage", "xy-creators-real": "real" },
    module: "app/creators/creators.module.css",
    tsx: "app/creators/page.tsx",
    importPath: "./creators.module.css",
    dataLayout: "creators",
    extraCss: `
@media (max-width: 900px) {
  .real { width: min(100% - 28px, 1476px); }
  .real .layout { grid-template-columns: 1fr; }
  .real .authorGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .real .side { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .real .filters label { margin-left: 0; }
}
@media (max-width: 620px) {
  .real .authorGrid,
  .real .side { grid-template-columns: 1fr; }
  .real .filters label { width: 100%; min-width: 0; }
  .real .filters input { width: 100%; }
}
@media (max-width: 1200px) {
  .creatorsPage { grid-template-columns: 180px 1fr; }
  .layout { grid-template-columns: 1fr; }
  .side { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .creatorsPage { display: block; }
  .rail { display: none; }
  .content { padding: 15px; }
  .authorGrid { grid-template-columns: 1fr; }
  .side { grid-column: auto; grid-template-columns: 1fr; margin-top: 15px; }
  .filters { overflow: auto; }
  .filters label { display: none; }
}
`,
    browseMediaRemove: [
      /  \.xy-creators-layout \{\n    grid-template-columns: 1fr;\n  \}\n/g,
      /  \.xy-creators-side \{\n    grid-template-columns: 1fr 1fr;\n  \}\n/g,
      /  \.xy-creators-rail \{\n    display: none;\n  \}\n/g,
      /  \.xy-creators-content \{\n    padding: 15px;\n  \}\n/g,
      /  \.xy-creators-side \{\n    grid-column: auto;\n    grid-template-columns: 1fr;\n    margin-top: 15px;\n  \}\n/g,
    ],
  },
  features: {
    start: (l) => l.startsWith(".xy-feature-page {"),
    end: (l, i, lines) =>
      l.startsWith(".page {") &&
      lines.slice(i, i + 6).join("\n").includes("grid-template-columns: 192px"),
    strip: "xy-feature-",
    rootClass: "featurePage",
    rootAliases: { "xy-feature-page": "featurePage" },
    module: "app/features/features.module.css",
    tsx: "app/features/page.tsx",
    importPath: "./features.module.css",
    dataLayout: "features",
    extraCss: `
@media (min-width: 1100px) {
  .featurePage { padding-top: 20px; }
  .featurePage section { gap: 12px; }
  .hero { min-height: 330px; }
}
@media (max-width: 1200px) {
  .featurePage { grid-template-columns: 180px 1fr; }
  .grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .featurePage { display: block; }
  .rail { display: none; }
  .content { padding: 15px; }
  .hero > div { inset: 24px; }
  .hero > img { width: 100%; opacity: 0.4; }
  .picks > div,
  .curators > div { grid-template-columns: 1fr; }
  .grid { display: block; }
}
`,
    globalsRemove: [
      /  \.xy-feature-page, \.xy-hot-page[^\n]*\n/g,
      /  \.xy-feature-hero \{[^\n]*\n/g,
      /  \.xy-feature-page section[^\n]*\n/g,
    ],
    globalsReplace: [
      [/  \.xy-feature-page, \.xy-hot-page/g, "  .xy-hot-page"],
      [/  \.xy-feature-page section, \.xy-hot-page/g, "  .xy-hot-page"],
    ],
    browseMediaRemove: [
      /  \.xy-feature-page,\n/g,
      /  \.xy-feature-grid \{[\s\S]*?\}\n/g,
      /  \.xy-feature-rail,\n/g,
      /  \.xy-feature-content,\n/g,
      /  \.xy-feature-hero > div \{[\s\S]*?\}\n/g,
      /  \.xy-feature-hero > img \{[\s\S]*?\}\n/g,
      /  \.xy-feature-picks > div,\n/g,
      /  \.xy-feature-curators > div,\n/g,
      /  \.xy-feature-grid \{[\s\S]*?\}\n/g,
    ],
  },
};

function toCamel(s) {
  return s
    .split("-")
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function globalToLocal(cls, strip, rootClass, rootAliases = {}) {
  if (rootAliases[cls]) return rootAliases[cls];
  const base = strip.replace(/-$/, "");
  if (cls === base) return rootClass;
  if (cls.startsWith(strip)) {
    const rest = cls.slice(strip.length).replace(/^-+/, "");
    if (rest.includes("--")) {
      const [b, mod] = rest.split("--");
      return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
    }
    return toCamel(rest) || rootClass;
  }
  if (cls === "active") return "active";
  return cls;
}

function getStrips(cfg) {
  if (cfg.strips) return cfg.strips;
  if (cfg.strip) return [cfg.strip];
  return [];
}

function transformCss(css, strips, rootClass, rootAliases) {
  if (!strips.length) return css;
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
    for (const strip of strips) {
      const base = strip.replace(/-$/, "");
      if (cls === base || cls.startsWith(strip) || cls.startsWith(`${base}-`)) {
        return "." + globalToLocal(cls, strip, rootClass, rootAliases);
      }
    }
    return full;
  });
}

function buildClassMap(content, strips, rootClass, rootAliases) {
  const map = { ...rootAliases, active: "active" };
  for (const strip of strips) {
    const base = strip.replace(/-$/, "");
    const re = new RegExp(
      `${base.replace(/-/g, "\\-")}(?:__[a-z0-9-]+|--[a-z0-9-]+|-[a-z0-9-]+)*`,
      "g",
    );
    let m;
    while ((m = re.exec(content)) !== null) {
      map[m[0]] = globalToLocal(m[0], strip, rootClass, rootAliases);
    }
  }
  if (content.includes("active")) map.active = "active";
  return map;
}

function patchClassString(classes, map) {
  const parts = classes.split(/\s+/).filter(Boolean);
  if (!parts.some((p) => map[p])) return null;
  return `cn(${parts.map((p) => (map[p] ? `styles.${map[p]}` : `"${p}"`)).join(", ")})`;
}

const cfg = BLOCKS[blockName];
const browsePath = resolve(root, "components/community/browse-secondary.module.css");
let browseCss = readFileSync(browsePath, "utf8");
const browseLines = browseCss.split("\n");
const start = browseLines.findIndex(cfg.start);
const end = browseLines.findIndex((l, i) => i > start && cfg.end(l, i, browseLines));
if (start < 0 || end < 0) {
  console.error("Block not found", start, end);
  process.exit(1);
}

const extracted = browseLines.slice(start, end).join("\n");
const strips = getStrips(cfg);
const moduleCss =
  transformCss(extracted, strips, cfg.rootClass, cfg.rootAliases).trim() +
  "\n" +
  cfg.extraCss.trim() +
  "\n";
const moduleFull = resolve(root, cfg.module);
mkdirSync(dirname(moduleFull), { recursive: true });
writeFileSync(moduleFull, moduleCss, "utf8");
browseCss = [...browseLines.slice(0, start), ...browseLines.slice(end)].join("\n");
for (const re of cfg.browseMediaRemove || []) {
  browseCss = browseCss.replace(re, "");
}
writeFileSync(browsePath, browseCss.replace(/\n{3,}/g, "\n\n"), "utf8");

const tsxPath = resolve(root, cfg.tsx);
let page = readFileSync(tsxPath, "utf8");
const classMap = buildClassMap(page, strips, cfg.rootClass, cfg.rootAliases);
page = page.replace(
  /import styles from "@\/components\/community\/browse-secondary\.module\.css";/,
  `import styles from "${cfg.importPath}";`,
);
if (!page.includes('import { cn }')) {
  page = page.replace(/import styles/, 'import { cn } from "@/lib/utils";\nimport styles');
}
page = page.replace(/className="([^"]+)"/g, (match, classes) => {
  const expr = patchClassString(classes, classMap);
  return expr ? `className={${expr}}` : match;
});
page = page.replace(
  /className=\{`([^`]+)`\}/g,
  (match, template) => {
    const staticParts = template.replace(/\$\{[^}]+\}/g, "%%");
    const staticMap = buildClassMap(staticParts, strips, cfg.rootClass, cfg.rootAliases);
    if (!Object.keys(staticMap).some((k) => template.includes(k))) return match;
    const mods = template.match(/\$\{([^}]+)\}/g);
    if (!mods) {
      const expr = patchClassString(template, classMap);
      return expr ? `className={${expr}}` : match;
    }
    const base = template.split(" ")[0];
    const modPrefix = (template.split("--${")[1] || "").split("}")[0];
    if (base.includes("collection-art") && modPrefix) {
      return `className={cn(styles.collectionArt, styles[\`collectionArt\${${modPrefix}}\`])}`;
    }
    if (base.includes("grid--data")) {
      return `className={cn(styles.grid, styles.gridData)}`;
    }
    return match;
  },
);
page = page.replace(
  /className=\{([^?]+) \? "active" : ""\}/g,
  "className={$1 ? styles.active : undefined}",
);
page = page.replace(
  /className=\{([^?]+) \? "active" : undefined\}/g,
  "className={$1 ? styles.active : undefined}",
);
page = page.replace(
  /className="active"/g,
  "className={styles.active}",
);
if (cfg.dataLayout) {
  const rootKey = cfg.rootClass;
  page = page.replace(
    `className={cn(styles.${rootKey})}`,
    `className={cn(styles.${rootKey})} data-layout="${cfg.dataLayout}"`,
  );
  page = page.replace(
    `className={cn(styles.${rootKey}, styles.real)}`,
    `data-layout="${cfg.dataLayout}" className={cn(styles.${rootKey}, styles.real)}`,
  );
  if (!page.includes(`data-layout="${cfg.dataLayout}"`)) {
    page = page.replace(
      `<main className={cn(styles.${rootKey}`,
      `<main data-layout="${cfg.dataLayout}" className={cn(styles.${rootKey}`,
    );
  }
}
writeFileSync(tsxPath, page, "utf8");

const globalsPath = resolve(root, "app/globals.css");
let globals = readFileSync(globalsPath, "utf8");
for (const re of cfg.globalsRemove || []) {
  globals = globals.replace(re, "");
}
for (const [from, to] of cfg.globalsReplace || []) {
  globals = globals.replace(from, to);
}
if (blockName === "creators") {
  globals = globals.replace(
    /\.xy-rank-hero, \.xy-creators-hero/g,
    '.xy-rank-hero, main[data-layout="creators"] header',
  );
}
if (blockName === "features") {
  globals = globals.replace(
    /  \.xy-hot-page, \.xy-rank-page, \.xy-creators-page \{ padding-top: 20px; \}/,
    '  main[data-layout="features"], .xy-hot-page, .xy-rank-page, .xy-creators-page { padding-top: 20px; }',
  );
}
writeFileSync(globalsPath, globals, "utf8");

console.log(`OK ${blockName} -> ${cfg.module}`);
