import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const importLine = 'import shellStyles from "@/components/community/shell-primitives.module.css";';

const files = [
  "components/community/studio-returned-page.tsx",
  "app/messages/empty/page.tsx",
  "app/onboarding/page.tsx",
  "components/community/compact-page-shell.tsx",
  "components/community/feature-unavailable.tsx",
  "components/community/engagement.tsx",
  "src/vite/router.tsx",
  "app/page.tsx",
  "app/me/groups/page.tsx",
  "app/messages/search/page.tsx",
  "app/help/page.tsx",
  "app/studio/collaboration/page.tsx",
  "app/me/likes/page.tsx",
  "components/community/governance-tools.tsx",
  "app/me/requests/page.tsx",
  "app/messages/users/[username]/page.tsx",
  "app/studio/assets/page.tsx",
  "app/me/growth/page.tsx",
  "app/studio/settings/page.tsx",
  "app/studio/analytics/page.tsx",
  "app/settings/security/password/page.tsx",
  "app/messages/saved/page.tsx",
  "app/me/page.tsx",
  "components/community/content-page-shell.tsx",
  "components/community/studio-flow-shell.tsx",
  "app/share/page.tsx",
  "app/help/[slug]/page.tsx",
  "app/reports/new/page.tsx",
  "app/appeals/new/page.tsx",
  "components/community/screen-states.tsx",
  "components/community/creator-tools.tsx",
];

function ensureImport(source) {
  if (source.includes("shell-primitives.module.css")) return source;
  const lines = source.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^import .+ from ["']/.test(lines[i])) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, importLine);
  return lines.join("\n");
}

function ensureCnImport(source) {
  if (source.includes('from "@/lib/utils"') && source.includes(" cn")) return source;
  if (source.includes("{ cn }")) return source;
  if (!source.includes("cn(")) return source;
  const lines = source.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^import .+ from ["']/.test(lines[i])) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, 'import { cn } from "@/lib/utils";');
  return lines.join("\n");
}

function migrate(source) {
  let next = source;

  next = next.replace(/className="xy-page ([^"]+)"/g, 'className={cn(shellStyles.page, "$1")}');
  next = next.replace(/className="xy-panel ([^"]+)"/g, 'className={cn(shellStyles.panel, "$1")}');
  next = next.replace(/className="xy-panel-interactive ([^"]+)"/g, 'className={cn(shellStyles.panelInteractive, "$1")}');
  next = next.replace(/className="xy-page"/g, "className={shellStyles.page}");
  next = next.replace(/className="xy-panel"/g, "className={shellStyles.panel}");
  next = next.replace(/className="xy-panel-interactive"/g, "className={shellStyles.panelInteractive}");

  next = next
    .replace(/\bcn\("xy-page"/g, "cn(shellStyles.page")
    .replace(/\bcn\(\s*"xy-panel"/g, "cn(shellStyles.panel")
    .replace(/"xy-panel-interactive"/g, "shellStyles.panelInteractive")
    .replace(/"xy-panel"/g, "shellStyles.panel")
    .replace(/"xy-page"/g, "shellStyles.page");

  return next;
}

for (const rel of files) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes("xy-page") && !before.includes("xy-panel")) continue;
  let after = migrate(before);
  after = ensureCnImport(after);
  after = ensureImport(after);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log("patched", rel);
  }
}
