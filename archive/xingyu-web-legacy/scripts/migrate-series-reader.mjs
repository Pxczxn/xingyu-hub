#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = resolve(root, "app/series/series.module.css");
const pagePath = resolve(root, "app/series/[seriesId]/read/page.tsx");

const map = [
  ["xy-reader-loading", "readerLoading"],
  ["xy-reader-directory", "readerDirectory"],
  ["xy-reader-tools", "readerTools"],
  ["xy-reader-dir-head", "readerDirHead"],
  ["xy-reader-article", "readerArticle"],
  ["xy-reader-progress", "readerProgress"],
  ["xy-reader-copy", "readerCopy"],
  ["xy-reader-lead", "readerLead"],
  ["xy-width-switch", "widthSwitch"],
];

let css = readFileSync(cssPath, "utf8");
for (const [from, to] of map) {
  css = css.replaceAll(`.${from}`, `.${to}`);
}
writeFileSync(cssPath, css, "utf8");

let page = readFileSync(pagePath, "utf8");
page = page.replace(/className="xy-reader-loading"/g, "className={cn(styles.readerLoading)}");
page = page.replace(/className="xy-reader-directory"/g, "className={cn(styles.readerDirectory)}");
page = page.replace(/className="xy-reader-dir-head"/g, "className={cn(styles.readerDirHead)}");
page = page.replace(/className="xy-reader-article"/g, "className={cn(styles.readerArticle)}");
page = page.replace(/className="xy-reader-progress"/g, "className={cn(styles.readerProgress)}");
page = page.replace(/className="xy-reader-copy"/g, "className={cn(styles.readerCopy)}");
page = page.replace(/className="xy-reader-lead"/g, "className={cn(styles.readerLead)}");
page = page.replace(/className="xy-reader-tools"/g, "className={cn(styles.readerTools)}");
page = page.replace(/className="xy-width-switch"/g, "className={cn(styles.widthSwitch)}");
page = page.replace(
  /className=\{index === currentIndex \? "is-active" : ""\}/g,
  "className={index === currentIndex ? styles.isActive : undefined}",
);
page = page.replace(
  /className=\{lineWidth === value \? "is-active" : ""\}/g,
  "className={lineWidth === value ? styles.isActive : undefined}",
);
writeFileSync(pagePath, page, "utf8");
console.log("OK series reader");
