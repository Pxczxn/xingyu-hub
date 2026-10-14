import { Outlet } from "react-router-dom";
import { StudioNav } from "@/features/studio/components/StudioNav";

/*
 * Studio workbench shell (批次 06, 2026-10-13) — the shared frame for every
 * studio page EXCEPT the editor.
 *
 * S7 in the layout plan reads: 「200~240px 左导航 + 主区」 for 创作中心 / 设置 /
 * 我的内容. Settings already has exactly that shape (`SettingsLayout`), so this is
 * the same pattern rather than a new one: a PATHLESS parent route renders the
 * nav and an `<Outlet />`, and every child page keeps rendering only its own
 * content. Auth stays on the parent (RequireAuth), so `?returnTo=` still carries
 * the child's real path — a pathless route does not change the URL.
 *
 * ⚠️ THE SHELL CARRIES NO HEADING, AND THAT IS A HARD CONSTRAINT — not a style
 * choice. `studio-2n-routes.test.tsx` asserts that on `/studio/categories` there
 * is NO heading named 「创作中心」:
 *
 *     expect(screen.queryByRole("heading", { name: "创作中心" })).not.toBeInTheDocument();
 *
 * The test exists to pin that `/studio` does not swallow `/studio/categories`.
 * A shell heading would put 「创作中心」 on all seven pages and invert that
 * assertion. `SettingsLayout` does have its own h1 (「设置」) and has no such
 * counter-assertion — so that part of the pattern is deliberately NOT copied.
 *
 * What replaces it: the nav's own `aria-label` names the area for assistive
 * tech, and every page already opens with its own h1 (内容管理 / 我的投稿 /
 * 创作空间分类 …). A second, larger heading above those would be a heading that
 * says where you are without saying what you are looking at.
 *
 * ⚠️ THE EDITOR IS NOT A CHILD OF THIS SHELL. `/studio/content/:articleId` is a
 * full-width three-column workspace of its own (its own sticky toolbar, its own
 * outline/settings rails) and nesting it inside a 200px rail would fight it for
 * horizontal space. It is declared as a sibling in `routes.tsx`, which also
 * matches the plan's one stated exception to 「Shell 不动」.
 *
 * ⚠️ `/studio/collaboration/accept` is also outside — see the comment on its
 * route. It is a flow step opened from an invite link, not a place you work.
 */
export function WorkbenchShell() {
  return (
    <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <StudioNav />
      {/* `min-w-0` on the content column for the same reason as in SettingsNav:
          a grid item defaults to its max-content width, and a wide table inside
          a child page would otherwise stretch the whole document. */}
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
