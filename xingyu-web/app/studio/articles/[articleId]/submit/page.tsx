"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronRight, FileText, Globe2, ImageIcon, LockKeyhole, ShieldCheck, Sparkles, Stamp, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";

export default function SubmitArticlePage() {
  const params = useParams<{ articleId: string }>();
  const router = useRouter();
  const articleId = params.articleId;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof communityApi.getArticleDraft>> | null>(null);
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(true);

  useEffect(() => {
    communityApi.getArticleDraft(articleId).then(setDraft).catch(() => setError("无法加载文章草稿"));
  }, [articleId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.submitArticle(articleId);
      router.push("/studio/reviewing");
    } catch {
      setError("提交失败，请确认文章已填写完整并已登录");
      setSubmitting(false);
    }
  }

  const title = draft?.title || "文章标题暂未提供";
  const tags = draft?.topicIds || [];
  return <AppShell><main className="xy-article-submit">
    <section className="xy-submit-main">
      <header className="xy-submit-heading"><h1><Sparkles/> 提交审核 <Sparkles/></h1></header>
      <ol className="xy-submit-steps" aria-label="发布流程"><li className="done"><i><Check/></i><span>内容检查</span></li><li className="done"><i><Check/></i><span>发布设置</span></li><li className="active"><i>3</i><span>提交审核</span></li></ol>
      <p className="xy-submit-intro">请确认以下信息，提交后将进入审核流程</p>
      {error && <Alert variant="destructive" className="xy-submit-alert">{error}</Alert>}
      <section className="xy-submit-summary" aria-label="提交前确认">
        <SubmitLine icon={<FileText/>} label="文章标题"><h2>{title}</h2></SubmitLine>
        <SubmitLine icon={<Tags/>} label="主题标签"><div className="xy-submit-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></SubmitLine>
        <SubmitLine icon={<ImageIcon/>} label="封面预览"><Image src="/prototype-assets/article-submit/cover-preview.png" alt="文章封面预览" width={416} height={128}/></SubmitLine>
        <SubmitLine icon={<Globe2/>} label="公开范围"><div className="xy-submit-visibility"><b>{draft?.visibility || "可见范围暂未提供"}</b><small>发布设置以当前草稿数据为准</small></div><Button variant="outline" asChild><Link href={`/studio/articles/${articleId}/publish`}>修改</Link></Button></SubmitLine>
        <SubmitLine icon={<ShieldCheck/>} label="版权声明"><label className="xy-submit-copyright"><input type="checkbox" checked={copyrightConfirmed} onChange={(event) => setCopyrightConfirmed(event.target.checked)}/><span>我已确认本文为原创内容，且不侵犯他人知识产权<small>若存在抄袭、侵权等行为，星语社区有权对内容进行处理</small></span></label></SubmitLine>
      </section>
      <Button className="xy-submit-action" disabled={submitting || !copyrightConfirmed} onClick={() => void handleSubmit()}><Sparkles/>{submitting ? "提交中…" : "提交审核"}</Button>
      <p className="xy-submit-lock"><LockKeyhole/> 提交后不可修改，请确认信息无误</p>
    </section>
    <aside className="xy-submit-sidebar">
      <h2>审核流程</h2>
      <ol className="xy-review-timeline"><li className="current"><i/><div><b>提交审核</b><time>提交时间暂未提供</time><p>提交后进入审核队列</p></div></li><li><i/><div><b>内容审核</b><p>审核状态暂未提供</p><small>审核进度将通过通知中心同步</small></div></li><li><i/><div><b>审核结果</b><p>结果暂未提供</p><small>审核完成后会收到通知</small></div></li></ol>
      <section className="xy-submit-guide"><h2>创作指引</h2><GuideItem icon={<Stamp/>} title="内容真实原创" text="分享你的真实思考与经验，共同维护星语社区的内容质量"/><GuideItem icon={<ShieldCheck/>} title="遵守社区规范" text="不发布违法违规、敏感或不友善的内容，营造温暖友善的交流氛围"/><GuideItem icon={<ShieldCheck/>} title="尊重知识产权" text="引用他人内容时注明来源，共同尊重作者的劳动成果"/></section>
      <Link className="xy-submit-rules" href="/guide">查看完整《创作规范》 <ChevronRight/></Link>
    </aside>
  </main></AppShell>;
}

function SubmitLine({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) { return <div className="xy-submit-line"><span className="xy-submit-label">{icon}{label}</span><div className="xy-submit-line-content">{children}</div></div>; }
function GuideItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <article><i>{icon}</i><span><b>{title}</b><small>{text}</small></span></article>; }
