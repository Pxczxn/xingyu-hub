import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage } from "@/api/messages/messages.types";

/*
 * Loads the shared media or files for one conversation (Phase 2I-3b).
 *
 * Extracted from the page because the two modes differ only in which endpoint
 * they call: the loading/error/notFound state machine, the auth classification
 * and the reload path are identical, and having one copy means the next fix
 * does not have to be applied twice.
 *
 * These endpoints return BARE ARRAYS and are capped at 200 server-side, so
 * there is no cursor to walk — a single request is the whole result.
 */

export type AttachmentsState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; notFound: boolean }
  | { kind: "ready"; items: ChatMessage[] };

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED");
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.problem.status === 404;
}

const LIMIT = 100;

export function useConversationAttachments(
  conversationId: string | undefined,
  kind: "media" | "files",
): { state: AttachmentsState; reload: () => Promise<void> } {
  const [state, setState] = useState<AttachmentsState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    // Keep an already-loaded list on screen during a manual refresh rather than
    // blanking it back to a spinner.
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));

    const load =
      kind === "media"
        ? messagesApi.listMedia(conversationId, LIMIT)
        : messagesApi.listFiles(conversationId, LIMIT);

    load
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err), notFound: isNotFound(err) });
      });

    return () => {
      active = false;
    };
  }, [conversationId, kind, reloadToken]);

  const reload = useCallback(async () => {
    setReloadToken((token) => token + 1);
  }, []);

  return { state, reload };
}
