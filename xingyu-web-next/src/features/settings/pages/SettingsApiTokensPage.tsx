import { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <div className="section-gap">
      <section aria-labelledby="settings-api-tokens-heading">
        <h2 id="settings-api-tokens-heading" className="text-base font-semibold text-primary">
          API Token
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          用于以你的身份访问开放 API。Token 只在创建时显示一次，请立即复制并妥善保存。
        </p>
      </section>

      {secret ? (
        <ApiTokenSecretPanel
          name={secret.name}
          secret={secret.token}
          onDismiss={() => setSecret(null)}
        />
      ) : null}

      <section aria-labelledby="settings-api-tokens-create-heading">
        <h3 id="settings-api-tokens-create-heading" className="text-sm font-semibold text-foreground">
          创建 Token
        </h3>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => void create(event)}>
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
          <p role="alert" data-testid="api-token-name-error" className="mt-2 text-sm text-destructive">
            {nameError}
          </p>
        ) : null}
        {createError ? (
          <p role="alert" data-testid="api-token-create-error" className="mt-2 text-sm text-destructive">
            {createError}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="settings-api-tokens-list-heading">
        <h3 id="settings-api-tokens-list-heading" className="text-sm font-semibold text-foreground">
          已有 Token
        </h3>

        {actionError ? (
          <p role="alert" data-testid="api-token-action-error" className="mt-2 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}

        {tokens.length === 0 ? (
          <PageState kind="empty" className="mt-3" title="还没有创建任何 Token" />
        ) : (
          <ul data-testid="api-token-list" className="mt-3 flex flex-col gap-3">
            {tokens.map((token) => {
              const revoked = token.status !== API_TOKEN_STATUS_ACTIVE;
              return (
                <li
                  key={token.id}
                  data-testid={`api-token-${token.id}`}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{token.name}</p>
                    <code
                      data-testid={`api-token-prefix-${token.id}`}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                      {token.tokenPrefix}…
                    </code>
                    {revoked ? (
                      <span
                        data-testid={`api-token-status-${token.id}`}
                        className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        已撤销
                      </span>
                    ) : null}
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>创建于</dt>
                      <dd data-testid={`api-token-created-${token.id}`}>{formatInstant(token.createdAt)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>最近使用</dt>
                      <dd data-testid={`api-token-lastused-${token.id}`}>
                        {token.lastUsedAt ? formatInstant(token.lastUsedAt) : "从未使用"}
                      </dd>
                    </div>
                  </dl>

                  {revoked ? null : confirmingId === token.id ? (
                    <div
                      data-testid={`api-token-revoke-prompt-${token.id}`}
                      className="mt-3 rounded-md border border-destructive/40 p-3"
                    >
                      <p className="text-sm text-foreground">
                        撤销后，使用此 Token 的客户端将无法继续通过它访问 API。
                      </p>
                      <div className="mt-2 flex gap-2">
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
                    </div>
                  ) : (
                    <div className="mt-3">
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
