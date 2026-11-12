import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { Conversation } from "@/api/messages/messages.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  MAX_GROUP_TITLE_LENGTH,
  canAdminister,
  filterGroups,
  groupHref,
  groupTitle,
  groupUpdatedLabel,
  joinModeNote,
  roleLabel,
  validateGroupTitle,
} from "../my-groups";

/*
 * /me/groups — 我的群聊 (Phase 3E)
 *
 * ONE READ, CLIENT-SIDE SPLIT. `GET /messages` returns DIRECT and GROUP rows in a
 * single bare array; there is no group-only endpoint. So this page reads the
 * mailbox and filters — which also means it is the SAME data the mailbox shows,
 * just narrowed. (This was the "same-source" objection recorded in §三·补13. It
 * is still a real gap, because the page the user needs is "my groups", and the
 * mailbox cannot answer that: it mixes DIRECT rows in with no way to separate
 * them, and offers no creation entry point. The page earns its route by being
 * the group-scoped VIEW plus the only CREATE surface.)
 *
 * ⚠️ GROUP CREATION IS REAL BUT MINIMAL. `POST /messages/group` takes ONLY
 *   `{ title }` (`ConversationService:225-241`): it hardcodes `joinMode = OPEN`
 *   and inserts ONE owner member row. There is NO invitee list — a new group
 *   always starts with exactly one member. So this page deliberately offers no
 *   "invite members" field: the endpoint would silently ignore it. Members are
 *   added afterwards from the group thread.
 *
 * ⚠️ LEGACY LINKED TO ROUTES IT NEVER DEFINED. Its page offered
 *   `/messages/groups/new` for creation and `/messages/group/{id}` per row —
 *   NEITHER existed in Legacy's own app router, so both 404'd. Here creation is
 *   an inline form (no route needed) and rows link to `/messages/:id`, which V2
 *   DOES serve for GROUP (the thread tries `getDirect`, then `getGroup`).
 *
 * ⚠️ NO ADMIN CONTROLS. The backend has owner/admin writes (settings,
 *   announcement, members, leave, remove-member) but this phase ships none of
 *   them, so a group the caller owns shows a role chip and nothing more. A
 *   "群设置" button with no page behind it is the fake-control anti-pattern.
 *
 * 骨架（A §3 `/me/*` 表 · MyGroups = SK2 · 幅/松/错）
 * -------------------------------------------------
 * H=幅：`PageHero` —— 有面横幅（边框 + 角落底色 + 几何母题 `motif-orbit`），
 *       与同域 SK6 页的 `PageMasthead`（无面）在首屏就能分开。
 * D=松：每条群聊是**独立卡面**，卡与卡之间走 `--density-grid-gap`、卡内走
 *       `--density-card-pad`，与「行式紧」的列表页是两种读法。
 * R=错：`rail` 存在 —— 右轨只放从 `filterGroups()` 结果派生的统计，没有新增请求。
 *
 * 同 SK 区分（本批 5 个 SK2）：本页是唯一「横幅 + 双列群聊卡 + 右侧统计轨」的
 * 组合；徽章页是「横幅 + 方形徽章块（无轨）」，探索页是「线头 + chip 行 + 轨」，
 * 收藏夹列表是「横幅 + 双链接卡」，公开收藏夹是「出血带 + 三列卡格」。
 *
 * 右栏刻意不复制群聊标题：`my-groups-page.test.tsx` 用 `getByText("前端交流")`
 * 断言卡面只有一处，右栏再印一遍标题会让那条查询变成「找到多个」。所以右轨只给
 * 计数（总数 / 未读合计 / 我管理的 / 角色分布），全部可从 `groups` 复核。
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; groups: Conversation[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function MyGroupsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    messagesApi
      .listConversations()
      .then((conversations) => {
        if (active) setState({ kind: "ready", groups: filterGroups(conversations) });
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

  const handleCreate = async () => {
    const validated = validateGroupTitle(draftTitle);
    if (!validated.ok) {
      setFormError(validated.message);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await messagesApi.createGroup(validated.title);
      // Prepend the new group rather than refetching: the mailbox is sorted
      // `updated_at DESC` by the mapper, and a just-created group belongs at the
      // top of that order.
      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", groups: [created, ...current.groups] }
          : { kind: "ready", groups: [created] },
      );
      setDraftTitle("");
      setCreating(false);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.problem.detail ? err.problem.detail : "创建失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
              : (state.detail ?? "无法读取你的群聊，请稍后重试。")
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

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <PageHero
          title="我的群聊"
          description="你参与或创建的群聊会话。"
          className="motif-orbit"
        />
      }
      /* 空态下不挂右轨：三块统计全是 0，只会把空态文案复述一遍。 */
      rail={state.groups.length > 0 ? <GroupsRail groups={state.groups} /> : null}
      railLabel="群聊侧栏"
    >
      {/*
        创建入口暂时下线（2026-10-06）。

        原因不是「还没做」，而是**做出来也没用**：`POST /messages/group` 只吃 title、
        硬编码 joinMode=OPEN、只建 1 个 OWNER 成员，而 V2 没有任何加成员 / 邀请的入口
        （群管理写端点刻意没有暴露）。也就是说新建的群永远只有一个人，旁人无法发现
        —— 一个用户可见的、必然产出死功能的按钮。

        保留 GROUP 数据模型、后端管理能力与本路由（读仍是真的）；等
        Group Messaging Product Phase 把「加成员 / 群发现 / 群主审批」补齐后再恢复。
      */}

      {/* 表单不属于页头：它出现时是页头之后的第一个区块，而不是标题的一部分。 */}
      {creating ? (
        <div className="rounded-card border border-border/70 bg-muted/40 p-[var(--density-card-pad)]">
          <label htmlFor="new-group-title" className="text-meta font-medium text-foreground">
            群聊名称
          </label>
          <div className="mt-2 flex max-w-md gap-2">
            <Input
              id="new-group-title"
              value={draftTitle}
              onChange={(event) => {
                setDraftTitle(event.target.value);
                setFormError(null);
              }}
              placeholder="例如：前端交流"
              aria-invalid={formError ? true : undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
            />
            <Button type="button" onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : "创建"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setCreating(false);
                setDraftTitle("");
                setFormError(null);
              }}
            >
              取消
            </Button>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">
            最多 {MAX_GROUP_TITLE_LENGTH} 个字符。
          </p>
          {formError ? (
            <p role="alert" className="mt-2 text-meta text-destructive">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.groups.length === 0 ? (
        <PageState kind="empty" title="暂无群聊" description="创建群聊，与创作者或读者交流。" />
      ) : (
        /* D=松：等权卡格，卡面 + 卡内 padding 都走密度变量。整卡是链接，所以
           `card-lift` 说的是真话；`focus-ring` 给键盘用户可见焦点。 */
        <ul
          aria-label="我的群聊列表"
          className="grid gap-[var(--density-grid-gap)] md:grid-cols-2"
        >
          {state.groups.map((group) => {
            const updated = groupUpdatedLabel(group.updatedAt);
            const role = roleLabel(group.myRole);
            const mode = joinModeNote(group.joinMode);
            return (
              <li key={group.id} className="flex">
                <Link
                  to={groupHref(group)}
                  className="card-lift focus-ring flex h-full w-full flex-col gap-3 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-h3 text-primary">{groupTitle(group)}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {role ? (
                        <span
                          data-testid={`group-role-${group.id}`}
                          className={cn(
                            "rounded-pill border px-2 py-0.5 text-caption",
                            canAdminister(group)
                              ? "border-border-strong text-primary"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {role}
                        </span>
                      ) : null}
                      {group.unreadCount > 0 ? (
                        <span
                          data-testid={`group-unread-${group.id}`}
                          className="rounded-pill bg-primary px-2 py-0.5 text-caption tabular-nums text-primary-foreground"
                        >
                          {group.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-auto text-caption text-muted-foreground">
                    {updated ? `最近更新 ${updated}` : "尚无消息"}
                    {mode ? ` · ${mode}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center">
        <Link to="/messages" className="focus-ring text-meta text-accent-strong hover:underline">
          去消息中心
        </Link>
      </p>
    </ArchetypeFrame>
  );
}

/**
 * 右栏（R=错）。四块都从 `filterGroups()` 之后的那份数组派生，**不印群聊标题**
 * （见文件顶部注释：卡片里的标题必须是文档里唯一一处）。
 */
function GroupsRail({ groups }: { groups: Conversation[] }) {
  const unread = groups.reduce((sum, group) => sum + (group.unreadCount || 0), 0);
  const administrable = groups.filter(canAdminister).length;
  const byRole = groups.reduce<Record<string, number>>((acc, group) => {
    const label = roleLabel(group.myRole);
    if (!label) return acc;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const roleRows = Object.entries(byRole);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="groups-rail-overview"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="groups-rail-overview" className="text-h3 text-primary">
          群聊概览
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">群聊数量</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {groups.length}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">未读消息</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">{unread}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">我管理的</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {administrable}
            </dd>
          </div>
        </dl>
      </section>

      {roleRows.length > 0 ? (
        <section
          aria-labelledby="groups-rail-roles"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="groups-rail-roles" className="text-h3 text-primary">
            我的角色
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {roleRows.map(([label, count]) => (
              <li key={label} className="flex items-baseline justify-between gap-3">
                <span className="text-meta text-foreground-soft">{label}</span>
                <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
