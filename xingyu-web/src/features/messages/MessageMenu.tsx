import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Mail } from "lucide-react";
import { setMessagePanelFocus, subscribeMessagePanel } from "./message-panel-focus";
import { conversationLabel, type ChatMessage, type Conversation } from "@/api/messages/messages.types";
import { HeaderMenu } from "@/components/shared/HeaderMenu";
import { useChatSocket } from "@/features/chat/chat-socket.context";
import { formatConversationTime } from "./ConversationRow";
import { NewMessageComposer } from "./NewMessageComposer";
import { MessageSearch } from "./MessageSearch";
import { ConversationThreadPage } from "./pages/ConversationThreadPage";

/*
 * The mailbox, as a card under the header icon.
 *
 * One column, three steps: the list, a new conversation, then the thread.
 * Sending, attachments and recall stay in ConversationThreadPage. Search lives
 * in this card too. Saved messages stay on their own route.
 * `/messages`, `/messages/:id` and `/messages/search` only open this card.
 */

type PanelView = "list" | "compose" | "thread" | "search";

const PANEL_WIDTH = "w-[min(28rem,calc(100vw-2rem))]";
const PANEL_BODY = "flex h-[min(32rem,70dvh)] min-h-0 flex-col overflow-hidden";

export function MessageMenu() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("list");
  const [active, setActive] = useState<Conversation | null>(null);
  const [locator, setLocator] = useState<{ id: string; sequence: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    conversations,
    conversationsStatus,
    conversationsError,
    unreadTotal,
    refreshConversations,
  } = useChatSocket();
  const unread = unreadTotal;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const onThreadReady = useCallback((conversation: Conversation) => {
    setActive(conversation);
  }, []);

  useEffect(() => {
    return subscribeMessagePanel((target) => {
      setOpen(true);
      setLocator(target.locator);
      if (target.view === "search") {
        setSearchQuery(target.query ?? "");
        setActive(null);
        setView("search");
        return;
      }
      if (!target.conversationId) {
        setActive(null);
        setView("list");
        return;
      }
      const known = conversationsRef.current?.find((item) => item.id === target.conversationId);
      setActive(known ?? stubConversation(target.conversationId));
      setView("thread");
    });
  }, []);

  useEffect(() => {
    const focused = open && view === "thread" ? (active?.id ?? null) : null;
    setMessagePanelFocus(focused);
    return () => setMessagePanelFocus(null);
  }, [open, view, active]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && conversationsStatus !== "ready") void refreshConversations();
  }

  function openThread(conversation: Conversation) {
    setLocator(null);
    setActive(conversation);
    setView("thread");
  }

  function openHit(message: ChatMessage) {
    const known = conversationsRef.current?.find((item) => item.id === message.conversationId);
    setLocator({ id: message.id, sequence: message.sequenceNumber });
    setActive(known ?? stubConversation(message.conversationId));
    setView("thread");
  }

  const label = unread != null && unread > 0 ? `私信（${unread} 条未读）` : "私信";
  const items = conversations ?? [];
  const title =
    view === "compose"
      ? "新建私信"
      : view === "search"
        ? "搜索消息"
        : view === "thread" && active
          ? conversationLabel(active)
          : "私信";

  return (
    <HeaderMenu
      label={label}
      count={unread ?? 0}
      icon={<Mail className="h-[18px] w-[18px]" aria-hidden />}
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      contentClassName={PANEL_WIDTH}
      bodyClassName={PANEL_BODY}
      headerAction={
        view === "list" ? (
          <button
            type="button"
            className="focus-ring shrink-0 text-meta text-accent-strong hover:underline"
            onClick={() => setView("compose")}
          >
            新建
          </button>
        ) : (
          <button
            type="button"
            className="focus-ring inline-flex shrink-0 items-center gap-0.5 text-meta text-muted-foreground hover:text-foreground"
            onClick={() => setView("list")}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            返回
          </button>
        )
      }
      footer={
        view === "list" ? (
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="focus-ring text-meta text-foreground hover:underline"
              onClick={() => {
                setSearchQuery("");
                setView("search");
              }}
            >
              搜索消息
            </button>
            <Link
              to="/messages/saved"
              className="focus-ring text-meta text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => setOpen(false)}
            >
              收藏
            </Link>
          </div>
        ) : null
      }
    >
      {view === "list" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversationsStatus === "loading" || conversationsStatus === "idle" ? (
            <p className="px-4 py-8 text-center text-meta text-muted-foreground">加载中…</p>
          ) : null}
          {conversationsStatus === "error" ? (
            <div className="px-4 py-8 text-center">
              <p className="text-meta text-muted-foreground">{conversationsError ?? "无法读取会话，请稍后重试。"}</p>
              <button
                type="button"
                className="focus-ring mt-2 text-meta text-accent-strong hover:underline"
                onClick={() => void refreshConversations()}
              >
                重新加载
              </button>
            </div>
          ) : null}
          {conversationsStatus === "ready" && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-meta text-muted-foreground">还没有私信</p>
          ) : null}
          {conversationsStatus === "ready" && items.length > 0 ? (
            <ul className="divide-y divide-border">
              {items.map((conversation) => (
                <ConversationPreview
                  key={conversation.id}
                  conversation={conversation}
                  onOpen={() => openThread(conversation)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {view === "compose" ? (
        <div className="px-4 py-4">
          <NewMessageComposer
            startOpen
            onStarted={(conversation) => {
              openThread(conversation);
              void refreshConversations();
            }}
          />
        </div>
      ) : null}
      {view === "search" ? (
        <MessageSearch initialQuery={searchQuery} onOpenHit={openHit} />
      ) : null}
      {view === "thread" && active ? (
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <ConversationThreadPage
            conversationId={active.id}
            embedded
            initialLocator={locator}
            onReady={onThreadReady}
          />
        </div>
      ) : null}
    </HeaderMenu>
  );
}

function stubConversation(id: string): Conversation {
  return {
    id,
    type: "DIRECT",
    title: null,
    updatedAt: null,
    lastMessage: null,
    unreadCount: 0,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: null,
    messages: [],
  };
}

function ConversationPreview({
  conversation,
  onOpen,
}: {
  conversation: Conversation;
  onOpen: () => void;
}) {
  const label = conversationLabel(conversation);
  const at = formatConversationTime(conversation.updatedAt);
  const unread = conversation.unreadCount ?? 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-sunken"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground"
        >
          {label.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={
                unread > 0
                  ? "min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
                  : "min-w-0 flex-1 truncate text-sm font-medium text-foreground"
              }
            >
              {label}
            </span>
            {at ? (
              <time className="shrink-0 text-meta tabular-nums text-muted-foreground">{at}</time>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-meta text-muted-foreground">
            {conversation.lastMessage ?? "还没有消息"}
          </span>
        </span>
      </button>
    </li>
  );
}
