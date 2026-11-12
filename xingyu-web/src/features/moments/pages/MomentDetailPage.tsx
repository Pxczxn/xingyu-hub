import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
import {
  MOMENT_EDIT_WINDOW_SECONDS,
  OWNER_LIST_LIMIT,
  type MomentView,
  momentAuthorLabel,
} from "@/api/moments/moments.types";
import { ApiError } from "@/api/client";
import { ArchetypeFrame } from "@/components/layout";
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
import { ArticleInteractions } from "@/features/article/components/ArticleInteractions";
import { CommentSection } from "@/features/article/components/CommentSection";
import { ReportLink } from "@/features/moderation/components/ReportLink";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { MOMENT_MEASURE } from "@/features/moments/moment-measure";
import { formatDateTime, formatRelativeTime } from "@/lib/relative-time";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; moment: MomentView };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

function isEditWindowConflict(err: unknown): boolean {
  return err instanceof ApiError && err.problem.status === 409 && err.problem.code === "CONFLICT";
}

function editWindowOpen(createdAt: string): boolean {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return true;
  return Date.now() - created <= MOMENT_EDIT_WINDOW_SECONDS * 1000;
}

export function MomentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [ownerConfirmed, setOwnerConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRef = useRef(false);
  const generationRef = useRef(0);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run generation guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setOwnerConfirmed(false);
    setEditing(false);
    setDraft("");
    setDraftError(null);
    setSaveError(null);
    setConfirmDelete(false);
    pendingRef.current = false;

    if (!id) {
      setState({ kind: "unavailable" });
      return;
    }

    setState({ kind: "loading" });
    momentsApi
      .getById(id)
      .then((moment) => {
        if (generation !== generationRef.current) return;
        setDraft(moment.body);
        setState({ kind: "ready", moment });
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setState({ kind: isNotFound(err) ? "unavailable" : "error" });
      });

    if (isAuthenticated) {
      momentsApi
        .listMine(OWNER_LIST_LIMIT)
        .then((mine) => {
          if (generation !== generationRef.current) return;
          setOwnerConfirmed(mine.some((item) => item.id === id));
        })
        .catch(() => {
          if (generation !== generationRef.current) return;
          setOwnerConfirmed(false);
        });
    }

    return () => {
      generationRef.current += 1;
    };
  }, [id, isAuthenticated, reloadKey]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraftError("请填写动态正文");
      return;
    }
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setDraftError(null);
    setSaveError(null);
    try {
      const updated = await momentsApi.update(id, { body: trimmed });
      setState({ kind: "ready", moment: updated });
      setDraft(updated.body);
      setEditing(false);
    } catch (error) {
      if (isNotFound(error)) {
        setState({ kind: "unavailable" });
        setEditing(false);
      } else if (isEditWindowConflict(error)) {
        setSaveError("已超过可编辑时间窗口");
        setEditing(false);
      } else {
        setSaveError(error instanceof ApiError ? error.problem.detail : "保存失败，请稍后重试。");
      }
    } finally {
      pendingRef.current = false;
    }
  }

  async function onTrash() {
    if (!id || pendingRef.current) return;
    pendingRef.current = true;
    setSaveError(null);
    try {
      await momentsApi.trash(id);
      navigate("/moments", { replace: true });
    } catch (error) {
      if (isNotFound(error)) {
        setState({ kind: "unavailable" });
        setConfirmDelete(false);
      } else {
        setConfirmDelete(false);
        setSaveError(error instanceof ApiError ? error.problem.detail : "删除失败，请稍后重试。");
      }
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
      </div>
    );
  }
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="动态不存在或已不可访问" />;
  }

  const { moment } = state;
  const canEdit = ownerConfirmed && editWindowOpen(moment.createdAt);
  const windowHint = ownerConfirmed && !editWindowOpen(moment.createdAt);

  /*
   * SK1 阅读栏 · H 线 / D 松 / R 错（A §3 的 MomentDetail 行）。
   *
   *   skeleton="SK1"    → `[measure | 220px]`，右轨由 `SectionRail` 粘住 —— 这就是
   *                       R=错（主列 + 侧轨）。右轨放的是这条动态的作者、发布时刻
   *                       与编辑窗口规则：它们是「关于这条」的事实，不是正文。
   *   header="line"     → H=线：无面 masthead —— 本页的页头只有「返回动态」一行，
   *                       没有横幅、没有卡面。
   *   density="loose"   → D=松：动态本身、编辑表单、确认删除、评论区各是独立块。
   *
   * 页内 h1 用 `sr-only`：「动态」没有标题，视觉上的第一块就是正文本身，而 A §7.3
   * 允许「视觉上没有标题位」的页面用 `sr-only` h1 承担可访问性标识（`SeriesList`/
   * `EditorPage` 补 h1 时同一条判据）。所以这一页仍然恰好 1 个 h1，且不造横幅。
   *
   * Batch 14 的宽度结论保留：整页仍锁 `MOMENT_MEASURE`（46rem）。它现在挂在
   * 「动态正文」这张卡上（`<article>`），因为 SK1 的主列已经被 `--reading-measure`
   * 锁住，两处都只是上界 —— 阅读时正文宽度仍与动态广场一致，点进再退回不会重新折行。
   */
  return (
    <ArchetypeFrame
      skeleton="SK1"
      header="line"
      density="loose"
      headerSlot={
        <div className="flex flex-col gap-3">
          {/* 页面标识：没有可见标题位，但路由需要一个名字。 */}
          <h1 className="sr-only">动态</h1>
          <Link
            to="/moments"
            className="focus-ring self-start rounded-sm text-meta text-accent-strong hover:underline"
          >
            返回动态
          </Link>
        </div>
      }
      rail={<MomentDetailRail moment={moment} />}
      /* landmark 名与右轨里两块卡的标题都不同名。 */
      railLabel="动态侧栏"
    >
      {/*
        P0 — the moment itself, as one surface.

        On the feed every moment is already a card, so the detail view — three
        loose lines and two stray links — read as the *less* finished of the
        two. A short body needs a frame more than a long one does: with no
        boundary between them, the page's own subject looks like the page's
        preamble.

        No `card-lift`. That class is for whole-card targets; this card holds
        several separate ones (the interaction bar, the owner controls, the
        report link), so lifting it on hover would promise a click the surface
        cannot honour. Static frame: border only.

        Author first, then the body — the same order the feed uses. Without this
        the author vanished on arrival: you see who wrote a moment in the feed,
        tap it, and the detail view shows only text and a timestamp. The field
        only became available on 2026-10-03 (the contract carried just authorId
        before), and momentAuthorLabel still handles a server that has not
        shipped it.

        The author is a link only when the server resolved a username. It is
        optional on the contract, and /u/:username would 404 on an empty
        segment — the same rule CommentSection applies to its own authors.
      */}
      <article className={cn("mx-auto w-full rounded-card border border-border/70 bg-card", MOMENT_MEASURE)}>
        <div className="p-4">
          <span className="flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
            {moment.authorUsername ? (
              <Link
                to={`/u/${moment.authorUsername}`}
                className="font-medium text-foreground-soft transition-colors hover:text-accent-strong"
              >
                {momentAuthorLabel(moment)}
              </Link>
            ) : (
              <span className="font-medium text-foreground-soft">{momentAuthorLabel(moment)}</span>
            )}
            <span aria-hidden>·</span>
            <time dateTime={moment.createdAt} title={formatDateTime(moment.createdAt) ?? undefined}>
              {formatRelativeTime(moment.createdAt) ?? moment.createdAt}
            </time>
          </span>
          <p className="mt-2 whitespace-pre-wrap text-card leading-7 text-primary">{moment.body}</p>
          {windowHint ? (
            <p className="mt-2 text-meta text-muted-foreground">已超过可编辑时间</p>
          ) : null}
        </div>

        {/*
          One action row for the card: interactions on the left, and on the
          right whichever secondary action this viewer has. Owner controls and
          the report link are mutually exclusive by construction — you cannot
          report your own moment — so they share the slot instead of stacking
          two rows under the body.
        */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 px-4 py-3">
          <ArticleInteractions objectType="MOMENT" objectId={moment.id} />
          {ownerConfirmed ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canEdit && !editing ? (
                <Button
                  type="button"
                  className="w-fit"
                  onClick={() => {
                    setDraft(moment.body);
                    setDraftError(null);
                    setSaveError(null);
                    setEditing(true);
                  }}
                >
                  编辑动态
                </Button>
              ) : null}
              <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-fit border-destructive/40 text-destructive hover:border-destructive/60 hover:text-destructive"
                    disabled={pendingRef.current}
                  >
                    删除动态
                  </Button>
                </DialogTrigger>
                <DialogContent role="alertdialog" className="max-w-sm rounded-xl bg-card">
                  <DialogTitle className="text-base font-semibold text-primary">
                    删除动态？
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-muted-foreground">
                    确定删除这条动态吗？删除后将无法继续公开访问。
                  </DialogDescription>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      disabled={pendingRef.current}
                    >
                      取消
                    </Button>
                    <Button variant="destructive" onClick={() => void onTrash()}>
                      确认删除
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <ReportLink objectType="MOMENT" objectId={moment.id} className="ml-auto" />
          )}
        </div>
      </article>

      {editing ? (
        <form
          onSubmit={(event) => void onSave(event)}
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <label className="block text-sm font-medium">
            动态正文
            <textarea
              name="body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          {draftError ? (
            <p role="alert" className="text-sm text-destructive">
              {draftError}
            </p>
          ) : null}
          <Button type="submit">保存</Button>
        </form>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {/*
        P2 — comments, on the same generic endpoint the article view uses.
        `MOMENT` is a first-class interaction object type on the server: the
        comment table is keyed by (objectType, objectId) and the controller
        upper-cases whatever segment arrives. Listing requires auth, which the
        component handles itself — sign-in prompt, no doomed request.
      */}
      <CommentSection objectType="MOMENT" objectId={moment.id} />
    </ArchetypeFrame>
  );
}

/**
 * 右轨（R=错 的那条侧轨）：关于这条动态 + 动态规则。
 *
 * 它只是一个**内容组件** —— 粘住、滚动与 landmark 由 `ArchetypeFrame` 里的
 * `SectionRail` 负责（`SectionRail.tsx:41-56`），所以这里没有再包一层 `<aside>`。
 *
 * 两块都只用本页已有的字段：作者展示名（`momentAuthorLabel` 已处理服务端未解析
 * username 的情况）、发布精确时刻、以及产品规则里本来就有的编辑窗口
 * （`MOMENT_EDIT_WINDOW_SECONDS` —— 同页 `editWindowOpen` 用的就是它）。不发请求、
 * 不编造计数：单条动态的接口不返回点赞/评论计数，所以侧轨里没有这两个数字。
 */
function MomentDetailRail({ moment }: { moment: MomentView }) {
  const authorName = momentAuthorLabel(moment);
  const publishedAt = formatDateTime(moment.createdAt);

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="moment-rail-about" className="rounded-card border border-border/70 bg-card p-4">
        <h2 id="moment-rail-about" className="text-h3 font-semibold text-primary">
          关于这条动态
        </h2>
        <dl className="mt-3 flex flex-col gap-3">
          <div>
            <dt className="text-caption text-muted-foreground">作者</dt>
            <dd className="mt-1 text-meta text-foreground">
              {moment.authorUsername ? (
                <Link
                  to={`/u/${moment.authorUsername}`}
                  className="focus-ring rounded-sm font-medium transition-colors hover:text-accent-strong"
                >
                  {authorName}
                </Link>
              ) : (
                <span className="font-medium">{authorName}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">发布</dt>
            <dd className="mt-1 text-meta">
              <time dateTime={moment.createdAt} className="tabular-nums text-foreground">
                {publishedAt ?? formatRelativeTime(moment.createdAt) ?? "时间未知"}
              </time>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="moment-rail-rules" className="rounded-card border border-border/70 bg-card p-4">
        <h2 id="moment-rail-rules" className="text-h3 font-semibold text-primary">
          动态规则
        </h2>
        <p className="mt-2 text-meta leading-6 text-muted-foreground">
          发布后立即公开可见，{Math.round(MOMENT_EDIT_WINDOW_SECONDS / 60)} 分钟内可编辑；
          删除后将从动态广场消失。
        </p>
      </section>
    </div>
  );
}
