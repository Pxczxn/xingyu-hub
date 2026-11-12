import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";
import { Button } from "@/components/ui/button";
import { formatMessageTimeShort, senderName } from "./MessageBubble";

/*
 * Mailbox search inside the header card.
 *
 * Same read as the old page: `GET /messages/search` across every conversation,
 * and a blank box does not search. A hit opens that conversation in the card.
 */

const LIMIT = 50;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; detail: string | null }
  | { kind: "ready"; items: ChatMessage[] };

export function MessageSearch({
  initialQuery,
  onOpenHit,
}: {
  initialQuery: string;
  onOpenHit: (message: ChatMessage) => void;
}) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState(initialQuery.length > 0);
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(initialQuery);
    setQuery(initialQuery);
    if (initialQuery) setExpanded(true);
  }, [initialQuery]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

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
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });
    return () => {
      active = false;
    };
  }, [query, reloadKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {expanded ? (
        <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3" role="search">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索消息内容"
            aria-label="搜索消息"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm">
            搜索
          </Button>
        </form>
      ) : (
        <div className="flex shrink-0 justify-end border-b border-border px-3 py-2">
          <button
            type="button"
            aria-label="展开搜索"
            className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
            onClick={() => setExpanded(true)}
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {expanded && state.kind === "idle" ? (
          <p className="px-4 py-8 text-center text-meta text-muted-foreground">输入关键词开始搜索</p>
        ) : null}
        {state.kind === "loading" ? (
          <p className="px-4 py-8 text-center text-meta text-muted-foreground">搜索中…</p>
        ) : null}
        {state.kind === "error" ? (
          <div className="px-4 py-8 text-center">
            <p className="text-meta text-muted-foreground">{state.detail ?? "无法完成搜索，请稍后重试。"}</p>
            <button
              type="button"
              className="focus-ring mt-2 text-meta text-accent-strong hover:underline"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              重新加载
            </button>
          </div>
        ) : null}
        {state.kind === "ready" && state.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-meta text-muted-foreground">没有找到与「{query}」相关的消息</p>
        ) : null}
        {state.kind === "ready" && state.items.length > 0 ? (
          <ul aria-label="搜索结果" className="divide-y divide-border">
            {state.items.map((message) => {
              const who = senderName(message) ?? "已注销用户";
              const where = message.counterpartDisplayName?.trim();
              const at = formatMessageTimeShort(message.createdAt);
              return (
                <li key={message.id}>
                  <button
                    type="button"
                    className="focus-ring flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-surface-sunken"
                    onClick={() => onOpenHit(message)}
                  >
                    <span className="flex w-full items-center gap-2 text-meta text-muted-foreground">
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {where && where !== who ? `${where} · ${who}` : who}
                      </span>
                      {at ? <time className="shrink-0 tabular-nums">{at}</time> : null}
                    </span>
                    <span className="line-clamp-2 text-sm text-foreground">{message.body || "［附件］"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
