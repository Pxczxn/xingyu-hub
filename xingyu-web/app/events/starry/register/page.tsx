"use client";

import Image from "next/image";
import Link from "next/link";
import { Award, CalendarDays, Check, Mail, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSummary, type ProfileDetail } from "@/lib/community-api";

function formatDate(value?: string) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date) : "待公布"; }

export default function ActivityRegistrationPage() {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([communityApi.getEvents(20), communityApi.tryGetMyProfile()]).then(([events, me]) => { setEvent(events[0] ?? null); setProfile(me); }).catch(() => undefined).finally(() => setLoading(false)); }, []);
  return <AppShell><main className="xy-registration-page">
    <header><Link href="/"><Sparkles /> 星语社区<small>连接思想，共创美好</small></Link><p>让每一次表达，都被看见</p></header>
    <div className="xy-registration-grid"><section className="xy-registration-info"><Image className="xy-register-hero" src="/prototype-assets/activity-registration/campaign-hero.png" alt="" aria-hidden="true" width={706} height={396} priority /><div className="xy-register-dates"><p><CalendarDays /><span><b>开始时间</b><small>{formatDate(event?.startsAt)}</small></span></p><p><CalendarDays /><span><b>结束时间</b><small>{formatDate(event?.endsAt)}</small></span></p><p><Award /><span><b>投稿状态</b><small>{event?.submissionOpen ? "开放中" : "暂未开放"}</small></span></p></div><section><h2>活动简介</h2><p>{event?.body || (loading ? "正在加载活动说明。" : "活动方暂未提供详细说明。")}</p></section><section><h2>奖项与结果</h2><div className="xy-register-rewards"><article><Award /><h3>奖项信息</h3><b>待发布</b><strong>—</strong><small>当前接口未提供奖项设置</small></article><article><Star /><h3>评选结果</h3><b>待发布</b><strong>—</strong><small>以活动方正式公告为准</small></article><article><Sparkles /><h3>活动记录</h3><b>投稿后可查</b><strong>—</strong><small>在个人活动页查看状态</small></article></div></section></section>
      <section className="xy-registration-form"><header><div><h1>活动参与确认</h1><p>{event?.title || "确认账号信息后前往投稿"}</p></div><ol><li className="done"><Check /> 账号确认</li><li className="active"><Star /> 参与活动</li><li>提交投稿</li></ol></header><hr /><h2>账号资料</h2><section className="xy-profile-confirm"><div><p><UserRound /><span><b>用户名</b><small>{profile?.displayName || profile?.username || "请先登录"}</small></span></p><p><Mail /><span><b>账号状态</b><small>{profile ? "已登录" : "未登录"}</small></span></p></div><div><p><Star /><span><b>社区身份</b><small>{profile?.bio || "星语社区成员"}</small></span></p><p><Award /><span><b>参与活动</b><small>{event?.title || "待选择"}</small></span></p></div><Image src="/prototype-assets/activity-registration/profile-art.png" alt="" aria-hidden="true" width={159} height={177}/></section><h2>参与确认</h2><section className="xy-register-promise"><Check /><p>我已阅读活动说明，确认将从自己的已发布内容中选择作品投稿。<br />投稿内容需遵守社区规范，活动状态以详情页展示为准。</p><span>账号：{profile?.username || "未登录"}<br />时间：以提交时为准</span></section><h2>活动须知</h2><section className="xy-register-notes"><p>活动实际开放状态以活动详情页面为准。</p><p>提交作品不会修改你已发布的原内容。</p><p>投稿成功后可在“我的活动”中查看处理状态。</p><p>奖项、评选和最终结果以活动方后续公告为准。</p></section>{event?.submissionOpen && profile ? <Button className="xy-register-submit" asChild><Link href={`/events/${encodeURIComponent(event.id)}/submit`}>确认参与，前往投稿</Link></Button> : <Button className="xy-register-submit" disabled>{profile ? "活动暂未开放投稿" : "请先登录后参与"}</Button>}<small className="xy-register-warning">此页面不保存额外报名资料；投稿完成后才会创建活动参与记录。</small></section></div>
  </main></AppShell>;
}
