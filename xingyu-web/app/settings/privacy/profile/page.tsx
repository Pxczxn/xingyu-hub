"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CircleUserRound, ShieldCheck } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi, type ProfileDetail } from "@/lib/community-api";

export default function PrivacyProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [followersVisibility, setFollowersVisibility] = useState("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    communityApi
      .getMyProfile()
      .then((data) => {
        setProfile(data);
        setFollowersVisibility(data.followersVisibility ?? "PUBLIC");
      })
      .catch(() => setError("请先登录后再设置隐私"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await communityApi.updatePrivacy({ followersVisibility });
      setProfile(updated);
      setSuccess("主页隐私设置已保存");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.problem.detail || "保存失败" : "保存失败，请稍后重试"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsLayout
      aside={
        <>
          <div className="grid h-40 place-items-center rounded-3xl bg-[radial-gradient(circle_at_50%_55%,#f4ba79_0%,#ffe8cf_28%,#fffaf3_60%)] text-[#e58a38]">
            <ShieldCheck className="h-20 w-20" />
          </div>
          <h2 className="mt-7 text-[26px] font-bold leading-tight text-[#1b2e58]">你的隐私，由你掌控</h2>
          <p className="mt-5 text-sm leading-7 text-slate-500">
            主页可见性与粉丝列表可见性会同步到公开资料服务，一处修改处处生效。
          </p>
          <Link href="/settings/profile" className="mt-6 inline-flex text-sm text-[#e38334] hover:underline">
            编辑公开资料 →
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <header className="flex items-center gap-4 border-b border-[#eee7df] pb-7">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[#fbf5ec] text-[#18305d] shadow">
            <CircleUserRound className="h-8 w-8" />
          </span>
          <div>
            <p className="text-sm font-medium text-[#e58436]">隐私</p>
            <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">主页隐私</h1>
            <p className="mt-1 text-sm text-slate-500">管理个人资料与粉丝列表的可见范围</p>
          </div>
        </header>

        <section className="mt-7 overflow-hidden rounded-2xl border border-[#eee5db] bg-white/75">
          <div className="flex items-center gap-4 border-b border-[#eee7df] px-5 py-5">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f9f3ea] text-[#21355e]">
              <CircleUserRound className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-[#1a2d58]">粉丝列表可见性</h2>
              <p className="mt-1 text-sm text-slate-500">控制谁可以查看你的关注者与粉丝列表</p>
            </div>
            <select
              value={followersVisibility}
              onChange={(event) => setFollowersVisibility(event.target.value)}
              className="h-11 rounded-xl border border-[#e9dfd3] bg-white px-4 text-sm text-[#26375d]"
            >
              <option value="PUBLIC">所有人</option>
              <option value="PRIVATE">仅自己可见</option>
            </select>
          </div>
          <div className="flex items-center gap-4 px-5 py-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-[#1a2d58]">个人资料可见范围</h2>
              <p className="mt-1 text-sm text-slate-500">在公开资料页设置主页整体可见性</p>
            </div>
            <Link
              href="/settings/profile"
              className="shrink-0 rounded-xl border border-[#e9dfd3] px-4 py-2.5 text-sm text-[#26375d] hover:bg-[#faf7f1]"
            >
              去编辑
            </Link>
          </div>
        </section>

        {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
        {success && <Alert className="mt-5">{success}</Alert>}
        <footer className="mt-6 flex justify-end">
          <Button
            disabled={submitting || !profile}
            className="h-12 rounded-full bg-[#ed8c38] px-8 text-white hover:bg-[#df7d2d]"
          >
            {submitting ? "保存中…" : "保存设置"}
          </Button>
        </footer>
      </form>
    </SettingsLayout>
  );
}
