"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi, type ExploreDomain } from "@/lib/community-api";
import { cn } from "@/lib/utils";

export default function InterestsPage() {
  const router = useRouter();
  const [map, setMap] = useState<ExploreDomain[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const childDomains = useMemo(
    () => map.flatMap((group) => group.children ?? []),
    [map]
  );

  useEffect(() => {
    Promise.all([communityApi.getExploreMap(), communityApi.getMyExplore()])
      .then(([domainMap, mine]) => {
        setMap(domainMap);
        setSelectedIds(mine.domains.filter((item) => !item.personal).map((item) => item.id));
        setCustomLabels(mine.customLabels);
      })
      .catch(() => setMessage("暂时无法读取探索设置"))
      .finally(() => setLoading(false));
  }, []);

  const toggleDomain = (domainId: string) => {
    setSelectedIds((current) =>
      current.includes(domainId) ? current.filter((id) => id !== domainId) : [...current, domainId]
    );
  };

  const addCustomLabel = () => {
    const value = draftLabel.trim();
    if (!value || customLabels.includes(value)) return;
    setCustomLabels((current) => [...current, value]);
    setDraftLabel("");
  };

  const removeCustomLabel = (label: string) => {
    setCustomLabels((current) => current.filter((item) => item !== label));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await communityApi.updateMyExplore({
        domainIds: selectedIds,
        customLabels,
      });
      const params = new URLSearchParams({ domain: "all", sort: "featured" });
      router.push(`/discover?${params.toString()}`);
    } catch {
      setMessage("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1420px] px-4 pb-16 pt-7 sm:px-6 lg:px-0">
        <header className="flex flex-col gap-4 border-b border-[#e8e0d6] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-semibold text-[#d97b2d]">MY EXPLORATION</span>
            <h1 className="mt-2 text-3xl font-semibold text-[#142957]">我的探索</h1>
            <p className="mt-2 text-sm text-[#66718a]">
              从官方领域星图中选择你的方向，也可添加个人探索标签。仅影响你的推荐，不会改变社区公共结构。
            </p>
          </div>
          <Button onClick={save} disabled={loading || saving} className="bg-[#142957] hover:bg-[#20396d]">
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            保存探索
          </Button>
        </header>

        {message ? <p role="status" className="mt-4 text-sm text-[#596782]">{message}</p> : null}

        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#6475ca]" />
          </div>
        ) : (
          <div className="mt-7 space-y-8">
            {map.map((group) => (
              <section key={group.id}>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#20345f]">
                  <Sparkles className="h-4 w-4 text-[#e88d3f]" />
                  {group.name}
                </h2>
                {group.description ? <p className="mt-1 text-sm text-[#7b8495]">{group.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(group.children ?? []).map((domain) => {
                    const active = selectedIds.includes(domain.id);
                    return (
                      <button
                        key={domain.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDomain(domain.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          active
                            ? "border-[#5368be] bg-[#edf0ff] font-medium text-[#344b9b]"
                            : "border-[#e4ddd4] bg-white/75 text-[#59657d] hover:border-[#aeb8df]"
                        )}
                      >
                        {domain.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section>
              <h2 className="text-base font-semibold text-[#20345f]">个人探索标签</h2>
              <p className="mt-1 text-sm text-[#7b8495]">例如 Java、独立开发、逆向研究——只对你可见，不进入官方星图。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {customLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#c8cce5] bg-[#faf9ff] px-3 py-1.5 text-sm text-[#344b9b]"
                  >
                    {label}
                    <button type="button" aria-label={`移除 ${label}`} onClick={() => removeCustomLabel(label)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex max-w-md gap-2">
                <Input
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  placeholder="添加个人探索方向"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomLabel();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCustomLabel}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {childDomains.length === 0 ? (
              <p className="text-sm text-[#7b8495]">官方领域数据尚未加载，请确认已执行 V038 数据库迁移。</p>
            ) : null}
          </div>
        )}
      </main>
    </AppShell>
  );
}
