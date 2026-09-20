import { readdir, unlink, rmdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "xingyu-web/app";

const DELETE_FILES = [
  "users/[username]/page.tsx",
  "users/[username]/works/page.tsx",
  "users/[username]/works/settings/categories/page.tsx",
  "hot/page.tsx",
  "me/profile/page.tsx",
  "me/insights/page.tsx",
  "studio/published/page.tsx",
  "studio/drafts/page.tsx",
  "studio/reviewing/page.tsx",
  "studio/returned/page.tsx",
  "studio/trash/page.tsx",
  "studio/featured/page.tsx",
  "studio/categories/page.tsx",
  "studio/articles/page.tsx",
  "studio/articles/new/page.tsx",
  "studio/articles/[articleId]/edit/page.tsx",
  "studio/articles/[articleId]/preview/page.tsx",
  "studio/articles/[articleId]/publish/page.tsx",
  "studio/articles/[articleId]/submit/page.tsx",
  "studio/articles/[articleId]/conflict/page.tsx",
  "studio/articles/[articleId]/recovery/page.tsx",
  "studio/articles/[articleId]/review/page.tsx",
  "studio/articles/[articleId]/preflight/page.tsx",
  "studio/articles/[articleId]/publish-result/page.tsx",
  "studio/articles/[articleId]/versions/page.tsx",
  "messages/direct/[conversationId]/page.tsx",
  "messages/group/[conversationId]/page.tsx",
  "messages/group/[conversationId]/members/page.tsx",
  "messages/group/[conversationId]/settings/page.tsx",
  "messages/group/[conversationId]/info/page.tsx",
  "messages/group/[conversationId]/invite/page.tsx",
  "messages/group/[conversationId]/requests/page.tsx",
  "messages/group/[conversationId]/applications/page.tsx",
  "messages/group/[conversationId]/announcement/page.tsx",
  "messages/group/[conversationId]/announcements/page.tsx",
  "messages/group/[conversationId]/ownership/page.tsx",
  "messages/group/[conversationId]/join/page.tsx",
  "messages/favorites/page.tsx",
  // redirect-only stubs (handled by redirects.ts)
  "tags/page.tsx",
  "tags/[slug]/page.tsx",
  "guides/page.tsx",
  "articles/page.tsx",
  "me/appeals/page.tsx",
  "me/reports/page.tsx",
  "verify-email/change/page.tsx",
  "rules/enforcement/page.tsx",
  "status/[code]/page.tsx",
  "share/[shareId]/page.tsx",
  "policies/[type]/history/page.tsx",
  "policies/[type]/page.tsx",
  "studio/collaboration/submissions/page.tsx",
  "studio/collaboration/invitations/page.tsx",
  "register/success/page.tsx",
  "onboarding/welcome/page.tsx",
  "moments/new/page.tsx",
  "settings/security/events/page.tsx",
  "settings/data/export/page.tsx",
  "settings/data/delete-account/page.tsx",
  "settings/privacy/activity/page.tsx",
  "settings/privacy/profile/page.tsx",
  "settings/privacy/interactions/page.tsx",
];

async function removeEmptyDirs(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    if ((await stat(p)).isDirectory()) await removeEmptyDirs(p);
  }
  entries = await readdir(dir).catch(() => []);
  if (entries.length === 0) await rmdir(dir).catch(() => {});
}

for (const rel of DELETE_FILES) {
  const file = join(ROOT, rel);
  try {
    await unlink(file);
    console.log("deleted", rel);
  } catch (err) {
    console.warn("skip", rel, err instanceof Error ? err.message : err);
  }
}

await removeEmptyDirs(join(ROOT, "users"));
await removeEmptyDirs(join(ROOT, "studio/articles"));
await removeEmptyDirs(join(ROOT, "messages/direct"));
await removeEmptyDirs(join(ROOT, "messages/group"));
await removeEmptyDirs(join(ROOT, "tags"));
await removeEmptyDirs(join(ROOT, "guides"));
await removeEmptyDirs(join(ROOT, "policies"));
await removeEmptyDirs(join(ROOT, "share"));
await removeEmptyDirs(join(ROOT, "status"));
await removeEmptyDirs(join(ROOT, "rules/enforcement"));
await removeEmptyDirs(join(ROOT, "studio/collaboration/submissions"));
await removeEmptyDirs(join(ROOT, "studio/collaboration/invitations"));
await removeEmptyDirs(join(ROOT, "register/success"));
await removeEmptyDirs(join(ROOT, "onboarding/welcome"));
await removeEmptyDirs(join(ROOT, "moments/new"));
await removeEmptyDirs(join(ROOT, "settings/security/events"));
await removeEmptyDirs(join(ROOT, "settings/data/export"));
await removeEmptyDirs(join(ROOT, "settings/data/delete-account"));
await removeEmptyDirs(join(ROOT, "settings/privacy/activity"));
await removeEmptyDirs(join(ROOT, "settings/privacy/profile"));
await removeEmptyDirs(join(ROOT, "settings/privacy/interactions"));
console.log("done");
