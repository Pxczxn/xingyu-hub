"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Input } from "@/components/ui/input";
import { communityApi, type MessageSearchHit } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";

function messageHref(item: MessageSearchHit): string | null {
  if (!item.conversationId) return null;
  if (item.conversationType === "GROUP") return `/messages/group/${item.conversationId}`;
  if (item.conversationType === "DIRECT") return `/messages/direct/${item.conversationId}`;
  return `/messages/direct/${item.conversationId}`;
}

export default function MessageSearchPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<MessageSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = keyword.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      communityApi
        .searchMessages(q)
        .then((items) => {
          setResults(conversationId ? items.filter((item) => item.conversationId === conversationId) : items);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [conversationId, keyword]);

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact" eyebrow="消息" title={conversationId ? "搜索当前会话" : "搜索消息"} description={conversationId ? "结果仅来自当前会话" : "搜索你参与会话中的消息内容"} />
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="输入关键词搜索消息…" />
        {loading ? (
          <p className="text-sm text-muted-foreground">搜索中…</p>
        ) : !keyword.trim() ? (
          <p className="text-sm text-muted-foreground">输入关键词开始搜索</p>
        ) : searched && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">未找到匹配消息</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {results.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <MessageResult item={item} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

function MessageResult({ item }: { item: MessageSearchHit }) {
  const href = messageHref(item);
  const preview = item.body || item.attachmentName || "附件消息";

  if (!href) {
    return (
      <div>
        <p className="font-medium">{preview}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
      </div>
    );
  }

  return (
    <Link href={href} className="block hover:text-[rgb(var(--violet))]">
      <p className="font-medium">{preview}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDateTime(item.createdAt)}
        {item.conversationType ? ` · ${item.conversationType}` : ""}
      </p>
    </Link>
  );
}
