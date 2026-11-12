import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { ApiError } from "@/api/client";
import { apiTokensApi } from "@/api/settings/api-tokens.api";
import {
  API_TOKEN_NAME_MAX_LENGTH,
  API_TOKEN_STATUS_ACTIVE,
  type ApiTokenSummary,
} from "@/api/settings/api-tokens.types";
import { PageState } from "@/components/shared/PageState";
import { ArchetypeFrame, TableFrame } from "@/components/layout";
import { PageSection } from "@/components/shared/PageSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiTokenSecretPanel } from "@/features/settings/api-tokens/ApiTokenSecretPanel";
import { validateApiTokenName } from "@/features/settings/api-tokens/token-name";

/*
 * /settings/api-tokens — API Token management (Phase 2A-2b).
 *
 * Real contract (verified live 2026-09-23):
 *   GET    /api/v1/me/api-tokens        -> ApiTokenSummary[] (200, bare array, limit only)
 *   POST   /api/v1/me/api-tokens        -> ApiTokenCreated   (200, carries the secret ONCE)
 *   DELETE /api/v1/me/api-tokens/{id}   -> 204 (idempotent; unknown/foreign id -> 404)
 *
 * Offered here: list / create / one-time secret reveal / copy / revoke.
 * Deliberately NOT offered (the backend has no such capability):
 *   - rename   (PATCH/PUT -> 405)
 *   - expiry   (expiry keys are silently dropped; no expiresAt in any DTO)
 *   - scopes   (real, but a fixed two-value set that defaults to both — no
 *               picker is built, per the "do not expand" rule; the field is
 *               recorded in the report instead)
 *
 * Revoked tokens stay in the list (`status: "REVOKED"`), so they are shown with
 * a badge and no revoke action rather than being silently hidden.
 *
 * 🔒 Secret lifecycle: the secret exists ONLY in `secret` below — a piece of
 * component state set from the create response and cleared by "我已保存". It is
 * never persisted, never logged, never put in the URL, and never re-derivable
 * (the backend keeps only the hash). After dismiss there is no "show again".
 *
 * --- 2026-10-03 structure pass ---------------------------------------------
 * The old page was three flat sections of the same weight: a heading, a bare
 * form row, then a stack of bordered cards. Nothing distinguished "make a new
 * one" from "the ones you already have", even though those are two different
 * jobs done at different times.
 *
 * It is now a TWO-STAGE page with a visible seam:
 *
 *   stage 1  GENERATOR — a tinted panel that produces a token. One field, one
 *            button, and it is the only accented surface on the page, because
 *            creating is the rare, deliberate act.
 *   stage 2  INVENTORY — the tokens that exist, as compact divided rows inside a
 *            single container rather than a card each.
 *
 * The one-time secret panel sits between them, where it belongs: it is the output
 * of stage 1 and it is the only thing on this page that can never be recovered.
 * ---------------------------------------------------------------------------
 *
 * --- 2026-11-10 批次 C：SK3 · 壳 / 表 / 齐 -------------------------------
 * 上一段第 2 点被推翻（映射表把本域的「表」给了本页与邮箱页，把「紧」给了会话与
 * 屏蔽），差别是可判定的：Token 有**四个可跨行比较的列**（名称 / 前缀 / 状态 /
 * 两个时间），会话与屏蔽没有。于是 stage 2 换成 `TableFrame`：
 *
 *   表  表头带（`surface-sunken`）+ 对齐列 + `<caption>` + 空态槽；状态用「6px 圆点 +
 *       文字」（B §4 语义色规则），已撤销行整行降为 `muted-foreground`，不给整行上色。
 *   齐  无侧栏：`ArchetypeFrame skeleton="SK3"` 不传 `rail`。
 *   壳  h1「设置」由 `SettingsLayout` 出，本页只出 h2「API Token」。
 * 创建 / 一次性 secret / 撤销确认 / 重复点击守卫一行未动；`<form>` 仍然只有创建那一个
 * （测试用 `container.querySelector("form")` 取它）。
 */

type LoadState = "loading" | "error" | "ready";

function formatInstant(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function SettingsApiTokensPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);

  // The one-time secret. Memory only; cleared on dismiss.
  const [secret, setSecret] = useState<{ name: string; token: string } | null>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Handler-level duplicate-click guards (not only `disabled`) — see SKILL §7e.
  const createPendingRef = useRef(false);
  const revokePendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    apiTokensApi
      .list()
      .then((list) => {
        if (!active) return;
        setTokens(list);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const create = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault(); // explicit submit only
      if (createPendingRef.current) return; // duplicate-click guard
      const validationError = validateApiTokenName(name); // re-checked in the handler
      if (validationError) {
        setNameError(validationError);
        return;
      }
      createPendingRef.current = true;
      setCreating(true);
      setNameError(null);
      setCreateError(null);
      try {
        const created = await apiTokensApi.create(name.trim());
        // Hold the secret in memory only, then forget the name field.
        setSecret({ name: created.name, token: created.token });
        setName("");
        try {
          setTokens(await apiTokensApi.list());
        } catch {
          // The token WAS created; only the list refresh failed. Do not invent
          // a row — just ask for a manual reload.
          setCreateError("Token 已创建，但列表刷新失败，请重新加载页面。");
        }
      } catch (error) {
        // No fake token on failure.
        setCreateError(
          error instanceof ApiError ? error.problem.detail : "创建 Token 失败，请稍后重试。",
        );
      } finally {
        createPendingRef.current = false;
        setCreating(false);
      }
    },
    [name],
  );

  const revoke = useCallback(async (tokenId: string) => {
    if (revokePendingRef.current) return; // duplicate-click guard
    revokePendingRef.current = true;
    setRevokingId(tokenId);
    setActionError(null);
    try {
      await apiTokensApi.revoke(tokenId);
      setConfirmingId(null);
      try {
        setTokens(await apiTokensApi.list()); // real re-fetch, no optimistic removal
      } catch {
        setActionError("Token 已撤销，但列表刷新失败，请重新加载页面。");
      }
    } catch (error) {
      // Keep the list exactly as the backend last reported it.
      setActionError(
        error instanceof ApiError ? error.problem.detail : "撤销 Token 失败，请稍后重试。",
      );
    } finally {
      revokePendingRef.current = false;
      setRevokingId(null);
    }
  }, []);

  if (loadState === "loading") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
        <PageState kind="loading" />
      </ArchetypeFrame>
    );
  }
  if (loadState === "error") {
    return (
      <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
        <PageState kind="error" title="Token 列表加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </ArchetypeFrame>
    );
  }

  const activeCount = tokens.filter((token) => token.status === API_TOKEN_STATUS_ACTIVE).length;

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
      <PageSection
        id="settings-api-tokens-heading"
        title="API Token"
        count={tokens.length}
        description="用于以你的身份访问开放 API。Token 只在创建时显示一次，请立即复制并妥善保存。"
      >
        {/* ---------------------------------------------------------- stage 1 */}
        <section
          aria-labelledby="settings-api-tokens-create-heading"
          className="mb-4 rounded-card border border-border/70 bg-card p-4"
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-surface-sunken text-foreground-soft"
              aria-hidden
            >
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3
                id="settings-api-tokens-create-heading"
                className="text-card font-semibold text-primary"
              >
                创建 Token
              </h3>
              <p className="mt-0.5 text-meta text-muted-foreground">
                给这个 Token 起一个能让你日后认出来的名字，例如它将被哪个工具使用。
              </p>

              <form
                className="mt-3 flex flex-wrap items-end gap-3"
                onSubmit={(event) => void create(event)}
              >
                <div className="min-w-0 flex-1">
                  <Label htmlFor="api-token-name">名称</Label>
                  <Input
                    id="api-token-name"
                    name="name"
                    className="mt-1"
                    value={name}
                    maxLength={API_TOKEN_NAME_MAX_LENGTH}
                    placeholder="例如 CI 同步"
                    aria-invalid={nameError ? true : undefined}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (nameError) setNameError(null);
                    }}
                  />
                </div>
                <Button type="submit" disabled={creating} data-testid="api-token-create-submit">
                  {creating ? "创建中…" : "创建 Token"}
                </Button>
              </form>

              {nameError ? (
                <p
                  role="alert"
                  data-testid="api-token-name-error"
                  className="mt-2 text-meta text-destructive"
                >
                  {nameError}
                </p>
              ) : null}
              {createError ? (
                <p
                  role="alert"
                  data-testid="api-token-create-error"
                  className="mt-2 text-meta text-destructive"
                >
                  {createError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ------------------------------------------- the one-time output */}
        {secret ? (
          <ApiTokenSecretPanel
            name={secret.name}
            secret={secret.token}
            onDismiss={() => setSecret(null)}
          />
        ) : null}

        {/* ---------------------------------------------------------- stage 2 */}
        <section aria-labelledby="settings-api-tokens-list-heading" className="mt-4">
          <div className="mb-3 flex items-baseline gap-2.5">
            <h3
              id="settings-api-tokens-list-heading"
              className="text-card font-semibold text-primary"
            >
              已有 Token
            </h3>
            {tokens.length > 0 ? (
              <span className="text-meta tabular-nums text-muted-foreground">
                {activeCount} 个有效 / {tokens.length} 个合计
              </span>
            ) : null}
          </div>

          {actionError ? (
            <p
              role="alert"
              data-testid="api-token-action-error"
              className="mb-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-meta text-destructive"
            >
              {actionError}
            </p>
          ) : null}

          {/*
            D=表：Token 是"可比较的记录"（名称 / 前缀 / 状态 / 两个时间），所以用
            `TableFrame`：表头带 + 对齐列 + 空态槽，而不是每行一张卡或一条发丝线。
            这正是本页与 /settings/sessions、/settings/blocks（都是「紧」）的区别 ——
            那两页没有跨行比较的列，本页有。
          */}
          <div data-testid="api-token-list">
            <TableFrame
              caption="API Token"
              emptyState={
                tokens.length === 0 ? (
                  <PageState kind="empty" title="还没有创建任何 Token" />
                ) : undefined
              }
            >
              <thead>
                <tr>
                  <th scope="col">名称</th>
                  <th scope="col">前缀</th>
                  <th scope="col">状态</th>
                  <th scope="col">创建时间</th>
                  <th scope="col">最近使用</th>
                  <th scope="col" className="text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const revoked = token.status !== API_TOKEN_STATUS_ACTIVE;
                  return (
                    <tr
                      key={token.id}
                      data-testid={`api-token-${token.id}`}
                      className={revoked ? "text-muted-foreground" : undefined}
                    >
                      <th scope="row" className="whitespace-nowrap text-primary">
                        {token.name}
                      </th>
                      <td>
                        <code
                          data-testid={`api-token-prefix-${token.id}`}
                          className="rounded-chip bg-surface-sunken px-1.5 py-0.5 font-mono text-caption text-foreground-soft"
                        >
                          {token.tokenPrefix}…
                        </code>
                      </td>
                      <td>
                        {revoked ? (
                          <span
                            data-testid={`api-token-status-${token.id}`}
                            className="whitespace-nowrap text-meta"
                          >
                            已撤销
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-meta text-success">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-pill bg-success"
                            />
                            有效
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-meta">
                        <span
                          data-testid={`api-token-created-${token.id}`}
                          className="tabular-nums text-foreground-soft"
                        >
                          {formatInstant(token.createdAt)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-meta">
                        <span
                          data-testid={`api-token-lastused-${token.id}`}
                          className="tabular-nums text-foreground-soft"
                        >
                          {token.lastUsedAt ? formatInstant(token.lastUsedAt) : "从未使用"}
                        </span>
                      </td>
                      <td className="text-right">
                        {revoked ? (
                          <span className="text-meta text-muted-foreground">—</span>
                        ) : confirmingId === token.id ? (
                          <div
                            data-testid={`api-token-revoke-prompt-${token.id}`}
                            className="flex flex-col items-end gap-1.5"
                          >
                            <p className="max-w-[16rem] text-meta leading-6 text-foreground">
                              撤销后，使用此 Token 的客户端将无法继续通过它访问 API。
                            </p>
                            <span className="flex items-center gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={revokingId !== null}
                                data-testid={`api-token-confirm-revoke-${token.id}`}
                                onClick={() => void revoke(token.id)}
                              >
                                {revokingId === token.id ? "撤销中…" : "确认撤销"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`api-token-cancel-revoke-${token.id}`}
                                onClick={() => setConfirmingId(null)}
                              >
                                取消
                              </Button>
                            </span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revokingId !== null}
                            data-testid={`api-token-revoke-${token.id}`}
                            onClick={() => setConfirmingId(token.id)}
                          >
                            撤销
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableFrame>
          </div>
        </section>
      </PageSection>
    </ArchetypeFrame>
  );
}
