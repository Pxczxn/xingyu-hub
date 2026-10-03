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
 *            single container rather than a card each. A row is an IDENTITY PAIR
 *            (name + prefix) with a lifecycle, not a record with comparable
 *            columns, so it is deliberately NOT the table used on
 *            /settings/sessions — there is nothing to scan down.
 *
 * The one-time secret panel sits between them, where it belongs: it is the output
 * of stage 1 and it is the only thing on this page that can never be recovered.
 * ---------------------------------------------------------------------------
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

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" title="Token 列表加载失败" description="请稍后重试。" />
        <div>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const activeCount = tokens.filter((token) => token.status === API_TOKEN_STATUS_ACTIVE).length;

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-api-tokens-heading">
        <div className="flex items-baseline gap-2.5">
          <h2 id="settings-api-tokens-heading" className="section-heading">
            API Token
          </h2>
          <span className="text-meta tabular-nums text-muted-foreground">{tokens.length}</span>
        </div>
        <p className="lede mt-1.5 max-w-2xl">
          用于以你的身份访问开放 API。Token 只在创建时显示一次，请立即复制并妥善保存。
        </p>
      </section>

      {/* ---------------------------------------------------------- stage 1 */}
      <section
        aria-labelledby="settings-api-tokens-create-heading"
        className="rounded-xl border border-accent-line/50 bg-accent-soft/40 p-4"
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-accent-strong"
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
                  className="mt-1 bg-card"
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
      <section aria-labelledby="settings-api-tokens-list-heading">
        <div className="mb-3 flex items-baseline gap-2.5">
          <h3
            id="settings-api-tokens-list-heading"
            className="text-card font-semibold text-primary"
          >
            已有 Token
          </h3>
          {tokens.length > 0 ? (
            <span className="text-meta text-muted-foreground">
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

        {tokens.length === 0 ? (
          <PageState kind="empty" title="还没有创建任何 Token" />
        ) : (
          <div
            data-testid="api-token-list"
            className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card"
          >
            {tokens.map((token) => {
              const revoked = token.status !== API_TOKEN_STATUS_ACTIVE;
              return (
                <div
                  key={token.id}
                  data-testid={`api-token-${token.id}`}
                  className={revoked ? "p-4 opacity-70" : "p-4"}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="text-card font-medium text-primary">{token.name}</p>
                    <code
                      data-testid={`api-token-prefix-${token.id}`}
                      className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {token.tokenPrefix}…
                    </code>
                    {revoked ? (
                      <span
                        data-testid={`api-token-status-${token.id}`}
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        已撤销
                      </span>
                    ) : (
                      <span className="rounded border border-accent-line/70 px-1.5 py-0.5 text-[11px] text-accent-strong">
                        有效
                      </span>
                    )}

                    <span className="ml-auto flex shrink-0 items-center gap-3">
                      <span className="text-meta text-muted-foreground">
                        创建于{" "}
                        <span
                          data-testid={`api-token-created-${token.id}`}
                          className="tabular-nums text-foreground-soft"
                        >
                          {formatInstant(token.createdAt)}
                        </span>
                      </span>
                      <span className="hidden text-meta text-muted-foreground sm:inline">
                        最近使用{" "}
                        <span
                          data-testid={`api-token-lastused-${token.id}`}
                          className="tabular-nums text-foreground-soft"
                        >
                          {token.lastUsedAt ? formatInstant(token.lastUsedAt) : "从未使用"}
                        </span>
                      </span>
                    </span>
                  </div>

                  {revoked ? null : confirmingId === token.id ? (
                    <div
                      data-testid={`api-token-revoke-prompt-${token.id}`}
                      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.04] p-3"
                    >
                      <p className="min-w-0 flex-1 text-meta text-foreground">
                        撤销后，使用此 Token 的客户端将无法继续通过它访问 API。
                      </p>
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
                    </div>
                  ) : (
                    <div className="mt-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokingId !== null}
                        data-testid={`api-token-revoke-${token.id}`}
                        onClick={() => setConfirmingId(token.id)}
                      >
                        撤销
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
