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
    return toCamel(rest) || rootClass;
  }
  if (cls === "active") return "active";
  return cls;
}

function transformCss(css, strip, rootClass, rootAliases = {}) {
  return css.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (full, cls) => {
    const base = strip.replace(/-$/, "");
    if (!cls.startsWith(base) && cls !== "active") return full;
    return "." + globalToLocal(cls, strip, rootClass, rootAliases);
  });
}

const eventsPath = resolve(root, "app/events/events.module.css");
let eventsCss = readFileSync(eventsPath, "utf8");

const submitStart = eventsCss.indexOf(".xy-submit-page {");
const submitEnd = eventsCss.indexOf(".xy-criteria {");
if (submitStart < 0 || submitEnd < 0) {
  console.log("Submit block not found");
  process.exit(1);
}

const submitBlock = eventsCss.slice(submitStart, submitEnd);
const responsive = `
@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr; }
  .grid form > footer { grid-template-columns: 1fr 1fr; }
  .submitPage > header { display: block; }
  .submitPage > header ol { margin-top: 15px; overflow: auto; }
}
@media (max-width: 700px) {
  .work { grid-template-columns: 1fr; }
  .grid form > footer { grid-template-columns: 1fr; }
}
`;

const moduleCss =
  transformCss(
    `.xy-submit-page, .xy-results-page, .xy-activity-rank { color: #102954; font-family: "Noto Serif SC", "Songti SC", serif; }\n` +
      submitBlock,
    "xy-submit-",
    "submitPage",
    { "xy-submit-page": "submitPage" },
  ) + responsive;

writeFileSync(
  resolve(root, "app/events/[eventId]/submit/event-submit.module.css"),
  moduleCss.trim() + "\n",
  "utf8",
);

eventsCss =
  eventsCss.slice(0, submitStart) +
  eventsCss.slice(submitEnd).replace(
    /@media \(max-width: 1100px\) \{[\s\S]*?\.xy-submit-page > header ol \{[\s\S]*?\}\n/,
    "",
  );
eventsCss = eventsCss.replace(
  /@media \(max-width: 700px\) \{([\s\S]*?)\.xy-submit-work \{[\s\S]*?\}\n  \.xy-submit-grid form > footer \{[\s\S]*?\}\n/,
  (match, inner) => {
    const cleaned = inner
      .replace(/\s*\.xy-submit-work \{[\s\S]*?\}\n/, "")
      .replace(/\s*\.xy-submit-grid form > footer \{[\s\S]*?\}\n/, "");
    return `@media (max-width: 700px) {${cleaned}`;
  },
);

eventsCss = eventsCss.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
writeFileSync(eventsPath, eventsCss, "utf8");

const pagePath = resolve(root, "app/events/[eventId]/submit/page.tsx");
let page = readFileSync(pagePath, "utf8");
page = page.replace(
  'import styles from "../../events.module.css";',
  'import styles from "./event-submit.module.css";',
);
page = page.replace(/className="xy-submit-page"/g, "className={cn(styles.submitPage)}");
page = page.replace(/className="xy-submit-grid"/g, "className={cn(styles.grid)}");
page = page.replace(/className="xy-submit-tabs"/g, "className={cn(styles.tabs)}");
page = page.replace(/className="xy-submit-work"/g, "className={cn(styles.work)}");
page = page.replace(/className="xy-submit-hint"/g, "className={cn(styles.hint)}");
page = page.replace(/className="xy-submit-event-body"/g, "className={cn(styles.eventBody)}");
page = page.replace(/className="xy-submit-preview"/g, "className={cn(styles.preview)}");
page = page.replace(/className="xy-submit-legal"/g, "className={cn(styles.legal)}");
page = page.replace(
  /className=\{index === 0 \? "active" : ""\}/g,
  "className={index === 0 ? styles.active : undefined}",
);
page = page.replace(
  /className=\{objectType === type \? "active" : ""\}/g,
  "className={objectType === type ? styles.active : undefined}",
);
writeFileSync(pagePath, page, "utf8");
console.log("OK event-submit.module.css");
