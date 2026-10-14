import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { announcementsApi } from "@/api/announcements/announcements.api";
import type { Announcement } from "@/api/announcements/announcements.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; item: Announcement };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

export function AnnouncementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    announcementsApi
      .getById(id)
      .then((item) => {
        if (active) setState({ kind: "ready", item });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <BackToList />
        </p>
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="公告不存在或未发布"
          description="这条公告可能已归档，或地址有误。"
        />
        <BackToList />
      </div>
    );
  }

  const { item } = state;

  return (
    /*
      A NOTICE, so it leads with what it is and when it takes effect.
      An announcement is not read the way an article is — the reader arrives
      asking "does this apply to me, and from when?". A badge states the document
      type, and the date sits in its own meta strip rather than as a loose line of
      grey text under the title, because for a notice the date is load-bearing.

      阅读宽度：整篇文章包在 max-w-[68ch] 里。
      原先只有正文块限宽（598px），而 header 与 article 铺满 1152px —— 结果是
      "大壳包窄正文"：标题下的分隔线、meta strip 都拉到 1152px，正文却在左边缩到 598px，
      右侧约 550px 纯空白。改成让**同一个 measure** 承载 header + 正文 + 返回链接，
      外壳宽度就等于真实阅读宽度。
      刻意**不**把正文拉宽来填空：68ch 是全站既有的阅读行宽（见 ArticleDetailPage /
      GuideBody），公告没有理由偏离。
    */
    <article className="section-gap max-w-[68ch]">
      <BackToList />

      <header className="border-b border-border/70 pb-5">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-line/60 bg-accent-soft px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-strong">
          公告
        </span>
        <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-primary">{item.title}</h1>
        {item.publishedAt ? (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-meta">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">发布</dt>
              <dd className="text-foreground-soft">
                <time dateTime={item.publishedAt}>{formatPublishedAt(item.publishedAt)}</time>
              </dd>
            </div>
          </dl>
        ) : null}
      </header>

      <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
        {item.body || "该公告暂未提供正文。"}
      </div>
    </article>
  );
}

function BackToList() {
  return (
    <Link to="/announcements" className="text-sm text-accent-strong hover:underline">
      返回公告列表
    </Link>
  );
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
