"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { clearSearchHistory, getSearchHistory, hydrateClientSettingsFromServer, removeSearchHistoryItem } from "@/lib/user-preferences";

export default function SearchHistorySettingsPage() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    void hydrateClientSettingsFromServer().then(() => setHistory(getSearchHistory()));
  }, []);

  function refresh() {
    setHistory(getSearchHistory());
  }

  return (
    <CompactPageShell eyebrow="账户" title="搜索历史" description="管理本机与账号同步的搜索记录" width="sm" backHref="/settings" backLabel="返回设置">
      <Card>
        <CardTitle>本机搜索记录</CardTitle>
        <CardDescription className="mt-1">与账号同步，可在不同设备查看最近搜索</CardDescription>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">暂无搜索历史</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {history.map((query) => (
              <li key={query} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/search?q=${encodeURIComponent(query)}`} className="hover:text-[rgb(var(--violet))]">
                  {query}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeSearchHistoryItem(query);
                    refresh();
                  }}
                >
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
        {history.length > 0 && (
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              clearSearchHistory();
              refresh();
            }}
          >
            清空全部
          </Button>
        )}
      </Card>
    </CompactPageShell>
  );
}
