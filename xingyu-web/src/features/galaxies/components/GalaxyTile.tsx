import { ArrowRight, BadgeCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { GalaxySummary } from "@/api/galaxies/galaxies.types";
import { GalaxyVisual } from "@/components/visual/GalaxyVisual";
import { cn } from "@/lib/cn";

export type GalaxyTileVariant = "mine" | "official" | "community";

function memberLabel(memberCount: number): string {
  return memberCount > 0 ? `${memberCount} 位成员` : "暂无成员";
}

/*
 * Galaxy card.
 *
 * 2026-10-03 (layout pass) — the featured tile was broken below 640px.
 *
 * The row was `flex items-center gap-4` with a FIXED 224x112 (`w-56 h-28`)
 * visual that carried `shrink-0`. On a 390px viewport the shell leaves ~320px of
 * content width, so the visual plus the trailing arrow consumed all but ~50px of
 * the row and every character of the title wrapped onto its own line — the card
 * rendered as a column of single glyphs and grew to roughly 300px tall.
 *
 * Fixes:
 *   - the featured tile stacks (`flex-col` → `sm:flex-row`) and its visual is a
 *     full-width banner below `sm`, a 176x112 thumbnail above it;
 *   - the trailing arrow is hidden on the stacked layout, where the explicit
 *     「进入星系」 call to action already carries the affordance;
 *   - `min-w-0` stays on the text column so long names still ellipsize.
 *
 * Hierarchy: the title owns the strongest weight in the card, the meta line is
 * the only muted text, and the CTA is the single gold element — it used to be
 * plain gold text (2.01:1 on cream), now --accent-strong.
 *
 * 2026-10-13 (批次 03) — 信息结构重做，按设计方案 §3.4「星系卡片信息结构」：
 *
 *   [ 名称 + 认证标识 ]   ← 名称与官方徽章同行，最高对比
 *   [ 一句话定位 ]        ← description；缺失时整行不渲染
 *   [ 成员数 ]            ← 接口提供才渲染
 *   [ 查看星系 → ]        ← 明确出口
 *
 *   三处与旧版不同：
 *   1. 认证从 meta 行的「官方星系/社区星系」文本改成名称旁的徽章。旧写法把
 *      「是不是官方」和「有多少人」压成同一行同级文本，读者要读完才知道哪个
 *      是身份、哪个是数字。社区身份是默认态，标注它是冗余，故徽章只在官方时出现。
 *   2. 补上「一句话定位」。设计方案称这是本页最重要的字段：读者要一眼判断
 *      「这是什么团队、适不适合我」。`description` 由 V051 列提供，admin 未填写时
 *      为 null —— 此时整行不渲染，不摆占位文案，也不留空白（`GalaxyShell` 早已
 *      确立同一原则）。注意：列表端点会填充 description，但**不填充 contentCount**
 *      （`GalaxyView` 字段三区分），所以元信息只有成员数，没有「内容数」——
 *      那会是一句编造。
 *   3. 出口从「仅 featured 有文字出口 + 其余只有尾随箭头」统一为每张卡都有
 *      「查看星系 →」。尾随箭头随之移除：同一张卡里两个箭头指向同一处，是噪音。
 *
 *   `.card-lift` 而非手写 hover：整卡都是 `<Link>`，抬升说的是真话。
 */
export function GalaxyTile({
  galaxy,
  variant = "community",
  featured = false,
}: {
  galaxy: GalaxySummary;
  variant?: GalaxyTileVariant;
  featured?: boolean;
}) {
  return (
    <Link
      to={`/galaxies/${encodeURIComponent(galaxy.slug)}`}
      className={cn(
        "group card-lift focus-ring flex h-full rounded-xl border",
        featured
          ? "flex-col gap-4 p-4 hover:border-accent-line sm:flex-row sm:items-start sm:gap-5 sm:p-5"
          : "items-start gap-3.5 p-4 hover:border-accent-line sm:gap-4",
        variant === "mine" && "border-accent-line/60 bg-accent-soft/50 hover:bg-accent-soft",
        variant === "official" && "border-border/70 bg-card",
        variant === "community" && "border-border/60 bg-card/70 hover:bg-card",
      )}
    >
      <GalaxyVisual
        stableKey={galaxy.slug}
        official={galaxy.official}
        variant={featured ? "official" : "compact"}
        className={featured ? "h-24 w-full sm:h-28 sm:w-44" : "h-14 w-14 sm:h-16 sm:w-16"}
      />

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "truncate font-semibold text-primary transition-colors group-hover:text-accent-strong",
              featured ? "text-[17px]" : "text-card",
            )}
          >
            {galaxy.name}
          </span>
          {galaxy.official ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent-line/60 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              官方
            </span>
          ) : null}
        </span>

        {/*
          简介是 admin 维护的身份字段。没有就什么都不渲染——编一段占位文案
          等于替运营撒谎，而留一块空白则会让网格里每张卡的高度错开。
        */}
        {galaxy.description ? (
          <span className="line-clamp-2 text-meta leading-5 text-muted-foreground">
            {galaxy.description}
          </span>
        ) : null}

        {/*
          The count is the galaxy's substance — how many people are in it — so it
          sits at the meta step rather than at 12px grey. Its own element, so the
          text node is exactly the label and nothing else.
        */}
        <span className="inline-flex items-center gap-1.5 text-meta text-foreground-soft">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
          <span>{memberLabel(galaxy.memberCount)}</span>
        </span>

        {/* `mt-auto` keeps the exit on the card's floor when a neighbour in the
            same grid row carries a two-line description and this one carries none. */}
        <span className="mt-auto inline-flex items-center gap-1 pt-1.5 text-meta font-medium text-accent-strong">
          查看星系
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}
