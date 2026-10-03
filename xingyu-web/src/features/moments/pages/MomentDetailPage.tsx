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
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";

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

function formatMomentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
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
  }, [id, isAuthenticated]);

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
  if (state.kind === "error") return <PageState kind="error" />;
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="动态不存在或已不可访问" />;
  }

  const { moment } = state;
  const canEdit = ownerConfirmed && editWindowOpen(moment.createdAt);
  const windowHint = ownerConfirmed && !editWindowOpen(moment.createdAt);

  return (
    <article className="section-gap">
      <Link to="/moments" className="text-sm text-accent hover:underline">
        返回动态
      </Link>
      {/*
        Author first, then the body — the same order the feed uses.
        Without this the author vanished on arrival: you see who wrote a moment in
        the feed, tap it, and the detail view shows only text and a timestamp.
        The field only became available on 2026-10-03 (the contract carried just
        authorId before), and momentAuthorLabel still handles a server that has
        not shipped it.

        Body moves from text-base to the card step and the timestamp from
        text-sm to the meta step, matching the feed and the type scale.
      */}
      <span className="flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
        <span className="font-medium text-foreground-soft">{momentAuthorLabel(moment)}</span>
        <span aria-hidden>·</span>
        <time dateTime={moment.createdAt}>{formatMomentTime(moment.createdAt)}</time>
      </span>
      <p className="whitespace-pre-wrap text-card leading-6 text-primary">{moment.body}</p>

      {windowHint ? <p className="text-sm text-muted-foreground">已超过可编辑时间</p> : null}

      {canEdit && !editing ? (
        <Button
          type="button"
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

      {ownerConfirmed ? (
        <div>
          <Button
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={pendingRef.current}
          >
            删除动态
          </Button>
        </div>
      ) : null}

      {confirmDelete ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="确认删除动态"
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-sm text-foreground">确定删除这条动态吗？删除后将无法继续公开访问。</p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" onClick={() => void onTrash()}>
              确认删除
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={pendingRef.current}
            >
              取消
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
