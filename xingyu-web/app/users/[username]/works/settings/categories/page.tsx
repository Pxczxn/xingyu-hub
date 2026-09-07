"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Archive, Folder, GripVertical, ListOrdered, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { communityApi, type CreationCategory } from "@/lib/community-api";

export default function CategorySettingsPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const createRef = useRef<HTMLFormElement>(null);
  const [categories, setCategories] = useState<CreationCategory[] | null>(null);
  const [meUsername, setMeUsername] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const me = await communityApi.getMyProfile();
    setMeUsername(me.username);
    if (me.username !== username) {
      setError("仅可管理自己的创作空间分类");
      return;
    }
    const data = await communityApi.listCategories();
    const ordered = [...data].sort((left, right) => left.sortOrder - right.sortOrder);
    setCategories(ordered);
    setSelectedId((current) => current && ordered.some((item) => item.id === current) ? current : ordered[0]?.id ?? null);
  }

  useEffect(() => { void load().catch((cause) => setError(cause instanceof ApiError ? cause.problem.detail || "加载失败" : "加载失败")); }, [username]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await communityApi.createCategory({ name, slug: slug || undefined });
      setName(""); setSlug(""); setSuccess("分类已创建");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.problem.detail || cause.problem.title : "创建失败");
    } finally { setSubmitting(false); }
  }

  async function archiveCategory(category: CreationCategory) {
    setError(null); setSuccess(null);
    try {
      await communityApi.updateCategory(category.id, { status: "ARCHIVED", lockVersion: category.lockVersion });
      setSuccess(`已归档「${category.name}」`); await load();
    } catch (cause) { setError(cause instanceof ApiError ? cause.problem.detail || "归档失败" : "归档失败"); }
  }

  async function deleteCategory(category: CreationCategory) {
    if (!confirm(`确定删除分类「${category.name}」？`)) return;
    setError(null); setSuccess(null);
    try {
      await communityApi.deleteCategory(category.id);
      setSuccess(`已删除「${category.name}」`); await load();
    } catch (cause) { setError(cause instanceof ApiError ? cause.problem.detail || "删除失败" : "删除失败"); }
  }

  if (meUsername && meUsername !== username) {
    return <AppShell><main className="xy-category-guard"><Alert variant="destructive">{error}</Alert><Button variant="outline" onClick={() => router.push(`/users/${meUsername}/works`)}>返回我的创作空间</Button></main></AppShell>;
  }

  const selected = categories?.find((category) => category.id === selectedId) ?? null;
  return (
    <AppShell>
      <main className="xy-category-page">
        <header className="xy-category-heading"><p>创作空间 / 内容整理</p><h1>个人分类</h1><span>分类仅用于个人创作整理，不会在公开页面展示。</span></header>
        <div className="xy-category-layout">
          <section className="xy-category-list-panel">
            <header><div><h2>分类列表</h2><span>按排序字段展示</span></div><button type="button" onClick={() => createRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}><Plus />新建分类</button></header>
            {error ? <Alert className="mt-4" variant="destructive">{error}</Alert> : null}
            {success ? <Alert className="mt-4" variant="success">{success}</Alert> : null}
            {!categories ? <p className="xy-category-status">正在加载分类…</p> : null}
            {categories?.length === 0 ? <p className="xy-category-status">还没有分类，创建第一个吧。</p> : null}
            {categories?.length ? <div className="xy-category-rows">
              {categories.map((category) => <article className={selectedId === category.id ? "is-selected" : ""} key={category.id} onClick={() => setSelectedId(category.id)}>
                <GripVertical aria-hidden="true" /><span className="xy-category-row-icon"><Folder /></span>
                <div><h3>{category.name}{category.status === "ARCHIVED" ? <small>已归档</small> : null}</h3><p>URL 别名：{category.slug || "暂未设置"}</p></div>
                <span className="xy-category-order"><ListOrdered />排序 {category.sortOrder}</span>
                <div className="xy-category-actions">
                  {category.status !== "ARCHIVED" ? <button type="button" aria-label={`归档 ${category.name}`} onClick={(event) => { event.stopPropagation(); void archiveCategory(category); }}><Archive /></button> : null}
                  <button type="button" aria-label={`删除 ${category.name}`} onClick={(event) => { event.stopPropagation(); void deleteCategory(category); }}><Trash2 /></button>
                </div>
              </article>)}
            </div> : null}
            <footer><GripVertical /> 当前接口不提供拖拽排序保存能力，列表按已有排序字段显示。</footer>
          </section>

          <aside className="xy-category-aside">
            <section className="xy-category-preview"><h2>分类预览</h2>{selected ? <div><span><Folder /></span><h3>{selected.name}</h3><p>{selected.status === "ARCHIVED" ? "该分类已归档，不再用于内容整理。" : "这是当前选中的个人创作分类。"}</p><small>别名：{selected.slug || "暂未设置"}</small><b>排序 {selected.sortOrder}</b></div> : <p>选择一个分类后预览其基本信息。</p>}</section>
            <form className="xy-category-create" ref={createRef} onSubmit={onCreate}><h2>新增分类</h2><p>创建新的分类，整理你的创作内容。</p><div><Label htmlFor="category-name">分类名称</Label><Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} required /></div><div><Label htmlFor="category-slug">URL 别名（可选）</Label><Input id="category-slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="留空则根据名称生成" /></div><Button type="submit" disabled={submitting}><Plus />{submitting ? "创建中…" : "新增分类"}</Button></form>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
