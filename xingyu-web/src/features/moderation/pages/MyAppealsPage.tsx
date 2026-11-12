import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import {
  APPEAL_LIST_LIMIT,
  appealStatusLabel,
  targetDescription,
  type AppealDetailView,
} from "@/api/moderation/moderation.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModerationSwitch } from "@/features/moderation/components/ModerationSwitch";

/*
 * My appeals (Phase 2J-2, reworked by the Governance Static Design收敛 pass).
 *
 * SHARES DESIGN LANGUAGE WITH /reports, BUT IS NOT THE SAME TEMPLATE.
 * Reports say "what did I report and where is it"; appeals say "what measure did
 * I contest and how was it decided". So each row leads with 针对什么处理 — the
 * original object as the server describes it, NEVER a caseId UUID — then the
 * appeal's own words, then the status/result (直接显示 已批准 / 已驳回) and time.
 * The word 「已决定」 must never appear: it was the old model's inability to say
 * approve-or-reject, which is exactly what this vocabulary replaced.
 *
 * `GET /me/appeals` returns a BARE array (no cursor), so this is one bounded
 * read with no pagination control.
 *
 * The appeal DTO carries no case status, so nothing is claimed about the case's
 * own progress — only the appeal's own status/outcome, which is authoritative.
 *
 * Only PENDING / APPROVED / REJECTED can occur; anything else echoes verbatim.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; appeals: AppealDetailView[] };

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

export function MyAppealsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    appealsApi
      .listMine(APPEAL_LIST_LIMIT)
      .then((appeals) => {
        if (active) setState({ kind: "ready", appeals });
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
              : (state.detail ?? "无法读取你的申诉记录，请稍后重试。")
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

  const { appeals } = state;
  /*
    SK6 信息流 · H=线 / D=紧 / R=齐（`.team/design/A-archetypes.md` §3 的 MyAppeals 行）。

    与 /reports 共用同一套骨架与同一份切换器组件，但两者不是同一个模板：

      H=线：`PageMasthead` 无面页头，替掉改前手写的 `<header>` + `text-2xl`（A §4 点名的
        30 处之一）。
      D=紧：条目是「行」。`FeedRow` 自带发丝线、无逐项卡面；改前是「一张大卡 + divide-y」。
      R=齐：**没有侧轨** —— 切换器与「查看社区规则」都留在主列，与行流同宽同边。R=错 留给了
        /reports 与 /appeals/:id，本页要保持「一条竖列读到底」的节奏，否则两页会读成同一个
        页面换了标题。

    行内容一字未动：先是「针对：<对象描述>」（绝不渲染 caseId），再是状态、申诉正文、时间。
    行的错峰入场去掉了（理由同 MyReportsPage：行流是连续读数，逐行延迟只会让人等）。
  */
  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead title="我的申诉" description="你对社区治理措施提交的申诉及裁定结果。" />
      }
    >
      <ModerationSwitch active="appeals" />

      <section aria-labelledby="appeals-list-heading">
        <div className="flex items-baseline justify-between border-b border-border/70 pb-2">
          <h2 id="appeals-list-heading" className="section-heading">
            申诉记录
          </h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-meta text-muted-foreground">最多 {APPEAL_LIST_LIMIT} 条</span>
        </div>

        {appeals.length === 0 ? (
          <div className="pt-4">
            <PageState
              kind="empty"
              title="暂无申诉记录"
              description="当你针对某项社区治理处置提交过申诉后，它会出现在这里。"
            />
          </div>
        ) : (
          <ul aria-label="我的申诉列表" className="flex flex-col">
            {appeals.map((appeal) => (
              <FeedRow
                key={appeal.id}
                className="animate-rise-in"
                meta={
                  <time dateTime={appeal.createdAt} className="tabular-nums">
                    {formatTime(appeal.createdAt)}
                  </time>
                }
              >
                {/* 针对什么处理 —— 对象描述，绝不渲染 caseId/UUID */}
                <p className="text-meta text-muted-foreground">针对：{targetDescription(appeal)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-muted px-2 py-0.5 text-caption font-medium text-foreground">
                    {appealStatusLabel(appeal.status)}
                  </span>
                </div>
                <Link
                  to={`/appeals/${encodeURIComponent(appeal.id)}`}
                  className="focus-ring mt-1 block whitespace-pre-wrap text-body leading-6 text-foreground hover:text-accent-strong"
                >
                  {appeal.body?.trim() || "（无内容）"}
                </Link>
              </FeedRow>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center">
        <Link to="/guide" className={buttonVariants({ variant: "outline", className: "text-sm" })}>
          查看社区规则
        </Link>
      </p>
    </ArchetypeFrame>
  );
}
