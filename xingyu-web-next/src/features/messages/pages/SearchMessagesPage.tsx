import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "../MessageBubble";

/*
 * Message search (Phase 2I-3b).
 *
 * `GET /messages/search` searches ACROSS EVERY conversation the caller belongs
 * to, not one thread — so this is a mailbox-wide page, not a box inside a
 * thread. Results carry `conversationId` (needed to link back) and, unlike the
 * thread endpoints, may arrive with `conversationType` unset; nothing here
 * depends on it.
 *
 * The keyword lives in the URL (`?q=`) exactly like /search does, so refresh
 * and sharing keep the state. That also gives the page a real distinction the
 * server does not provide: a blank query short-circuits to `[]` without an
 * error, so "no query yet" and "searched, found nothing" would otherwise look
 * identical. The URL is the authority — nothing is sent until there is a query.
 *
 * `mine` is always false here. Ownership needs the caller's own user id, and the
 * only source for that is the chat socket's `connected` frame (MeView and
 * ProfileView both omit the id). This page does not open a socket — search
 * results are readable without realtime and a socket per page would be a second
 * connection for no gain — so every bubble is rendered neutrally rather than
 * guessed at. `canRecall` is likewise false: recall belongs to the thread.
 */

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; detail: string | null; expired: boolean }
  | { kind: "ready"; items: ChatMessage[] };

const LIMIT = 50;

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED");
}

export function SearchMessagesPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [draft, setDraft] = useState(query);
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  // Keep the box in step when the URL changes from outside (back/forward, or a
  // link into this page carrying ?q=).
  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setState({ kind: "idle" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });

    messagesApi
      .search(query, LIMIT)
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          // The backend's own wording when it has one — a bare "搜索失败" would
          // throw away the only explanation the server gave.
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
          expired: isAuthError(err),
        });
      });

    return () => {
      active = false;
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    // An empty box clears the query rather than searching for nothing — the
    // server would answer `[]` and the page would claim it searched.
    else next.delete("q");
    setParams(next, { replace: true });
  }

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-primary">搜索消息</h1>
        <p className="text-sm text-muted-foreground">在你参与的所有会话中查找消息内容。</p>
        <nav className="text-sm">
          <Link to="/messages" className="text-accent hover:underline">
            返回私信
          </Link>
        </nav>
      </header>

      <form onSubmit={submit} className="flex items-center gap-2" role="search">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="搜索消息内容"
          aria-label="搜索消息"
        />
        <Button type="submit">搜索</Button>
      </form>

      {state.kind === "idle" ? (
        <PageState kind="empty" title="输入关键词开始搜索" description="搜索结果会显示来自所有会话的匹配消息。" />
      ) : null}

      {state.kind === "loading" ? <PageState kind="loading" /> : null}

      {state.kind === "error" ? (
        <div className="section-gap">
          <PageState
            kind="error"
            title="搜索失败"
            description={
              state.expired
                ? "登录状态已过期，请重新登录。"
                : (state.detail ?? "无法完成搜索，请稍后重试。")
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
      ) : null}

      {state.kind === "ready" && state.items.length === 0 ? (
        <PageState
          kind="empty"
          title={`没有找到与「${query}」相关的消息`}
          description="换个关键词试试，或回到会话里翻看更早的消息。"
        />
      ) : null}

      {state.kind === "ready" && state.items.length > 0 ? (
        <ul aria-label="搜索结果" className="flex flex-col gap-3">
          {state.items.map((message) => (
            <li key={message.id} className="flex flex-col gap-1">
              <Link
                to={`/messages/${encodeURIComponent(message.conversationId)}`}
                className="self-start text-xs text-accent hover:underline"
              >
                查看所在会话
              </Link>
              <ul>
                {/* Neutral bubble: ownership is unknowable here (see the header
                    comment), so nothing claims the message is ours. */}
                <MessageBubble
                  message={message}
                  mine={false}
                  showSender={false}
                  canRecall={false}
                  pending={false}
                  onRecall={() => {}}
                />
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
