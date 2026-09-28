"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, FolderHeart, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";

export default function EditCollectionPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi.getCollection(collectionId)
      .then((collection) => {
        setTitle(collection.title ?? "");
        setVisibility(collection.visibility ?? "PRIVATE");
      })
      .catch(() => setError("收藏夹暂时无法加载，请稍后重试"))
      .finally(() => setLoading(false));
  }, [collectionId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      await communityApi.updateCollection(collectionId, { title: title.trim(), visibility });
      router.push(`/me/collections/${collectionId}`);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return <AppShell><main className="mx-auto w-full max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10">
    <Link href={`/me/collections/${collectionId}`} className="inline-flex items-center gap-2 text-sm text-[#5d697d] hover:text-[#24365d]"><ArrowLeft className="h-4 w-4" />返回收藏夹</Link>
    <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[#ebe4da] bg-white/80 p-6 shadow-[0_14px_36px_rgb(42_35_27/.05)] sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff0de] text-[#c37a24]"><FolderHeart className="h-6 w-6" /></span>
      <h1 className="mt-5 text-3xl font-semibold text-[#172a50]">编辑收藏夹</h1>
      <p className="mt-2 text-sm leading-6 text-[#6f7b8d]">修改收藏夹名称和访问范围。</p>
      {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
      {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#c37a24]" /></div> : <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm font-medium text-[#314469]">收藏夹名称<Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required className="mt-2 h-11" /></label>
        <label className="block text-sm font-medium text-[#314469]">可见范围<select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#e8ded1] bg-white px-3 text-sm text-slate-700"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开收藏夹</option><option value="UNLISTED">获得链接的人可见</option></select></label>
        <div className="flex justify-end gap-3 pt-2"><Button asChild type="button" variant="outline"><Link href={`/me/collections/${collectionId}`}>取消</Link></Button><Button disabled={saving || !title.trim()} className="bg-[#e88b25] text-white hover:bg-[#d77c1d]">{saving ? "保存中…" : "保存修改"}</Button></div>
      </form>}
    </section>
  </main></AppShell>;
}
