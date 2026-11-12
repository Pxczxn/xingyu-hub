import { useEffect } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MESSAGE_LOCATOR_PARAM, MESSAGE_SEQUENCE_PARAM } from "@/api/messages/messages.types";
import { requestMessagePanel } from "./message-panel-focus";

/*
 * `/messages` and `/messages/:id` are no longer a page.
 *
 * They hand the conversation (and a search hit, when the URL has one) to the
 * header card, then leave. A direct visit lands on the home page with the card
 * open. A visit from another page returns there, with the card open on top.
 */

let handedOff: string | null = null;

/** Tests share one module. A second visit of the same URL must still hand off. */
export function resetMessageCardHandoff(): void {
  handedOff = null;
}

export function OpenMessageCardPage({ mode = "thread" }: { mode?: "thread" | "search" } = {}) {
  const { conversationId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const key = `${location.key}:${location.pathname}${location.search}`;
    if (handedOff === key) return;
    handedOff = key;

    if (mode === "search") {
      requestMessagePanel({ view: "search", query: search.get("q") });
    } else {
      const messageId = search.get(MESSAGE_LOCATOR_PARAM);
      const sequence = Number(search.get(MESSAGE_SEQUENCE_PARAM));
      requestMessagePanel({
        conversationId: conversationId ?? null,
        locator:
          messageId && Number.isFinite(sequence) && sequence > 0
            ? { id: messageId, sequence }
            : null,
      });
    }

    if (location.key === "default") {
      navigate("/", { replace: true });
    } else {
      navigate(-1);
    }
  }, [conversationId, location.key, location.pathname, location.search, mode, navigate, search]);

  return null;
}
