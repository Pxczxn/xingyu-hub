import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { GUIDE_ENTRIES } from "@/features/guide/guide-catalog";

/*
 * 使用指南目录 — SK2 画廊 · H=幅 / D=松 / R=错
 * （`.team/design/A-archetypes.md` §3 的 /guide/* 域 GuideIndex 行）。
 *
 * 骨架由 `ArchetypeFrame skeleton="SK2"` 给出：
 *
 *   H=幅：`PageHero` 是有面横幅（卡片面 + eyebrow + 标题 + 一句话 + 徽标插画槽），
 *     `motif-orbit` 挂 B §6 的几何轨道母题（两圈描边伪元素，零图片、零滤镜）。
 *     h1 由 PageHero 自己出，页面不再手写标题。
 *   D=松：每个条目一张独立卡面，首屏 ≤3 块；卡间距与卡内 padding 走 `.density-loose`
 *     的 `--density-grid-gap` / `--density-card-pad`，密度只有一处定义。
 *   R=错：主列 + 320 右轨（`SectionRail` 自带 `<aside aria-labelledby>` 与 sticky），
 *     把两份文档按**读法**分开 —— 教程在工作区（主列的卡格），条款在右侧常驻
 *     （查一条规则时不该先滚过一篇教程）。这不是为了凑一条轨：RulesPage 的页头注释
 *     逐字写过这两份文档是两种阅读工作（「rules 是查，guide 是跟着做」）。
 *
 * 为什么 `社区规则` 不进主列卡格：`GUIDE_ENTRIES` 的第二条 href 就是 `/rules`
 * （见 guide-catalog.ts 的注释），它和第一条不是同一类产物 —— 把条款放进等权卡格会
 * 读成「两篇教程」，而它其实是规范文档。因此主列只渲染教程条目，条款条目进右轨。
 *
 * 卡片表面是 `rounded-card` + `border-border/70`，交互反馈用 `card-lift`（整卡都是
 * `<Link>`，抬升说的是真话）+ `focus-ring`（键盘焦点此前不可见）。这一页**不做**
 * 错峰入场：条目是 `GUIDE_ENTRIES` 里写死的两条，长度在渲染前就已知，错峰没有信息
 * 可传达；固定块由 AppLayout 的 `animate-page-enter` 统一负责。
 */
export function GuideIndexPage() {
  const [pages, setPages] = useState<GuidePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    guideApi
      .list()
      .then((data) => {
        if (!active) return;
        setPages(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  /*
   * 目录被拆成两半（主列教程 / 右轨条款），但**只按 href 判断**，不新增数据源：
   * `pages` 仍是 `GET /guides` 的完整响应，`GUIDE_ENTRIES` 仍是唯一顺序来源。
   * 某一条在 `pages` 里不存在时它就不渲染（与改前 `if (!page) return null` 同一行为）。
   */
  const withPage = GUIDE_ENTRIES.map((entry) => ({
    entry,
    page: pages.find((item) => item.slug === entry.slug),
  })).filter((row): row is { entry: (typeof GUIDE_ENTRIES)[number]; page: GuidePage } =>
    Boolean(row.page),
  );
  const tutorialRows = withPage.filter((row) => row.entry.href !== "/rules");
  const rulesRow = withPage.find((row) => row.entry.href === "/rules");
  const empty = !loading && !error && pages.length === 0;

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      railLabel="规范文档"
      headerSlot={
        <PageHero
          eyebrow="GUIDE"
          title="使用指南"
          description="从第一次进入星语，到找到自己的创作与交流方式。"
          className="motif-orbit"
        />
      }
      /* R=错 的右轨：条款常驻。没有条款页时不渲染 rail，frame 自动退回单列。 */
      rail={
        rulesRow ? (
          <Link
            to={rulesRow.entry.href}
            className="card-lift focus-ring block rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
          >
            <p className="eyebrow">条款</p>
            <h2 className="mt-2 break-words text-h3 text-primary">{rulesRow.entry.title}</h2>
            <p className="mt-2 text-meta leading-6 text-muted-foreground">
              {rulesRow.entry.description}
            </p>
          </Link>
        ) : null
      }
    >
      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {empty ? (
        <PageState kind="empty" title="暂无指南" description="指南发布后会在这里展示。" />
      ) : null}

      {!loading && !error && tutorialRows.length > 0 ? (
        <ul className="grid gap-[var(--density-grid-gap)] sm:grid-cols-2">
          {tutorialRows.map(({ entry, page }) => (
            <li key={page.id} className="flex">
              <Link
                to={entry.href}
                className="card-lift focus-ring flex h-full w-full flex-col rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
              >
                <h2 className="break-words text-h3 text-primary">{entry.title}</h2>
                <p className="mt-2 text-body leading-6 text-muted-foreground">
                  {entry.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ArchetypeFrame>
  );
}
