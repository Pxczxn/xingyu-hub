import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { creationSpaceApi } from "@/api/creation-space/creation-space.api";
import type { CreationSpaceCategory } from "@/api/creation-space/creation-space.types";
import { useAuth } from "@/features/auth/auth.store";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  categoryPathHint,
  countArchived,
  describeCategoryError,
  effectiveSlug,
  optionalSlug,
  shouldReloadAfterFailure,
  sortForDisplay,
  statusLabel,
  statusTone,
  validateName,
  validateSlug,
} from "../creation-space-category";

/*
 * /studio/categories — 创作空间分类 (Phase 2N)
 *
 * ⚠️ THIS PAGE IS NOT A MIGRATION — IT FILLS A HOLE LEGACY LEFT.
 *
 * `CommunityCreationSpaceController` has a complete category CRUD
 * (list/create/update/delete, with slug validation, optimistic locking and
 * archival), but Legacy never built a page for it: `app/studio/categories/`
 * exists as an empty directory with no `page.tsx`, and its redirect table sends
 * `/studio/categories` to `/studio/settings` — a 40-line shell that lists a
 * "创作空间分类" row pointing at ITSELF. So the feature was implemented
 * server-side and unreachable from the product.
 *
 * Design decisions taken from the real contract, not from symmetry with other
 * creator pages:
 *
 *   - DELETE really deletes, and ARCHIVE is a status update. These are two
 *     different operations with two different consequences, so they get two
 *     different buttons and two different confirmations. Labelling the delete
 *     button "删除" and the archive button "归档" is the whole point.
 *   - `update` needs `lockVersion`. The list is re-read after ANY 409/404
 *     (`shouldReloadAfterFailure`) because a retry with the same stale version
 *     would fail identically — the UI must not offer a "retry" that cannot work.
 *   - `sortOrder` is not writable, so there is no drag/reorder affordance.
 *   - `slug` is immutable after creation in this UI. The API allows changing it,
 *     but nothing in the product surfaces a category's slug yet, so offering the
 *     rename would be a control with no visible effect.
 */

type ListState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "missing-space" }
  | { kind: "ready"; categories: CreationSpaceCategory[] };

export function StudioCategoriesPage() {
  const { user } = useAuth();
  const [state, setState] = useState<ListState>({ kind: "loading" });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /** Which row is being renamed / archived, and the value in its input. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowPendingId, setRowPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const createPendingRef = useRef(false);
  const rowPendingRef = useRef(false);

  const load = useCallback(async (signal?: { active: boolean }) => {
    try {
      const categories = await creationSpaceApi.listCategories();
      if (signal && !signal.active) return;
      setState({ kind: "ready", categories });
    } catch (error) {
      if (signal && !signal.active) return;
      const status = error instanceof ApiError ? error.problem.status : 0;
      // 404 here means "创作空间不存在" — every category call requires one, so
      // this is not an empty list, it is a missing precondition.
      setState(status === 404 ? { kind: "missing-space" } : { kind: "error" });
    }
  }, []);

  useEffect(() => {
    const signal = { active: true };
    void load(signal);
    return () => {
      signal.active = false;
    };
  }, [load]);

  const categories = state.kind === "ready" ? state.categories : [];
  const displayed = useMemo(() => sortForDisplay(categories), [categories]);
  const archivedCount = countArchived(categories);

  const derivedSlug = effectiveSlug(name, slug);
  const nameProblem = validateName(name);
  const slugProblem = validateSlug(slug);

  const onCreate = useCallback(async () => {
    if (createPendingRef.current) return;
    // Validate locally so the user gets the message without a round trip; the
    // server would reject exactly these inputs anyway.
    if (nameProblem) {
      setCreateError(nameProblem);
      return;
    }
    if (slugProblem) {
      setCreateError(slugProblem);
      return;
    }
    createPendingRef.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      await creationSpaceApi.createCategory({
        name: name.trim(),
        slug: optionalSlug(slug),
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      await load();
    } catch (error) {
      setCreateError(describeCategoryError(error, "创建分类失败，请稍后重试。"));
      // A slug clash means our list may be stale; re-read so the user can see
      // the category that already owns the slug.
      if (shouldReloadAfterFailure(error)) await load();
    } finally {
      createPendingRef.current = false;
      setCreating(false);
    }
  }, [name, slug, nameProblem, slugProblem, load]);

  const onRename = useCallback(
    async (category: CreationSpaceCategory) => {
      if (rowPendingRef.current) return;
      const trimmed = renameValue.trim();
      const problem = validateName(renameValue);
      if (problem) {
        setRowError(problem);
        return;
      }
      if (trimmed === category.name) {
        setRenamingId(null);
        setRowError(null);
        return;
      }
      rowPendingRef.current = true;
      setRowPendingId(category.id);
      setRowError(null);
      try {
        await creationSpaceApi.updateCategory(category.id, {
          lockVersion: category.lockVersion,
          name: trimmed,
        });
        setRenamingId(null);
        await load();
      } catch (error) {
        setRowError(describeCategoryError(error, "重命名失败，请稍后重试。"));
        // 409/404: our lockVersion is stale and a retry would fail the same way.
        if (shouldReloadAfterFailure(error)) {
          setRenamingId(null);
          await load();
        }
      } finally {
        rowPendingRef.current = false;
        setRowPendingId(null);
      }
    },
    [renameValue, load],
  );

  const onSetStatus = useCallback(
    async (category: CreationSpaceCategory, status: "ACTIVE" | "ARCHIVED") => {
      if (rowPendingRef.current) return;
      rowPendingRef.current = true;
      setRowPendingId(category.id);
      setRowError(null);
      try {
        await creationSpaceApi.updateCategory(category.id, {
          lockVersion: category.lockVersion,
          status,
        });
        await load();
      } catch (error) {
        setRowError(describeCategoryError(error, "更新分类失败，请稍后重试。"));
        if (shouldReloadAfterFailure(error)) await load();
      } finally {
        rowPendingRef.current = false;
        setRowPendingId(null);
      }
    },
    [load],
  );

  const onDelete = useCallback(
    async (category: CreationSpaceCategory) => {
      if (rowPendingRef.current) return;
      rowPendingRef.current = true;
      setRowPendingId(category.id);
      setRowError(null);
      try {
        await creationSpaceApi.deleteCategory(category.id);
        setConfirmDeleteId(null);
        await load();
      } catch (error) {
        setRowError(describeCategoryError(error, "删除分类失败，请稍后重试。"));
        if (shouldReloadAfterFailure(error)) {
          setConfirmDeleteId(null);
          await load();
        }
      } finally {
        rowPendingRef.current = false;
        setRowPendingId(null);
      }
    },
    [load],
  );

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <PageState
        kind="error"
        title="加载分类失败"
        description="暂时无法读取你的创作空间分类，请稍后重试。"
      />
    );
  }

  if (state.kind === "missing-space") {
    return (
      <PageState
        kind="empty"
        title="创作空间尚未建立"
        // Says WHICH precondition is missing rather than showing an empty list
        // the user could not explain.
        description="分类挂在创作空间下，而你目前还没有创作空间。创建空间后才能管理分类。"
      />
    );
  }

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio" className="hover:text-foreground">
          创作中心
        </Link>
        <span aria-hidden="true"> / </span>
        <span>创作空间分类</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">创作空间分类</h1>
        <p className="text-sm text-muted-foreground">给作品分组，方便在你的主页里按分类浏览。</p>
      </header>

      <Card>
        <CardContent className="p-5">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <h2 className="section-heading">新建分类</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="category-name" className="text-xs text-muted-foreground">
                名称
              </label>
              <Input
                id="category-name"
                data-testid="category-name"
                value={name}
                maxLength={80}
                disabled={creating}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slugTouched) setSlug(effectiveSlug(event.target.value, ""));
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="category-slug" className="text-xs text-muted-foreground">
                别名（可选）
              </label>
              <Input
                id="category-slug"
                data-testid="category-slug"
                value={slug}
                disabled={creating || !slugTouched}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
              {/* Shows the value that will actually be submitted, including the
                  one the server would derive — so "leave it blank" is not a
                  mystery. */}
              <p className="text-xs text-muted-foreground" data-testid="category-slug-preview">
                {derivedSlug
                  ? `地址预览：${categoryPathHint(user?.username ?? null, derivedSlug)}`
                  : "留空时会根据名称自动生成别名。"}
              </p>
            </div>

            {createError ? (
              <p
                role="alert"
                data-testid="category-create-error"
                className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
              >
                {createError}
              </p>
            ) : null}

            <div>
              <Button
                type="submit"
                variant="default"
                size="sm"
                data-testid="category-create"
                disabled={creating}
              >
                {creating ? "创建中…" : "创建分类"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {rowError ? (
        <p
          role="alert"
          data-testid="category-row-error"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {rowError}
        </p>
      ) : null}

      {displayed.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有分类"
          description="创建第一个分类后，你的作品就可以按分类分组展示。"
        />
      ) : (
        <>
          <ul aria-label="分类列表" className="flex list-none flex-col gap-3 p-0">
            {displayed.map((category) => {
              const tone = statusTone(category.status);
              const isPending = rowPendingId === category.id;
              const isRenaming = renamingId === category.id;
              const isConfirmingDelete = confirmDeleteId === category.id;
              return (
                <li key={category.id}>
                  <Card>
                    <CardContent className="flex flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        {isRenaming ? (
                          <div className="flex flex-1 flex-col gap-2">
                            <label
                              htmlFor={`rename-${category.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              新名称
                            </label>
                            <Input
                              id={`rename-${category.id}`}
                              data-testid={`category-rename-input-${category.id}`}
                              value={renameValue}
                              disabled={isPending}
                              onChange={(event) => setRenameValue(event.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                data-testid={`category-rename-save-${category.id}`}
                                disabled={isPending}
                                onClick={() => void onRename(category)}
                              >
                                保存
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => {
                                  setRenamingId(null);
                                  setRowError(null);
                                }}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-1">
                              <h2 className="text-card font-semibold text-primary">
                                {category.name}
                              </h2>
                              <p className="text-xs text-muted-foreground">别名 {category.slug}</p>
                            </div>
                            <span
                              data-testid={`category-status-${category.id}`}
                              className={
                                "rounded-full border px-2 py-0.5 text-xs " +
                                (tone === "archived"
                                  ? "border-border text-muted-foreground"
                                  : "border-accent/50 text-accent")
                              }
                            >
                              {statusLabel(category.status)}
                            </span>
                          </>
                        )}
                      </div>

                      {!isRenaming ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid={`category-rename-${category.id}`}
                            disabled={isPending}
                            onClick={() => {
                              setRenamingId(category.id);
                              setRenameValue(category.name);
                              setRowError(null);
                            }}
                          >
                            重命名
                          </Button>

                          {/* Archive vs delete are different operations with
                              different outcomes, so they read differently. */}
                          {tone === "archived" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-testid={`category-restore-${category.id}`}
                              disabled={isPending}
                              onClick={() => void onSetStatus(category, "ACTIVE")}
                            >
                              取消归档
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-testid={`category-archive-${category.id}`}
                              disabled={isPending}
                              onClick={() => void onSetStatus(category, "ARCHIVED")}
                            >
                              归档
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            data-testid={`category-delete-${category.id}`}
                            disabled={isPending}
                            onClick={() => {
                              setConfirmDeleteId(category.id);
                              setRowError(null);
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      ) : null}

                      {isConfirmingDelete ? (
                        <div
                          role="alertdialog"
                          aria-modal="true"
                          aria-label={`确认删除分类 ${category.name}`}
                          className="rounded-lg border border-border bg-card p-4"
                        >
                          <p className="text-sm text-foreground">
                            确定删除分类「{category.name}」吗？
                            <b>删除会真的移除这条分类，无法撤销。</b>
                            如果只是想不再使用，请改用「归档」。
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              data-testid={`category-delete-confirm-${category.id}`}
                              disabled={isPending}
                              onClick={() => void onDelete(category)}
                            >
                              确认删除
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-testid={`category-delete-cancel-${category.id}`}
                              disabled={isPending}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>

          {archivedCount > 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="category-archived-note">
              其中 {archivedCount} 条已归档，排在最下面。归档的分类不会出现在主页的作品分组里。
            </p>
          ) : null}
        </>
      )}

      <Link to="/studio" className="text-sm text-accent hover:underline">
        返回创作中心
      </Link>
    </div>
  );
}
