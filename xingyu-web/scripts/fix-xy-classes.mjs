#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(".");

function toCamel(s) {
  return s.split("-").filter(Boolean).map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

function globalToLocal(cls) {
  const prefixes = [
    "xy-search-", "xy-article-", "xy-profile-", "xy-me-", "xy-event-",
    "xy-series-", "xy-galaxy-", "xy-hot-", "xy-rank-", "xy-tag-", "xy-moment-",
    "xy-topic-", "xy-collection-", "xy-creator-", "xy-space-", "xy-discover-",
  ];
  for (const strip of prefixes) {
    const base = strip.replace(/-$/, "");
    if (cls === base) return toCamel(base.replace(/^xy-/, "").replace(/-page$/, "Page"));
    if (cls.startsWith(strip)) {
      let rest = cls.slice(strip.length).replace(/^-+/, "");
      if (rest.includes("--")) {
        const [b, mod] = rest.split("--");
        return toCamel(b) + mod.charAt(0).toUpperCase() + mod.slice(1);
      }
      return toCamel(rest);
    }
  }
  if (cls.startsWith("is-")) return toCamel(cls);
  return null;
}

function walk(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory() && f !== "node_modules") walk(p, files);
    else if (f.endsWith(".tsx")) files.push(p);
  }
  return files;
}

let fixed = 0;
for (const file of walk(root)) {
  let out = readFileSync(file, "utf8");
  if (!out.includes(".module.css")) continue;
  if (!out.includes("xy-")) continue;
  const before = out;
  out = out.replace(/className="([^"]*xy-[^"]+)"/g, (match, classes) => {
    const parts = classes.split(/\s+/).filter(Boolean);
    const mapped = parts.map((p) => {
      const local = globalToLocal(p);
      return local ? `styles.${local}` : `"${p}"`;
    });
    if (!mapped.some((m) => m.startsWith("styles."))) return match;
    return `className={cn(${mapped.join(", ")})}`;
  });
  if (out !== before) {
    if (!out.includes('import { cn }')) {
      out = out.replace(/import styles from/, 'import { cn } from "@/lib/utils";\nimport styles from');
    }
    writeFileSync(file, out, "utf8");
    fixed++;
    console.log("Fixed", file.replace(root + "\\", ""));
  }
}
console.log("Fixed", fixed, "files");
