#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = execSync("git show ac26a48:xingyu-web/app/globals.css", {
  encoding: "utf8",
  cwd: resolve(root, ".."),
});
const lines = raw.split("\n");
const start = lines.findIndex((l) => l.startsWith(".xy-moment-loading"));
const end = lines.findIndex((l, i) => i > start && l.startsWith(".xy-profile-loading"));
const block = lines.slice(start, end).join("\n");

const map = {
  "xy-moment-loading": "loading",
  "xy-moment-page": "page",
  "xy-moment-rail": "rail",
  "xy-moment-center": "center",
  "xy-moment-card": "card",
  "xy-moment-comments": "comments",
  "xy-moment-side": "side",
  "xy-moment-author": "author",
  "xy-moment-body": "body",
  "xy-moment-gallery": "gallery",
  "xy-moment-tags": "tags",
  "xy-moment-stats": "stats",
  "xy-moment-related": "related",
  "xy-moment-about": "about",
  "xy-moment-side-title": "sideTitle",
  "xy-moment-topic": "topic",
  "xy-moment-more": "more",
};

let css = block;
for (const [from, to] of Object.entries(map)) {
  css = css.replaceAll(`.${from}`, `.${to}`);
}

css += `
.emptyRelated {
  display: grid;
  place-items: center;
  min-height: 72px;
  border: 1px dashed #e1e5ec;
  border-radius: 9px;
  color: #788397;
  font-size: 12px;
}
@media (max-width: 1200px) {
  .page { grid-template-columns: 180px minmax(0, 1fr); }
  .side { grid-column: 2; grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 800px) {
  .page { grid-template-columns: 1fr; }
  .rail { display: none; }
  .side { grid-column: auto; grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .page { width: min(100% - 18px, 1368px); }
  .card, .comments { padding: 14px; }
  .gallery { grid-template-columns: 1fr; }
  .gallery img { height: 190px; border-radius: 8px !important; }
  .related { grid-template-columns: 80px 1fr; }
  .related > span { display: none; }
}
`;

const out = resolve(root, "app/moments/[momentId]/moment-detail.module.css");
writeFileSync(out, css, "utf8");

const pagePath = resolve(root, "app/moments/[momentId]/page.tsx");
let page = readFileSync(pagePath, "utf8");
page = page.replace(
  'import styles from "@/components/community/browse-secondary.module.css";',
  'import styles from "./moment-detail.module.css";',
);
page = page.replace(
  'className={cn(styles.related, "xy-empty-related")}',
  "className={cn(styles.related, styles.emptyRelated)}",
);
page = page.replace(
  "<main className={cn(styles.page)}>",
  '<main className={cn(styles.page)} data-layout="moment-detail">',
);
writeFileSync(pagePath, page, "utf8");
console.log("OK moment-detail restored");
