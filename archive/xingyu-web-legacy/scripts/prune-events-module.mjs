#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../app/events/events.module.css");
const css = readFileSync(cssPath, "utf8");

function between(start, end) {
  const s = css.indexOf(start);
  const e = css.indexOf(end, s);
  if (s < 0 || e < 0) throw new Error(`Marker not found:\n  start: ${start}\n  end: ${end}`);
  return css.slice(s, e);
}

const core = between(".real {", ".rulesPage {");
const rules = between(".rulesPage {", "/* Activity ranking, results and submission prototypes */");
const activity = between(
  "/* Activity ranking, results and submission prototypes */",
  ".xy-app-shell {",
);

const trimmedMedia1100 = `@media (max-width: 1100px) {
  .registrationGrid {
    grid-template-columns: 1fr;
    max-width: 760px;
    margin: auto;
  }
  .rulesPage {
    grid-template-columns: 1fr;
  }
  .rulesRail,
  .rulesSide {
    display: none;
  }
}
`;

const trimmedMedia700 = `@media (max-width: 700px) {
  .registrationPage {
    padding: 18px 12px;
  }
  .registerDates,
  .registerRewards {
    grid-template-columns: 1fr 1fr;
  }
  .rulesPair {
    grid-template-columns: 1fr;
  }
  .registrationGrid {
    display: block;
  }
  .registrationForm {
    margin-top: 12px;
    padding: 20px 14px;
  }
  .profileConfirm {
    grid-template-columns: 1fr;
  }
  .registrationForm > header {
    display: block;
  }
  .registrationForm ol {
    margin-top: 16px;
  }
  .registerHero {
    height: auto;
  }
}
`;

let activityClean = activity
  .replace(/\.activityRankRail,\s*\n\.xy-results-rail/g, ".activityRankRail")
  .replace(/\.activityRankRail > a,\s*\n\.xy-results-rail > a/g, ".activityRankRail > a")
  .replace(/\.activityRankRail svg,\s*\n\.xy-results-rail svg/g, ".activityRankRail svg")
  .replace(/\.xy-results-rail h2[\s\S]*?}\n/g, "")
  .replace(/\.xy-results-rail > a\.active[\s\S]*?}\n/g, "")
  .replace(/\.xy-results-rail > section[\s\S]*?}\n/g, "")
  .replace(/\.xy-results-rail > section a[\s\S]*?}\n/g, "")
  .replace(/\.xy-results-rail \{[\s\S]*?}\n/g, "")
  .replace(/  \.rankingRules,\s*\n  \.xy-results-rail \{\s*\n    display: none;\s*\n  \}/, "  .rankingRules {\n    display: none;\n  }")
  .replace(/\.xy-criteria[\s\S]*?}\n/g, "");

const header = `/* Events domain styles */
.rulesPage,
.registrationPage,
.activityRank,
.resultsPage,
.real,
.detailReal {
  color: #0b2446;
  font-family: "Noto Serif SC", "Songti SC", serif;
}

`;

const out = [header, core, rules, trimmedMedia1100, trimmedMedia700, activityClean].join("\n").replace(/\n{3,}/g, "\n\n");
writeFileSync(cssPath, out, "utf8");
console.log("Pruned events.module.css to", out.split("\n").length, "lines");
