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
    if (rest.includes("__")) {
      const [block, ...elements] = rest.split("__");
      return toCamel(block) + elements.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join("");
    }
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

function splitAnnexBlob(content) {
  const momentIdx = content.search(/\.xy-moment-compose\b/);
  const myEventsIdx = content.search(/\.xy-my-events\b/);
  const worksIdx = content.search(/\.works\{max-width:1290px/);
  const deadIdx = content.search(/\.xy-published\b/);
  if (momentIdx < 0 || myEventsIdx < 0 || worksIdx < 0) {
    throw new Error(`Split markers missing: moment=${momentIdx} my=${myEventsIdx} works=${worksIdx}`);
  }
  return {
    announcements: content.slice(0, momentIdx).trim(),
    momentCompose: content.slice(momentIdx, myEventsIdx).trim(),
    myEvents: content.slice(myEventsIdx, worksIdx).trim(),
    works: content.slice(worksIdx, deadIdx >= 0 ? deadIdx : undefined).trim(),
  };
}

const annexPath = resolve(root, "app/announcements/announcements.module.css");
const blob = readFileSync(annexPath, "utf8");
const { announcements, momentCompose, myEvents, works } = splitAnnexBlob(blob);

writeFileSync(annexPath, announcements + "\n", "utf8");

writeFileSync(
  resolve(root, "app/studio/moments/new/moment-compose.module.css"),
  transformCss(
    momentCompose,
    ["xy-moment-compose", "xy-compose-", "xy-preview-", "xy-upload-", "xy-more-"],
    "xy-compose-",
    "momentCompose",
    { "xy-moment-compose": "momentCompose" },
  ).trim() + "\n",
  "utf8",
);

writeFileSync(
  resolve(root, "app/me/events/my-events.module.css"),
  transformCss(
    myEvents,
    ["xy-my-events-", "xy-events-", "xy-event-", "xy-progress-"],
    "xy-my-events-",
    "myEvents",
    { "xy-my-events": "myEvents", "xy-events-end": "eventsEnd", "xy-events-more": "eventsMore" },
  ).trim() + "\n",
  "utf8",
);

const eventsPath = resolve(root, "app/events/events.module.css");
const eventsBody = readFileSync(eventsPath, "utf8").replace(/\n?\/\*[^*]*公告[^*]*\*\/\s*$/, "").trimEnd();
writeFileSync(eventsPath, eventsBody + "\n\n" + works + "\n", "utf8");

console.log("OK repair-events-annex");
