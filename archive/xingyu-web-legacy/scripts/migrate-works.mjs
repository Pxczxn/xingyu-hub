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
  if (cls.startsWith("is-")) return toCamel(cls);
  return cls;
}

function transformCss(css, strips, defaultStrip, rootClass, rootAliases = {}) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
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

const eventsPath = resolve(root, "app/events/events.module.css");
const eventsLines = readFileSync(eventsPath, "utf8").split("\n");
const worksStart = eventsLines.findIndex((l) => l.trim().startsWith(".works{max-width:1290px"));
const deadStart = eventsLines.findIndex((l, i) => i > worksStart && l.includes(".xy-published"));
if (worksStart < 0) {
  console.log("Works annex not found");
  process.exit(1);
}

const worksCss = eventsLines.slice(worksStart, deadStart >= 0 ? deadStart : undefined).join("\n");
const rootAliases = {
  "xy-work-card": "workCard",
  "xy-work-cover": "workCover",
};
const moduleCss = transformCss(
  worksCss,
  ["xy-works-", "xy-work-"],
  "xy-works-",
  "works",
  rootAliases,
);

writeFileSync(
  resolve(root, "app/events/starry/works/works.module.css"),
  moduleCss.trim() + "\n",
  "utf8",
);

writeFileSync(
  eventsPath,
  [...eventsLines.slice(0, worksStart), ...eventsLines.slice(deadStart >= 0 ? deadStart : eventsLines.length)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n",
  "utf8",
);

const pagePath = resolve(root, "app/events/starry/works/page.tsx");
let page = readFileSync(pagePath, "utf8");
page = page.replace(
  'import styles from "../../events.module.css";',
  'import styles from "./works.module.css";',
);
page = page.replace(/className="xy-works-hero-wrap"/g, `className={cn(styles.heroWrap)}`);
page = page.replace(/className="xy-works-hero"/g, `className={cn(styles.hero)}`);
page = page.replace(/className="xy-works-filter"/g, `className={cn(styles.filter)}`);
page = page.replace(/className="xy-works-masonry"/g, `className={cn(styles.masonry)}`);
page = page.replace(/className="xy-works-stats"/g, `className={cn(styles.stats)}`);
page = page.replace(/className="xy-works-authors"/g, `className={cn(styles.authors)}`);
page = page.replace(/className="xy-works-rating"/g, `className={cn(styles.rating)}`);
page = page.replace(/className="xy-work-cover"/g, `className={cn(styles.workCover)}`);
page = page.replace(
  /className=\{type === "ALL" \? "active" : ""\}/g,
  'className={type === "ALL" ? styles.active : undefined}',
);
page = page.replace(
  /className=\{type === item \? "active" : ""\}/g,
  "className={type === item ? styles.active : undefined}",
);
page = page.replace(
  /className=\{`xy-work-card \$\{index % 3 === 0 \? "tall" : index % 3 === 1 \? "short" : "mid"\}`\}/g,
  "className={cn(styles.workCard)}",
);
writeFileSync(pagePath, page, "utf8");
console.log("OK works.module.css");
