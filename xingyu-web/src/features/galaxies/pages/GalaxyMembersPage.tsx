import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { galaxiesApi } from "@/api/galaxies/galaxies.api";
import type { GalaxyMember } from "@/api/galaxies/galaxies.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { formatJoinedAt, galaxyMemberRoleLabel } from "../galaxy-labels";
import { GalaxyShell } from "../GalaxyShell";

type LoadState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; members: GalaxyMember[] };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Galaxy member roster (Phase 2H).
 *
 * Backend: `GET /api/v1/galaxies/{slug}/members?limit=N`, default 50. There is
 * no pagination cursor, so the list is capped rather than paged — a galaxy with
 * more members than the cap simply shows the first N.
 */
export function GalaxyMembersPage() {
  return (
    <GalaxyShell activeTab="members">
      {(galaxy) => <GalaxyMembers slug={galaxy.slug} />}
    </GalaxyShell>
  );
}

const MEMBER_LIMIT = 50;

/** 管理身份计数：OWNER 与 ADMIN 同属「管理者」，未知角色不计入任何一侧。 */
function managerCount(members: GalaxyMember[]): number {
  return members.filter((member) => {
    const role = (member.role ?? "").trim().toUpperCase();
    return role === "OWNER" || role === "ADMIN";
  }).length;
}

/** 最近一次加入的时间戳；缺失或不可解析一律当 0，让它们排到最后。 */
function joinedAtMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function GalaxyMembers({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    galaxiesApi
      .listMembers(slug, MEMBER_LIMIT)
      .then((members) => {
        if (active) setState({ kind: "ready", members });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "ready" : "error", members: [] } as LoadState);
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="成员加载失败" description="请稍后重试。" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const { members } = state;
  const managers = managerCount(members);
  const latest = [...members].sort((a, b) => joinedAtMs(b.joinedAt) - joinedAtMs(a.joinedAt))[0];

  /*
   * SK3 控制台 · H 壳 / D 紧 / R 齐（A §3 的 GalaxyMembers 行）。
   *
   *   skeleton="SK3"    → 控制台栅格。**不传 `rail`**，于是 `SOLO.SK3` 生效：
   *                       只有一列，所有区块与内容列同宽同边 —— 这就是 R=齐。
   *   header="shell"    → H=壳：标题由 `GalaxyShell` 出（`GalaxyShell.tsx:363`）。
   *                       A 类壳（A §7.2）→ 页内**不得再出 h1**，本文件没有 h1，
   *                       标题层级从 h2（`.section-heading`）起。
   *   density="compact" → D=紧：成员是**发丝线行**，没有逐项卡面（`FeedRow` 自带
   *                       `border-b` 分隔）。A §1 的 SK3 解剖是从「量化带」开始，
   *                       所以行流之前先给一条由 `members` 派生的计数带。
   *
   * 与同域 GalaxyDetailPage（SK3·壳/松/错）的一眼之别：本页**无轨 + 发丝线行**，
   * 详情页**有右轨 + 独立卡面**。
   *
   * 量化带的三个数字全部可由本页已取回的 `members` 复核（总数 / 管理者数 /
   * 最近加入），不新增请求，也不编造后端没有的「活跃度」类指标。
   */
  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="compact">
      <section aria-labelledby="galaxy-members-summary">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="galaxy-members-summary" className="section-heading">
            成员概览
          </h2>
          <p className="text-meta tabular-nums text-muted-foreground">
            共 {members.length} 位公开成员
          </p>
        </div>
        <dl className="mt-4 grid gap-4 rounded-card border border-border/70 bg-card p-4 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-muted-foreground">公开成员</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums text-primary">
              {members.length}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">管理者</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums text-primary">{managers}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">最近加入</dt>
            <dd className="mt-1 text-meta text-foreground-soft">
              {latest ? formatJoinedAt(latest.joinedAt) : "暂无记录"}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="galaxy-members-roster">
        <h2 id="galaxy-members-roster" className="section-heading mb-2">
          名册
        </h2>
        {members.length === 0 ? (
          <PageState kind="empty" title="暂无公开成员" description="成员加入后会显示在这里。" />
        ) : (
          <ul className="flex flex-col">
            {members.map((member) => {
              const name = member.displayName || member.username;
              return (
                <FeedRow
                  key={member.userId}
                  lead={
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-sunken text-sm font-semibold text-foreground">
                      {name.trim().charAt(0).toUpperCase()}
                    </span>
                  }
                  meta={
                    <time dateTime={member.joinedAt ?? undefined} className="tabular-nums">
                      {formatJoinedAt(member.joinedAt)}
                    </time>
                  }
                >
                  <Link
                    to={`/u/${encodeURIComponent(member.username)}`}
                    className="focus-ring group inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-sm"
                  >
                    <span className="truncate text-card font-semibold text-primary transition-colors group-hover:text-accent-strong">
                      {name}
                    </span>
                    <span className="truncate text-meta text-muted-foreground">
                      @{member.username}
                    </span>
                  </Link>
                  <span className="mt-1 inline-flex rounded-full bg-surface-sunken px-2 py-0.5 text-caption text-muted-foreground">
                    {galaxyMemberRoleLabel(member.role)}
                  </span>
                </FeedRow>
              );
            })}
          </ul>
        )}
      </section>
    </ArchetypeFrame>
  );
}
