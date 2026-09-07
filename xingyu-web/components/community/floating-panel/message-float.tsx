"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/community/empty-state";
import { Input } from "@/components/ui/input";
import { communityApi, type ConversationSummary } from "@/lib/community-api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FloatingCard, FloatingCardBody, FloatingCardHeader, FloatingTabs } from "./floating-card";
import { FloatingChatThread } from "./floating-chat-thread";
import { useHoverOpen } from "./use-hover-open";

type MessageTab = "all" | "direct" | "group";

function fuzzyMatch(text: string, query: string): boolean {
  const source = text.trim().toLowerCase();
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  if (source.includes(keyword)) return true;

  let index = 0;
  for (const char of keyword) {
    const found = source.indexOf(char, index);
    if (found === -1) return false;
    index = found + 1;
  }
  return true;
}

function matchesConversation(conversation: ConversationSummary, query: string): boolean {
  if (!query.trim()) return true;
  const fields = [conversation.title, conversation.lastMessage ?? ""].filter(Boolean);
  return fields.some((field) => fuzzyMatch(field, query));
}

function ConversationListItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: (conversation: ConversationSummary) => void;
}) {
  const isGroup = conversation.type === "GROUP";

  return (
    <button
      type="button"
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
        active && "bg-[rgb(var(--violet)/.08)] ring-1 ring-[rgb(var(--violet)/.12)]"
      )}
      onClick={() => onSelect(conversation)}
    >
      <Avatar fallback={conversation.title} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{conversation.title}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              isGroup ? "bg-[#eef2fb] text-[#4a5f9c]" : "bg-[#f5f0ea] text-[#8a6a45]"
            )}
          >
            {isGroup ? <Users className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
            {isGroup ? "群聊" : "私信"}
          </span>
        </span>
        <span className="mt-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {conversation.lastMessage || (isGroup ? "暂无群消息" : "暂无消息")}
          </span>
          <time className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</time>
        </span>
      </span>
      {(conversation.unreadCount ?? 0) > 0 ? (
        <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] font-semibold leading-none text-white">
          {conversation.unreadCount! > 99 ? "99+" : conversation.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function MessageListCard({
  conversations,
  loading,
  needsLogin,
  searchQuery,
  onSearchChange,
  tab,
  onTabChange,
  showCreateGroup,
  onToggleCreateGroup,
  groupTitle,
  onGroupTitleChange,
  creatingGroup,
  createError,
  onCreateGroup,
  onCancelCreateGroup,
  activeConversation,
  onSelectConversation,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  needsLogin: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  tab: MessageTab;
  onTabChange: (tab: MessageTab) => void;
  showCreateGroup: boolean;
  onToggleCreateGroup: () => void;
  groupTitle: string;
  onGroupTitleChange: (value: string) => void;
  creatingGroup: boolean;
  createError: string | null;
  onCreateGroup: (event: React.FormEvent) => void;
  onCancelCreateGroup: () => void;
  activeConversation: ConversationSummary | null;
  onSelectConversation: (conversation: ConversationSummary | null) => void;
}) {
  const directUnread = conversations.filter((item) => item.type === "DIRECT").reduce((sum, item) => sum + (item.unreadCount ?? 0), 0);
  const groupUnread = conversations.filter((item) => item.type === "GROUP").reduce((sum, item) => sum + (item.unreadCount ?? 0), 0);
  const totalUnread = directUnread + groupUnread;

  const tabFiltered = useMemo(() => {
    if (tab === "direct") return conversations.filter((item) => item.type === "DIRECT");
    if (tab === "group") return conversations.filter((item) => item.type === "GROUP");
    return conversations;
  }, [conversations, tab]);

  const filtered = useMemo(
    () => tabFiltered.filter((item) => matchesConversation(item, searchQuery)),
    [tabFiltered, searchQuery]
  );

  if (loading) {
    return (
      <FloatingCard width={360} className="h-[34rem]">
        <FloatingCardHeader title="消息" description="加载中…" />
        <FloatingCardBody className="px-4 py-6">
          <p className="text-sm text-muted-foreground">正在获取会话…</p>
        </FloatingCardBody>
      </FloatingCard>
    );
  }

  if (needsLogin) {
    return (
      <FloatingCard width={360} className="h-[28rem]">
        <FloatingCardHeader title="消息" />
        <FloatingCardBody className="flex items-center justify-center px-4">
          <EmptyState compact title="登录后查看消息" description="私信与群聊需要登录" actionLabel="去登录" actionHref="/login" className="border-0 bg-[#f5f3ef]" />
        </FloatingCardBody>
      </FloatingCard>
    );
  }

  return (
    <FloatingCard width={360} className="flex h-[34rem] flex-col">
      <FloatingCardHeader
        title="消息"
        description={totalUnread > 0 ? `${totalUnread} 条未读` : "私信与群聊"}
      />

      <FloatingTabs
        value={tab}
        onChange={(id) => onTabChange(id as MessageTab)}
        items={[
          { id: "all", label: "全部", count: totalUnread },
          { id: "direct", label: "私信", count: directUnread },
          { id: "group", label: "群聊", count: groupUnread },
        ]}
      />

      <div className="space-y-2 border-b border-[#ece8e1] bg-[#fffdf9] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索联系人或消息"
              aria-label="搜索联系人或消息"
              className="h-9 rounded-full border-[#e8e4dc] bg-[#f5f3ef] pl-8 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="创建群聊"
            aria-expanded={showCreateGroup}
            onClick={onToggleCreateGroup}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showCreateGroup ? (
          <form className="flex items-center gap-2" onSubmit={(e) => void onCreateGroup(e)}>
            <Input
              value={groupTitle}
              onChange={(e) => onGroupTitleChange(e.target.value)}
              placeholder="输入群名称"
              aria-label="群名称"
              className="h-8 flex-1 text-sm"
              autoFocus
            />
            <Button type="submit" size="sm" className="h-8 shrink-0 px-3" disabled={creatingGroup || !groupTitle.trim()}>
              {creatingGroup ? "创建中…" : "创建"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2" onClick={onCancelCreateGroup}>
              取消
            </Button>
          </form>
        ) : null}

        {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
      </div>

      <FloatingCardBody className="px-1.5 py-1.5">
        {filtered.length === 0 ? (
          <div className="px-2 py-10">
            <EmptyState
              compact
              icon={searchQuery.trim() ? Search : MessageSquare}
              title={searchQuery.trim() ? "未找到匹配的会话" : tab === "group" ? "暂无群聊" : tab === "direct" ? "暂无私信" : "暂无会话"}
              description={searchQuery.trim() ? "试试其他关键词" : "开始对话后，联系人会出现在这里"}
              className="border-0 bg-[#f5f3ef]"
            />
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((conversation) => (
              <li key={conversation.id}>
                <ConversationListItem
                  conversation={conversation}
                  active={activeConversation?.id === conversation.id}
                  onSelect={onSelectConversation}
                />
              </li>
            ))}
          </ul>
        )}
      </FloatingCardBody>
    </FloatingCard>
  );
}

function MessagePanelContent({
  activeConversation,
  onSelectConversation,
  onUnreadChange,
  compact,
}: {
  activeConversation: ConversationSummary | null;
  onSelectConversation: (conversation: ConversationSummary | null) => void;
  onUnreadChange?: (count: number) => void;
  compact?: boolean;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<MessageTab>("all");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function loadConversations() {
    return communityApi
      .getConversations()
      .then((items) => {
        setConversations(items);
        onUnreadChange?.(items.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0));
      })
      .catch(() => {
        setNeedsLogin(true);
        setConversations([]);
        onUnreadChange?.(0);
      });
  }

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [onUnreadChange]);

  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    const title = groupTitle.trim();
    if (!title) return;

    setCreatingGroup(true);
    setCreateError(null);
    try {
      const conversation = await communityApi.createGroupConversation(title);
      await loadConversations();
      setGroupTitle("");
      setShowCreateGroup(false);
      onSelectConversation(conversation);
    } catch {
      setCreateError("创建失败，请确认已登录");
    } finally {
      setCreatingGroup(false);
    }
  }

  const showList = !compact || !activeConversation;
  const showChat = activeConversation != null;

  return (
    <div className={cn("flex items-start gap-2", showList && showChat && "xy-float-message-dual")}>
      {showList ? (
        <MessageListCard
          conversations={conversations}
          loading={loading}
          needsLogin={needsLogin}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          tab={tab}
          onTabChange={setTab}
          showCreateGroup={showCreateGroup}
          onToggleCreateGroup={() => {
            setShowCreateGroup((prev) => !prev);
            setCreateError(null);
          }}
          groupTitle={groupTitle}
          onGroupTitleChange={setGroupTitle}
          creatingGroup={creatingGroup}
          createError={createError}
          onCreateGroup={handleCreateGroup}
          onCancelCreateGroup={() => {
            setShowCreateGroup(false);
            setGroupTitle("");
            setCreateError(null);
          }}
          activeConversation={activeConversation}
          onSelectConversation={onSelectConversation}
        />
      ) : null}

      {showChat ? (
        <FloatingChatThread conversation={activeConversation} onBack={() => onSelectConversation(null)} />
      ) : null}
    </div>
  );
}

export function MessageFloatTrigger({
  trigger,
  defaultOpen = false,
}: {
  trigger: (props: { unreadCount: number; open: boolean }) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { open, handleEnter, handleLeave, keepOpen } = useHoverOpen();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [mobileOpen, setMobileOpen] = useState(defaultOpen);
  const [compact, setCompact] = useState(false);

  const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
  const panelOpen = isDesktop() ? open : mobileOpen;

  useEffect(() => {
    communityApi
      .getConversations()
      .then((items) => setUnreadCount(items.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0)))
      .catch(() => setUnreadCount(0));
  }, [panelOpen]);

  useEffect(() => {
    if (defaultOpen) setMobileOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (!panelOpen) setActiveConversation(null);
  }, [panelOpen]);

  useEffect(() => {
    function updateCompact() {
      setCompact(window.innerWidth < 1320);
    }
    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  function handleMobileToggle() {
    if (!isDesktop()) {
      setMobileOpen((prev) => !prev);
    }
  }

  return (
    <>
      <div
        className="relative hidden lg:block"
        onMouseEnter={handleEnter}
        onMouseLeave={() => {
          handleLeave();
          if (!open) setActiveConversation(null);
        }}
      >
        {trigger({ unreadCount, open })}
        {open ? (
          <div className="absolute right-0 top-full z-50" role="dialog" aria-modal="false">
            <div className="xy-float-hover-bridge" aria-hidden="true" />
            <div className="xy-float-panel-wrap">
              <MessagePanelContent
                activeConversation={activeConversation}
                onSelectConversation={(conversation) => {
                  setActiveConversation(conversation);
                  keepOpen();
                }}
                onUnreadChange={setUnreadCount}
                compact={compact}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:hidden">
        <div onClick={handleMobileToggle}>{trigger({ unreadCount, open: mobileOpen })}</div>
        {mobileOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/12"
              aria-label="关闭消息面板"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-x-3 top-[4.25rem] z-50 sm:inset-x-auto sm:right-4 sm:left-auto" role="dialog" aria-modal="false">
              <MessagePanelContent
                activeConversation={activeConversation}
                onSelectConversation={setActiveConversation}
                onUnreadChange={setUnreadCount}
                compact
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
