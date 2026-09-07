"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";
import { INTEREST_DOMAINS } from "@/lib/onboarding-interests";

function parseInterests(value: string | null): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
  catch { return []; }
}

export default function InterestsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    communityApi.getOnboarding().then((data) => setSelected(parseInterests(data.interestsJson)))
      .catch(() => setMessage("暂时无法读取兴趣设置"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (interest: string) => setSelected((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  const save = async () => {
    setSaving(true); setMessage(null);
    try { await communityApi.updateOnboarding({ interestsJson: JSON.stringify(selected) }); setMessage("兴趣设置已保存"); }
    catch { setMessage("保存失败，请稍后重试"); }
    finally { setSaving(false); }
  };

  return <AppShell><main className="mx-auto w-full max-w-[1420px] px-4 pb-16 pt-7 sm:px-6 lg:px-0">
    <header className="flex flex-col gap-4 border-b border-[#e8e0d6] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-xs font-semibold text-[#d97b2d]">YOUR INTERESTS</span><h1 className="mt-2 text-3xl font-semibold text-[#142957]">兴趣管理</h1><p className="mt-2 text-sm text-[#66718a]">选择你愿意持续探索的方向，用于优化首页与探索推荐。</p></div><Button onClick={save} disabled={loading || saving} className="bg-[#142957] hover:bg-[#20396d]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}保存兴趣</Button></header>
    {message && <p role="status" className="mt-4 text-sm text-[#596782]">{message}</p>}
    {loading ? <div className="grid min-h-80 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#6475ca]" /></div> : <div className="mt-7 grid gap-7 md:grid-cols-2">{INTEREST_DOMAINS.map((domain) => <section key={domain.id}><h2 className="flex items-center gap-2 text-base font-semibold text-[#20345f]"><Sparkles className="h-4 w-4 text-[#e88d3f]" />{domain.label}</h2><div className="mt-3 flex flex-wrap gap-2">{domain.interests.map((interest) => { const active = selected.includes(interest); return <button key={interest} type="button" aria-pressed={active} onClick={() => toggle(interest)} className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? "border-[#5368be] bg-[#edf0ff] font-medium text-[#344b9b]" : "border-[#e4ddd4] bg-white/75 text-[#59657d] hover:border-[#aeb8df]"}`}>{interest}</button>; })}</div></section>)}</div>}
  </main></AppShell>;
}
