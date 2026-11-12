import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import {
  COLLECTION_VISIBILITIES,
  isCollectionVisibility,
  visibilityLabel,
  type CollectionDetail,
  type CollectionVisibility,
} from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/*
 * /me/collections/:id — 收藏夹管理（所有者视图）
 *
 * 骨架（A §3 `/me/*` 表 · CollectionManage = SK3 · 线/紧/错）
 * -------------------------------------------------------
 * H=线：`PageMasthead` 用**收藏夹名**当标题（不是一个固定页面名：这一页的对象
 *       就是那个收藏夹），返回链接放 `actions` 槽，于是首屏省掉一行。
 * D=紧：收录内容是发丝线行（标题 + 类型），不是逐项卡面；表单是一块控制面板，
 *       它本身可以有面，因为它不是一个「条目」。
 * R=错：`rail` 存在 —— 右轨给只读概览（范围 / 收录项数 / 类型分布），编辑仍只在主列。
 *
 * 右轨刻意不与条目文本撞词：类型分布排成一行字符串（`文章 1 · 系列 1`），
 * 而不是一列「文章 / 系列」；条目列表里的类型标签才是那个文本的唯一一处
 * （`collection-manage-page.test.tsx` 用 `getByText("系列")` 断言）。
 *
 * 行为未变：`listMine()` 先做所有权校验、`getById()`、`reloadKey` 重试、四态
 * （loading / notfound / error / ready）、保存与删除、`role="alertdialog"` 的二次确认
 * 全部保留；`getByLabelText("名称")` 仍是表单里那个 label 包着 input 的结构。
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ready"; collection: CollectionDetail };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

function objectTypeLabel(type: string): string {
  if (type === "SERIES") return "系列";
  if (type === "MOMENT") return "动态";
  if (type === "ARTICLE") return "文章";
  return type;
}

function itemHref(objectType: string, objectId: string): string | null {
  if (objectType.toUpperCase() === "ARTICLE" && objectId)
    return `/articles/${encodeURIComponent(objectId)}`;
  return null;
}

export function CollectionManagePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PRIVATE");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRef = useRef(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "notfound" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const mine = await collectionsApi.listMine();
        if (!active) return;
        if (!mine.some((item) => item.id === id)) {
          setState({ kind: "notfound" });
          return;
        }
        const collection = await collectionsApi.getById(id);
        if (!active) return;
        setTitle(collection.title);
        setVisibility(
          isCollectionVisibility(collection.visibility) ? collection.visibility : "UNLISTED",
        );
        setState({ kind: "ready", collection });
      } catch (err: unknown) {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "notfound" : "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("请填写收藏夹名称");
      return;
    }
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setTitleError(null);
    setSaveError(null);
    try {
      const summary = await collectionsApi.update(id, { title: trimmed, visibility });
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              collection: {
                ...current.collection,
                title: summary.title,
                visibility: summary.visibility,
              },
            }
          : current,
      );
      setTitle(summary.title);
      if (isCollectionVisibility(summary.visibility)) setVisibility(summary.visibility);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。");
    } finally {
      pendingRef.current = false;
    }
  }

  async function onDelete() {
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setSaveError(null);
    try {
      await collectionsApi.remove(id);
      navigate("/me/collections", { replace: true });
    } catch (error) {
      setConfirmDelete(false);
      setSaveError(error instanceof ApiError ? error.problem.detail : "删除失败，请稍后重试。");
      pendingRef.current = false;
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
        <p className="text-center">
          <BackLink />
        </p>
      </div>
    );
  }
  if (state.kind === "notfound") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="收藏夹不存在或暂不可访问"
          description="地址可能有误，或该收藏夹当前不可查看。"
        />
        <BackLink />
      </div>
    );
  }

  const { collection } = state;
  const items = collection.items ?? [];

  return (
    <ArchetypeFrame
      skeleton="SK3"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead
          title={collection.title}
          description={`收录 ${items.length} 项`}
          actions={<BackLink />}
        />
      }
      rail={<ManageRail collection={collection} items={items} />}
      railLabel="收藏夹侧栏"
    >
      <form
        onSubmit={(event) => void onSave(event)}
        className="space-y-3 rounded-card border border-border/70 bg-card p-4"
      >
        <label className="block text-meta font-medium">
          名称
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            // Hand-written rather than the shared Input, so it carries its own
            // focus ring — same recipe as the feedback textarea.
            className="mt-1 w-full rounded-control border border-input bg-background px-3 py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            name="title"
          />
        </label>
        {titleError ? (
          <p role="alert" className="text-meta text-destructive">
            {titleError}
          </p>
        ) : null}
        <fieldset>
          <legend className="text-meta font-medium">可见范围</legend>
          <div className="mt-2 space-y-2">
            {COLLECTION_VISIBILITIES.map((value) => (
              <label key={value} className="flex items-center gap-2 text-meta">
                <input
                  type="radio"
                  name="manage-visibility"
                  value={value}
                  checked={visibility === value}
                  onChange={() => setVisibility(value)}
                />
                {visibilityLabel(value)}
              </label>
            ))}
          </div>
        </fieldset>
        {saveError ? (
          <p role="alert" className="text-meta text-destructive">
            {saveError}
          </p>
        ) : null}
        <Button type="submit">保存</Button>
      </form>

      <section aria-labelledby="collection-items-heading" className="min-w-0">
        <h2 id="collection-items-heading" className="section-heading">
          收录内容
        </h2>
        {items.length === 0 ? (
          <p className="mt-2 text-meta text-muted-foreground">暂时没有收录内容</p>
        ) : (
          /* D=紧：发丝线行，无逐项卡面。 */
          <ul className="mt-2 border-t border-border/70">
            {items.map((item) => {
              const href = itemHref(item.objectType, item.objectId);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 px-1 py-3 last:border-b-0"
                >
                  {href ? (
                    <Link
                      to={href}
                      className="focus-ring min-w-0 truncate text-body text-foreground hover:text-accent-strong"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="min-w-0 truncate text-body text-foreground">{item.title}</p>
                  )}
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {objectTypeLabel(item.objectType)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div>
        {/* 浮层统一：删除确认走 `components/ui/dialog`（role="alertdialog"），
            不再用挂了 aria-modal 却没有遮罩的行内块。取消在左、破坏性动作在右，
            关闭后 Radix 把焦点还给这个 DialogTrigger。 */}
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogTrigger asChild>
            <Button variant="destructive">删除收藏夹</Button>
          </DialogTrigger>
          <DialogContent role="alertdialog" className="max-w-sm rounded-xl bg-card">
            <DialogTitle className="text-base font-semibold text-primary">删除收藏夹？</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              确定删除这个收藏夹吗？此操作无法撤销。
            </DialogDescription>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                取消
              </Button>
              <Button variant="destructive" onClick={() => void onDelete()}>
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ArchetypeFrame>
  );
}

/**
 * 右栏（R=错）：只读概览。类型分布排成**一行字符串**，不排成一列类型名 ——
 * 见文件顶部注释（条目里的类型标签必须保持是那个文本的唯一一处）。
 */
function ManageRail({
  collection,
  items,
}: {
  collection: CollectionDetail;
  items: NonNullable<CollectionDetail["items"]>;
}) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const label = objectTypeLabel(item.objectType);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const distribution = Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="collection-rail-overview"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="collection-rail-overview" className="text-h3 text-primary">
          收藏夹概览
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">范围</dt>
            <dd className="shrink-0 text-meta text-foreground-soft">
              {visibilityLabel(collection.visibility)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">收录条目</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {items.length} 项
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="collection-rail-types"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="collection-rail-types" className="text-h3 text-primary">
          类型分布
        </h2>
        <p className="mt-2 text-meta text-foreground-soft">
          {distribution || "暂无可统计的条目"}
        </p>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/me/collections"
      className="focus-ring text-meta text-accent-strong hover:underline"
    >
      返回收藏夹列表
    </Link>
  );
}
