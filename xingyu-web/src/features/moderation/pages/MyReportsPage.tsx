import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import {
  objectTypeLabel,
  reportReasonLabel,
  reportStatusLabel,
  targetDescription,
  type UserReportView,
} from "@/api/moderation/moderation.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { ModerationSwitch } from "@/features/moderation/components/ModerationSwitch";

/*
 * My reports — the moderation reports the session user filed.
 *
 * THIS IS A PERSONAL TRANSACTION RECORD, NOT A DASHBOARD.
 *
 * One row needs to answer four things and nothing else:
 *   举报了什么 · 当前状态 · 举报原因 · 时间
 * So there is deliberately NO total-count card, NO success-rate, NO
 * "已处理 X 条" summary strip. Those turn the user's record of an event they
 * personally submitted into a stats console they never asked for.
 *
 * The row never renders `targetId`: users do not read UUIDs, and a UUID standing
 * in for "what I reported" is not information — it is a system id wearing a
 * content's clothes. The subject is a server-resolved description instead
 * (`targetDescription`), and the type reads as 文章/动态/评论 via `objectTypeLabel`.
 *
 * TWO CONTRACT FACTS THAT SHAPE THIS PAGE:
 *
 * 1. `GET /me/reports` takes NO limit. One bounded read, no cursor, no pager.
 *
 * 2. The report status vocabulary is only SUBMITTED → CLOSED (TRIAGED also
 *    accepted). Unknown statuses are echoed verbatim, never mapped to a guess.
 *
 * The row is keyed by `report.id`. `updatedAt` is the CASE's timestamp when a
 * case exists, else the report's own createdAt — so it is labelled 「最近更新」,
 * which is the truthful claim.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; reports: UserReportView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MyReportsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    reportsApi
      .listMine()
      .then((reports) => {
        if (active) setState({ kind: "ready", reports });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired
              ? "登录状态已过期，请重新登录。"
              : (state.detail ?? "无法读取你的举报记录，请稍后重试。")
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { reports } = state;
  /*
    SK6 信息流 · H=线 / D=紧 / R=错（`.team/design/A-archetypes.md` §3 的 MyReports 行）。

    骨架由 `ArchetypeFrame skeleton="SK6"` 给出 `[1fr 行式流 | 300 右轨]`，页面不再自己
    写栏宽：

      H=线：页头是 `PageMasthead` —— 无面、无边框，标题贴内容列左缘。改前那个手写的
        `<header>` + `text-2xl` 是 A §4 点名的 30 处之一，就此收敛（去卡片、去图标
        的理由继续成立：一张只装标题的卡不是状态卡，是装饰）。
      D=紧：条目是「行」不是「格」。`FeedRow` 自带发丝线分隔、无逐项卡面；改前是
        「一张大卡 + `divide-y`」，那仍然是一张卡，行只是卡里的条纹。
      R=错：主列 + 侧轨。右轨由 frame 的 `rail` 出（`SectionRail` 自带
        `<aside aria-labelledby>` 与 sticky），承载页内本来就有的两个入口：举报/申诉
        切换器与「查看社区规则」。**不放任何统计卡** —— 文件头那段「这是个人事务记录，
        不是仪表盘」是本页的硬约束，`my-reports-page.test.tsx` 逐条钉着（不收「共 N 条」
        / 成功率 / 已处理数）。

    行不再做错峰入场：错峰是为「一格一格落下的卡格」准备的，行流是连续读数，逐行延迟
    只会让人等；整页入场仍由 AppLayout 的 `animate-page-enter` 负责。
  */
  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      railLabel="举报与申诉入口"
      headerSlot={<PageMasthead title="我的举报" description="你提交过的举报记录与处理进展。" />}
      rail={<ModerationSwitch active="reports" className="flex-col" />}
    >
      <section aria-labelledby="reports-list-heading">
        <div className="flex items-baseline justify-between border-b border-border/70 pb-2">
          <h2 id="reports-list-heading" className="section-heading">
            举报记录
          </h2>
          <span className="text-meta text-muted-foreground">按最近更新</span>
        </div>

        {reports.length === 0 ? (
          <div className="pt-4">
            <PageState
              kind="empty"
              title="暂无举报记录"
              description="探索不当内容时，可以通过举报帮助维护社区。"
            />
          </div>
        ) : (
          <ul aria-label="我的举报列表" className="flex flex-col">
            {reports.map((report) => (
              <FeedRow
                key={report.id}
                className="animate-rise-in"
                meta={
                  <time dateTime={report.updatedAt} className="tabular-nums">
                    {`最近更新 ${formatTime(report.updatedAt)}`}
                  </time>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption font-medium text-muted-foreground">
                    {objectTypeLabel(report.targetType)}
                  </span>
                  {/* Echoes unknown statuses verbatim rather than guessing. */}
                  <span className="rounded-pill bg-muted px-2 py-0.5 text-caption font-medium text-foreground">
                    {reportStatusLabel(report.status)}
                  </span>
                </div>
                {/* The subject, as the server describes it — never a UUID. */}
                <Link
                  to={`/reports/${encodeURIComponent(report.id)}`}
                  className="focus-ring mt-1 block text-h3 font-semibold text-foreground hover:text-accent-strong"
                >
                  {targetDescription(report)}
                </Link>
                <p className="mt-2 text-meta text-muted-foreground">
                  举报原因：{reportReasonLabel(report.reason)}
                </p>
              </FeedRow>
            ))}
          </ul>
        )}
      </section>
    </ArchetypeFrame>
  );
}
