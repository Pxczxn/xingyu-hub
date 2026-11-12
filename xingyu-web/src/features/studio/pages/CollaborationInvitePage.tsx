import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type {
  CollaborationInvite,
  CollaborationParticipant,
} from "@/api/collaboration/collaboration.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACCEPTANCE_BOUNDARY_NOTE,
  INVITE_NOTE_MAX_LENGTH,
  absoluteInviteUrl,
  formatExpiry,
  inviteLifetimeHint,
  normalizeNote,
} from "../collaboration-invite";

/*
 * /studio/collaboration — 邀请协作 (Phase 2M)
 *
 * 骨架迁移（批次 D）：SK5 流程 · H 线 / D 松 / R 齐
 * --------------------------------------------------
 *   SK5  `ArchetypeFrame skeleton="SK5"` 给出居中窄栏（`SOLO.SK5` = 720）。流程页
 *        的终点是**一个**动作：生成邀请链接。所以提交按钮不在表单中部，而是粘在
 *        视口底部（`sticky bottom-0` 的收尾条），滚动到哪儿都只差一步按下。
 *   H=线：页头用 `PageMasthead`（无面 masthead，它自带 `h1`）；页面不再手写标题，
 *        所以整页恰好 1 个 h1。
 *   D=松：字段组各是一块独立面（卡内 padding 24、块间 24），由 frame 的
 *        `density="loose"` 提供。
 *   R=齐：没有侧轨、没有出血带 —— 窄栏之内所有块同宽同边。
 *
 * 为什么不用 `StepFlow`：它把子内容硬编码成 `density-compact`（`StepFlow.tsx:111`），
 * 会把本页声明的 D=松 抹掉；这里只借它那条粘底条的形状（同样的 `z-rail` + 半透明 +
 * backdrop-blur），密度交给 `ArchetypeFrame`。
 *
 * Creates a shareable 7-day invite link. The accepter becomes an EDITOR on the
 * inviter's drafts. Submit and trash stay with the author; the page says that.
 *
 * `inviteUrl` is RELATIVE (`/studio/collaboration/accept?token=...`). It is
 * made absolute here before being shown or copied.
 */

type CreatedState =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "created"; invite: CollaborationInvite }
  | { kind: "failed"; message: string };

type CopyState = "idle" | "copied" | "failed";

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail?.trim() || fallback;
  }
  return fallback;
}

export function CollaborationInvitePage() {
  const [note, setNote] = useState("");
  const [state, setState] = useState<CreatedState>({ kind: "idle" });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [editors, setEditors] = useState<CollaborationParticipant[]>([]);
  const [hosts, setHosts] = useState<CollaborationParticipant[]>([]);
  const pendingRef = useRef(false);

  const reloadMemberships = useCallback(() => {
    return Promise.all([collaborationApi.listEditors(), collaborationApi.listHosts()]).then(
      ([nextEditors, nextHosts]) => {
        setEditors(nextEditors);
        setHosts(nextHosts);
      },
    );
  }, []);

  useEffect(() => {
    let active = true;
    void reloadMemberships().catch(() => {
      if (!active) return;
      setEditors([]);
      setHosts([]);
    });
    return () => {
      active = false;
    };
  }, [reloadMemberships]);

  async function removeEditor(member: CollaborationParticipant) {
    await collaborationApi.removeEditor(member.userId);
    setEditors((current) => current.filter((item) => item.userId !== member.userId));
  }

  async function leaveHost(host: CollaborationParticipant) {
    await collaborationApi.leaveHost(host.userId);
    setHosts((current) => current.filter((item) => item.userId !== host.userId));
  }

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pendingRef.current) return;
      pendingRef.current = true;
      setState({ kind: "creating" });
      setCopyState("idle");
      try {
        const invite = await collaborationApi.createInvite(normalizeNote(note));
        setState({ kind: "created", invite });
      } catch (error) {
        const status = error instanceof ApiError ? error.problem.status : 0;
        if (status === 401) {
          setState({ kind: "failed", message: "登录状态已过期，请重新登录后再试。" });
        } else {
          setState({ kind: "failed", message: describeError(error, "创建邀请失败，请稍后重试。") });
        }
      } finally {
        pendingRef.current = false;
      }
    },
    [note],
  );

  const shareUrl =
    state.kind === "created"
      ? absoluteInviteUrl(state.invite.inviteUrl, window.location.origin)
      : "";

  const copy = useCallback(async () => {
    try {
      // Copy the ABSOLUTE url, from state — never the relative path, and never
      // out of the DOM.
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [shareUrl]);

  const reset = useCallback(() => {
    setState({ kind: "idle" });
    setNote("");
    setCopyState("idle");
  }, []);

  return (
    <ArchetypeFrame
      skeleton="SK5"
      header="line"
      density="loose"
      headerSlot={
        <div className="flex flex-col gap-3">
          <Link
            to="/studio"
            className="focus-ring inline-flex w-fit items-center gap-1 rounded-sm text-meta text-accent-strong hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回创作中心
          </Link>
          <PageMasthead
            title="邀请协作"
            description="生成一条邀请链接，发给你想一起创作的人。"
          />
        </div>
      }
    >
      {/* The boundary notice sits ABOVE the form, not below it: the user should
          read what accepting does and does not do BEFORE they send the link. */}
      <p
        data-testid="collaboration-boundary"
        className="rounded-control border border-border bg-surface-sunken/60 p-3 text-meta leading-6 text-muted-foreground"
      >
        {ACCEPTANCE_BOUNDARY_NOTE}
      </p>

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]">
          <label htmlFor="collaboration-note" className="text-meta font-medium text-foreground">
            邀请备注（可选）
          </label>
          <Input
            id="collaboration-note"
            data-testid="collaboration-note"
            value={note}
            maxLength={INVITE_NOTE_MAX_LENGTH}
            disabled={state.kind === "creating"}
            onChange={(event) => setNote(event.target.value)}
            placeholder="想先说明一下来意吗？"
          />
          <p className="text-caption text-muted-foreground">
            {note.length}/{INVITE_NOTE_MAX_LENGTH} 字，会随邀请一起展示给对方。
          </p>
        </div>

        {state.kind === "failed" ? (
          <p
            role="alert"
            data-testid="collaboration-error"
            className="rounded-control border border-destructive/40 bg-card p-3 text-meta text-destructive"
          >
            {state.message}
          </p>
        ) : null}

        {/* 粘底操作条：SK5 的终点动作。刻意用边框而不是阴影（E1 只给离开文档流的
            浮层，B §3），半透明 + blur 让被压在下面的字段仍然可读。 */}
        <div className="sticky bottom-0 z-rail -mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <span className="text-caption text-muted-foreground">{inviteLifetimeHint()}</span>
          <Button
            type="submit"
            size="sm"
            data-testid="collaboration-create"
            disabled={state.kind === "creating"}
          >
            {state.kind === "creating" ? "生成中…" : "生成邀请链接"}
          </Button>
        </div>
      </form>

      {state.kind === "created" ? (
        <div
          className="flex flex-col gap-3 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
          data-testid="collaboration-result"
        >
          <h2 className="section-heading">邀请链接已生成</h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="collaboration-link" className="text-meta text-muted-foreground">
              邀请链接
            </label>
            <code
              id="collaboration-link"
              data-testid="collaboration-link"
              className="block break-all rounded-control border border-border bg-surface-sunken px-3 py-2 font-mono text-caption text-foreground"
            >
              {shareUrl}
            </code>
          </div>

          {state.invite.note?.trim() ? (
            <p className="text-meta text-muted-foreground">备注：{state.invite.note}</p>
          ) : null}

          <p className="text-caption text-muted-foreground">
            {formatExpiry(state.invite.expiresAt)
              ? `有效期至 ${formatExpiry(state.invite.expiresAt)}`
              : "有效期由服务端决定，请尽快发送。"}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" data-testid="collaboration-copy" onClick={() => void copy()}>
              {copyState === "copied" ? "已复制" : "复制链接"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="collaboration-reset"
              onClick={reset}
            >
              再创建一条
            </Button>
          </div>

          {copyState === "copied" ? (
            <p data-testid="collaboration-copy-status" className="text-caption text-muted-foreground">
              已复制到剪贴板。
            </p>
          ) : null}
          {copyState === "failed" ? (
            <p
              role="alert"
              data-testid="collaboration-copy-status"
              className="text-caption text-destructive"
            >
              复制失败，请手动选中上面的链接复制。
            </p>
          ) : null}

          {/* Restates the limit next to the artifact the user is about to
              send, so the honest note cannot be missed by scrolling past it. */}
          <p className="text-caption leading-5 text-muted-foreground">{ACCEPTANCE_BOUNDARY_NOTE}</p>
        </div>
      ) : null}

      <section
        aria-labelledby="collaboration-editors"
        className="flex flex-col gap-[var(--density-heading-gap)]"
      >
        <h2 id="collaboration-editors" className="section-heading">
          可以编辑我的草稿的人
        </h2>
        {editors.length === 0 ? (
          <p className="text-meta text-muted-foreground">还没有人接受邀请。</p>
        ) : (
          <ul className="flex list-none flex-col divide-y divide-border/70 border-y border-border/70 p-0">
            {editors.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 py-[var(--density-list-gap)] text-meta"
              >
                <span className="min-w-0 truncate text-foreground">
                  {member.displayName.trim() || member.username}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void removeEditor(member)}
                >
                  {`移除 ${member.username}`}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="collaboration-hosts"
        className="flex flex-col gap-[var(--density-heading-gap)]"
      >
        <h2 id="collaboration-hosts" className="section-heading">
          我可以编辑的创作
        </h2>
        {hosts.length === 0 ? (
          <p className="text-meta text-muted-foreground">你还没有加入别人的创作。</p>
        ) : (
          <ul className="flex list-none flex-col divide-y divide-border/70 border-y border-border/70 p-0">
            {hosts.map((host) => (
              <li
                key={host.userId}
                className="flex items-center justify-between gap-3 py-[var(--density-list-gap)] text-meta"
              >
                <span className="min-w-0 truncate text-foreground">
                  {host.displayName.trim() || host.username}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void leaveHost(host)}
                >
                  {`退出 ${host.username}`}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ArchetypeFrame>
  );
}
