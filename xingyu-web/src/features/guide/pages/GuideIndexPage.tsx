import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { guideApi } from "@/api/guide/guide.api";
import type { GuidePage } from "@/api/guide/guide.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

const GUIDE_ENTRIES = [
  {
    slug: "getting-started",
    title: "快速上手",
    description: "了解浏览、创作和参与社区的基本路径。",
    href: "/guide/getting-started",
  },
  {
    slug: "community-rules",
    title: "社区规则",
    description: "了解社区规范，以及举报与申诉相关规则。",
    href: "/rules",
  },
] as const;

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

  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <p className="eyebrow mb-2.5">GUIDE</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">使用指南</h1>
        <p className="mt-2.5 max-w-xl text-sm leading-6 text-muted-foreground">
          从第一次进入星语，到找到自己的创作与交流方式。
        </p>
      </header>

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
      {!loading && !error && pages.length === 0 ? (
        <PageState kind="empty" title="暂无指南" description="指南发布后会在这里展示。" />
      ) : null}

      {!loading && !error && pages.length > 0 ? (
        /*
         * 卡片表面升到批次 07 起的形态（`rounded-xl` + `border-border/70`），交互反馈用
         * `card-lift`（整卡都是 `<Link>`，抬升说的是真话）+ `focus-ring`（键盘焦点此前
         * 不可见）。与公告中心同一张卡片语言，判据见该页页头注释。
         *
         * 这一页**不做**错峰入场：入口是 `GUIDE_ENTRIES` 里写死的两条，长度在渲染前就
         * 已知且只有两位，错峰没有信息可传达。判据是 EventDetailPage 那条的反面 ——
         * 错峰留给「长度由服务端决定」的列表（/reports、/appeals、公告），固定块由
         * AppLayout 的 `animate-page-enter` 统一负责。
         */
        <ul className="grid gap-3 sm:grid-cols-2">
          {GUIDE_ENTRIES.map((entry) => {
            const page = pages.find((item) => item.slug === entry.slug);
            if (!page) return null;
            return (
              <li key={page.id}>
                <Link
                  to={entry.href}
                  className="card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4"
                >
                  <h2 className="section-heading">{entry.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {entry.description}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
