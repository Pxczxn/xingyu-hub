import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Plus, UsersRound } from "lucide-react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { Conversation } from "@/api/messages/messages.types";
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
  }, []);

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
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
              <UsersRound className="h-5 w-5" aria-hidden />
              我的群聊
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              你参与或创建的群聊会话。新建的群聊只有你一个成员，之后可以在群聊里添加成员。
            </p>
          </div>
          {!creating ? (
            <Button type="button" variant="outline" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              创建群聊
            </Button>
          ) : null}
        </div>

        {creating ? (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
            <label htmlFor="new-group-title" className="text-sm font-medium text-foreground">
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
                {submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  "创建"
                )}
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
            <p className="mt-2 text-xs text-muted-foreground">
              最多 {MAX_GROUP_TITLE_LENGTH} 个字符。
            </p>
            {formError ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {state.groups.length === 0 ? (
        <PageState kind="empty" title="暂无群聊" description="创建群聊，与创作者或读者交流。" />
      ) : (
        <ul aria-label="我的群聊列表" className="grid gap-3">
          {state.groups.map((group) => {
            const updated = groupUpdatedLabel(group.updatedAt);
            const role = roleLabel(group.myRole);
            const mode = joinModeNote(group.joinMode);
            return (
              <li key={group.id}>
                <Link
                  to={groupHref(group)}
                  className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {groupTitle(group)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {updated ? `最近更新 ${updated}` : "尚无消息"}
                        {mode ? ` · ${mode}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {role ? (
                        <span
                          data-testid={`group-role-${group.id}`}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs",
                            canAdminister(group)
                              ? "border-accent/50 text-accent"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {role}
                        </span>
                      ) : null}
                      {group.unreadCount > 0 ? (
                        <span
                          data-testid={`group-unread-${group.id}`}
                          className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                        >
                          {group.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center">
        <Link to="/messages" className="text-sm text-accent hover:underline">
          去消息中心
        </Link>
      </p>
    </div>
  );
}
