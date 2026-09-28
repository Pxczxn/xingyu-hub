#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
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
  if (rest.includes("--")) {
    const [b, mod] = rest.split("--");
    return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
  }
  return toCamel(rest);
}

function globalToLocal(cls) {
  const aliases = {
    "xy-review-detail": "reviewDetail",
    "xy-review-loading": "reviewLoading",
    "xy-review-error": "reviewError",
  };
  if (aliases[cls]) return aliases[cls];
  if (cls.startsWith("xy-review-")) {
    const rest = cls.slice("xy-review-".length);
    if (cls.startsWith("is-")) return toCamel(cls);
    return normalizeRest(rest);
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
    if (!cls.startsWith("xy-review-") && !cls.startsWith("is")) return full;
    if (cls.startsWith("is") && !cls.startsWith("is-")) return full;
    if (cls.startsWith("is-")) return "." + toCamel(cls);
    return "." + globalToLocal(cls);
  });
}

const eventsPath = resolve(root, "app/events/events.module.css");
const eventsLines = readFileSync(eventsPath, "utf8").split("\n");
const reviewStart = eventsLines.findIndex((l) => l.includes(".xy-review-detail"));
if (reviewStart < 0) {
  console.log("No review block in events.module.css");
  process.exit(0);
}

const reviewCss = eventsLines.slice(reviewStart).join("\n");
const eventsCss = eventsLines.slice(0, reviewStart).join("\n").trimEnd() + "\n";

const modulePath = resolve(root, "components/studio/review-detail/review-detail.module.css");
writeFileSync(modulePath, transformCss(reviewCss).trim() + "\n", "utf8");
writeFileSync(eventsPath, eventsCss, "utf8");
console.log("Extracted review-detail.module.css, events.module.css lines:", eventsLines.slice(0, reviewStart).length);

const reviewFiles = [
  "components/studio/review-detail/review-detail-page.tsx",
  "components/studio/review-detail/review-tool-list.tsx",
  "components/studio/review-detail/review-article-summary.tsx",
  "components/studio/review-detail/review-feedback-card.tsx",
  "components/studio/review-detail/review-status-header.tsx",
  "components/studio/review-detail/review-standards-panel.tsx",
  "components/studio/review-detail/review-step-bar.tsx",
];

const classMap = {};
for (const file of reviewFiles) {
  const content = readFileSync(resolve(root, file), "utf8");
  const re = /xy-review-[a-z0-9-]+|is-[a-z]+/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    classMap[m[0]] = globalToLocal(m[0]);
  }
}

function mapClassString(classes) {
  const parts = classes.split(/\s+/).filter(Boolean);
  if (!parts.some((p) => classMap[p])) return null;
  return `cn(${parts.map((p) => (classMap[p] ? `styles.${classMap[p]}` : `"${p}"`)).join(", ")})`;
}

for (const file of reviewFiles) {
  const path = resolve(root, file);
  let out = readFileSync(path, "utf8");
  if (!out.includes("review-detail.module.css")) {
    out = out.replace(
      /^(?:"use client";\n)?/,
      (m) => `${m}import styles from "./review-detail.module.css";\nimport { cn } from "@/lib/utils";\n`,
    );
  }
  out = out.replace(/className="([^"]+)"/g, (match, classes) => {
    const expr = mapClassString(classes);
    return expr ? `className={${expr}}` : match;
  });
  writeFileSync(path, out, "utf8");
  console.log("Patched", file);
}
