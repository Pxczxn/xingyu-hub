"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clock3, FileText, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type ArticleSummary, type EventSummary, type MomentDetail, type SeriesSummary } from "@/lib/community-api";

type ContentOption = { objectType: string; objectId: string; title: string };

function formatDate(value?: string) {
  if (!value) return "待公布";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待公布";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function EventSubmitPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const router = useRouter();
  const [objectType, setObjectType] = useState("ARTICLE");
  const [objectId, setObjectId] = useState("");
  const [note, setNote] = useState("");
  const [options, setOptions] = useState<ContentOption[]>([]);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [eventError, setEventError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    communityApi.getEvent(eventId).then(setEvent).catch(() => setEventError(true));
  }, [eventId]);

  useEffect(() => {
    const loader = objectType === "ARTICLE"
      ? communityApi.listMyArticles().then((items: ArticleSummary[]) => items.map((item) => ({ objectType: "ARTICLE", objectId: item.id, title: item.title })))
      : objectType === "SERIES"
        ? communityApi.listMySeries().then((items: SeriesSummary[]) => items.map((item) => ({ objectType: "SERIES", objectId: item.id, title: item.title })))
        : communityApi.getMyMoments().then((items: MomentDetail[]) => items.map((item) => ({ objectType: "MOMENT", objectId: item.id, title: item.body?.slice(0, 40) || item.id })));
    loader.then((items) => { setOptions(items); setObjectId(items[0]?.objectId ?? ""); }).catch(() => { setOptions([]); setObjectId(""); });
  }, [objectType]);

  const selected = useMemo(() => options.find((item) => item.objectId === objectId), [objectId, options]);

  async function onSubmit(eventSubmit: FormEvent) {
    eventSubmit.preventDefault();
    if (!objectId || !event?.submissionOpen) return;
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.submitToEvent(eventId, { objectType, objectId, note: note.trim() || undefined });
      router.push(`/events/${eventId}`);
    } catch {
      setError("投稿失败，请确认内容已发布且账号已登录。");
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(event?.submissionOpen && objectId);
  return (
    <AppShell>
      <main className="xy-submit-page">
        <header>
          <div><h1>活动投稿</h1><p>{event?.title || (eventError ? "活动信息暂时无法加载" : "参与活动，分享你的创作")}</p></div>
          <ol>{["选择作品", "填写说明", "提交完成"].map((label, index) => <li className={index === 0 ? "active" : ""} key={label}><b>{index + 1}</b>{label}</li>)}</ol>
        </header>
        <div className="xy-submit-grid">
          <form onSubmit={onSubmit}>
            <section>
              <h2><b>1</b> 选择投稿内容</h2>
              <div className="xy-submit-tabs">
                {[["ARTICLE", "单篇文章"], ["SERIES", "系列作品"], ["MOMENT", "社区动态"]].map(([type, label]) => <button type="button" className={objectType === type ? "active" : ""} onClick={() => setObjectType(type)} key={type}>{label}</button>)}
              </div>
              <div className="xy-submit-work">
                <Image src="/prototype-assets/activity-submission/cover.png" alt="" aria-hidden="true" width={181} height={192} />
                <div>
                  <label>选择已发布作品<select value={objectId} onChange={(e) => setObjectId(e.target.value)}>{options.length ? options.map((item) => <option value={item.objectId} key={item.objectId}>{item.title}</option>) : <option value="">暂无可用作品</option>}</select></label>
                  <label>所选作品标题<input value={selected?.title || ""} readOnly placeholder="请选择要投稿的作品" /></label>
                  <p className="xy-submit-hint"><FileText /> 作品的正文与已有资料将以原内容为准，投稿页不会修改它。</p>
                </div>
              </div>
            </section>
            <section>
              <h2><b>2</b> 投稿说明</h2>
              <p>可简要说明创作思路或希望活动方关注的内容。此项为选填。</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="写下你的投稿说明（选填）" />
            </section>
            {error && <Alert variant="destructive">{error}</Alert>}
            <footer>
              <div><strong>{canSubmit ? "已就绪" : "待完善"}</strong><span>{canSubmit ? "可以提交活动投稿" : "请先选择一个已发布作品"}<small>活动不会替你修改原作品</small></span></div>
              <p><Check /> 选择作品　<Check /> 填写说明　{event?.submissionOpen ? <><Check /> 活动开放中</> : "活动暂未开放"}</p>
              <Button type="button" variant="outline" asChild><Link href={`/events/${encodeURIComponent(eventId)}`}>返回活动</Link></Button>
              <Button type="submit" disabled={submitting || !canSubmit}>{submitting ? "提交中…" : "提交投稿"}</Button>
            </footer>
          </form>
          <aside>
            <section><h2>{event?.title || "活动信息"} <em>{event?.submissionOpen ? "开放中" : "待开放"}</em></h2><p><b>开始时间</b><strong>{formatDate(event?.startsAt)}</strong><span>结束时间：{formatDate(event?.endsAt)}</span></p></section>
            <section><h2>活动说明</h2><p className="xy-submit-event-body">{event?.body || "活动方暂未提供详细说明。"}</p></section>
            <section><h2>投稿要求</h2><p className="xy-submit-event-body">请选择自己已发布的内容后提交。其他规则与审核要求以活动说明为准。</p></section>
            <section><h2>作品预览</h2><div className="xy-submit-preview"><Image src="/prototype-assets/activity-submission/cover.png" alt="" aria-hidden="true" width={112} height={174} /><span><h3>{selected?.title || "尚未选择作品"}</h3><p>{selected ? `内容类型：${selected.objectType}` : "选择作品后将在这里确认投稿对象。"}</p><small><Clock3 /> 投稿不会修改原内容</small></span></div></section>
          </aside>
        </div>
        <p className="xy-submit-legal"><ShieldCheck /> 投稿即代表你同意遵守《星语社区创作规范》及活动说明。</p>
      </main>
    </AppShell>
  );
}
