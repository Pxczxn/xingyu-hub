#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const submitModulePath = resolve(root, "app/events/[eventId]/submit/event-submit.module.css");
const eventsPath = resolve(root, "app/events/events.module.css");

const submitAll = readFileSync(submitModulePath, "utf8");
const splitAt = submitAll.indexOf(".submitPage {\n  max-width: 1475px;");
if (splitAt < 0) {
  console.error("Submit split marker not found");
  process.exit(1);
}

const activityBlock = submitAll.slice(0, splitAt).replace(/^\.submitPage[\s\S]*?^\.xy-activity-rank/m, ".xy-activity-rank");
const submitBlock = submitAll.slice(splitAt);

const previewLegal = `
.preview {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 20px;
  background: #faf8f6;
  border-radius: 10px;
  padding: 10px;
}
.preview img {
  width: 112px;
  height: 174px;
  object-fit: cover;
  border-radius: 7px;
}
.preview h3 {
  font-size: 16px;
}
.preview small {
  display: flex;
  align-items: center;
}
.preview svg {
  width: 14px;
}
.legal {
  text-align: center;
  font: 11px sans-serif;
}
.legal svg {
  display: inline;
  width: 15px;
}
`;

writeFileSync(
  submitModulePath,
  `.submitPage {\n  color: #102954;\n  font-family: "Noto Serif SC", "Songti SC", serif;\n}\n` +
    submitBlock.replace(/^\.submitPage \{[\s\S]*?^\.submitPage > header/m, ".submitPage > header") +
    previewLegal +
    "\n",
  "utf8",
);

const eventsLines = readFileSync(eventsPath, "utf8").split("\n");
const corruptStart = eventsLines.findIndex((l) => l.includes("Activity ranking, results and submission"));
const corruptEnd = eventsLines.findIndex((l, i) => i > corruptStart && l.includes("xy-app-shell"));
if (corruptStart < 0 || corruptEnd < 0) {
  console.error("Corrupt events block not found", corruptStart, corruptEnd);
  process.exit(1);
}

const restoredActivity = `/* Activity ranking, results and submission prototypes */
.xy-activity-rank,
.xy-results-page {
  color: #102954;
  font-family: "Noto Serif SC", "Songti SC", serif;
}
${activityBlock.trim()}
.xy-criteria {
  display: grid !important;
  grid-template-columns: 100px 1fr 40px;
  align-items: center;
  gap: 10px;
}
.xy-criteria i {
  height: 6px;
  border-radius: 5px;
  background: #f3ede9;
}
.xy-criteria i em {
  display: block;
  height: 100%;
  background: #ff8b3e;
  border-radius: 5px;
}
@media (max-width: 1100px) {
  .xy-activity-rank {
    grid-template-columns: 1fr;
  }
  .xy-activity-rank-rail,
  .xy-ranking-rules,
  .xy-results-rail {
    display: none;
  }
  .xy-results-page {
    grid-template-columns: 1fr;
  }
  .xy-result-lower {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 700px) {
  .xy-podium {
    gap: 8px;
    overflow: auto;
    justify-content: start;
  }
  .xy-ranking-table {
    overflow: auto;
  }
  .xy-ranking-table > header,
  .xy-ranking-table > div {
    min-width: 760px;
  }
  .xy-winner-show,
  .xy-winner,
  .xy-result-lower {
    grid-template-columns: 1fr;
  }
  .xy-winner-show > aside article {
    grid-template-columns: 120px 1fr;
  }
  .xy-winner-show > aside img {
    width: 120px;
  }
  .xy-results-main {
    padding: 22px 12px;
  }
  .xy-activity-rank-main > header > div {
    display: none;
  }
}
`;

writeFileSync(
  eventsPath,
  [...eventsLines.slice(0, corruptStart), ...restoredActivity.split("\n"), ...eventsLines.slice(corruptEnd)].join("\n"),
  "utf8",
);

console.log("OK repair-event-submit");
