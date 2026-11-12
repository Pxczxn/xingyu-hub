import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { collectionsApi } from "@/api/collections/collections.api";
import {
  COLLECTION_VISIBILITIES,
  visibilityLabel,
  type CollectionSummary,
  type CollectionVisibility,
} from "@/api/collections/collections.types";
import { ApiError } from "@/api/client";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * /me/collections — 我的收藏夹（列表）
 *
 * 骨架（A §3 `/me/*` 表 · Collections = SK2 · 幅/松/齐）
 * --------------------------------------------------
 * H=幅：`PageHero` 横幅。原来用的是 `PageHeader` —— A §4 已把它降级为「线」的一个
 *       变体，所以「幅」这一档必须换横幅组件，否则 11 页里所有列表页会共用同一个
 *       页头，H 轴形同不存在。主操作（新建收藏夹）落在横幅的 `actions` 槽：
 *       横幅的操作位在描述下方，是「下一步」，不是标题旁的第二个列。
 * D=松：每个收藏夹是一张独立卡面（标题链接 + 元信息 + 可选「公开页」链接），
 *       卡间距走 `--density-grid-gap`、卡内走 `--density-card-pad`。
 * R=齐：没有 rail。本页与徽章页（同为 幅/松/齐）的区分点在条目内部：这里每条有
 *       两个可能的目的地（管理页 / 公开页），徽章页只有状态，没有第二个链接。
 *
 * 新建表单仍是页头之后的第一个区块（不是页头的一部分），字段、标签、校验与提交
 * 逻辑一行未改；`loadState` 三态与 `reload()` 重试也原样保留。
 */

type LoadState = "loading" | "error" | "ready";

export function CollectionsPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<CollectionSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PRIVATE");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  function reload() {
    setLoadState("loading");
    collectionsApi
      .listMine()
      .then((data) => {
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(() => {
    let active = true;
    collectionsApi
      .listMine()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("请填写收藏夹名称");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setTitleError(null);
    setCreateError(null);
    try {
      const created = await collectionsApi.create({ title: trimmed, visibility });
      setItems((current) => [created, ...current]);
      setTitle("");
      setVisibility("PRIVATE");
      setCreating(false);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.problem.detail : "创建失败，请稍后重试。");
    } finally {
      pendingRef.current = false;
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={reload}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <PageHero
          title="我的收藏夹"
          description="按可见范围整理收藏夹。"
          actions={
            <Button
              variant="accent"
              onClick={() => {
                setCreating(true);
                setTitleError(null);
                setCreateError(null);
              }}
            >
              新建收藏夹
            </Button>
          }
        />
      }
    >
      {creating ? (
        <form
          onSubmit={(event) => void onCreate(event)}
          className="space-y-3 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
        >
          <label className="block text-meta font-medium text-foreground">
            名称
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              // Hand-written rather than the shared Input, so it carries its own
              // focus ring — same recipe as the feedback textarea.
              className="mt-1 w-full rounded-control border border-input bg-background px-3 py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              name="title"
              aria-invalid={Boolean(titleError)}
            />
          </label>
          {titleError ? (
            <p role="alert" className="text-meta text-destructive">
              {titleError}
            </p>
          ) : null}
          <fieldset>
            <legend className="text-meta font-medium text-foreground">可见范围</legend>
            <div className="mt-2 space-y-2">
              {COLLECTION_VISIBILITIES.map((value) => (
                <label key={value} className="flex items-center gap-2 text-meta">
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                  />
                  {visibilityLabel(value)}
                </label>
              ))}
            </div>
          </fieldset>
          {createError ? (
            <p role="alert" className="text-meta text-destructive">
              {createError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit">创建</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setTitle("");
                setTitleError(null);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <PageState kind="empty" title="还没有收藏夹" description="可以先新建一个收藏夹。" />
      ) : (
        /* D=松：等权卡面。Not whole-card links: two links with different
           destinations live in each item, so `.card-lift` would promise a click
           the card cannot honour. Surface only. */
        <ul className="grid gap-[var(--density-grid-gap)] md:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
            >
              <Link
                to={`/me/collections/${encodeURIComponent(item.id)}`}
                className="focus-ring text-h3 text-primary hover:text-accent-strong"
              >
                {item.title}
              </Link>
              <p className="text-caption text-muted-foreground">
                {`${visibilityLabel(item.visibility)} · ${item.itemCount} 项`}
              </p>
              {item.visibility === "PUBLIC" ? (
                <Link
                  to={`/collections/${encodeURIComponent(item.id)}`}
                  className="focus-ring mt-auto w-fit text-caption text-accent-strong hover:underline"
                >
                  公开页
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ArchetypeFrame>
  );
}
