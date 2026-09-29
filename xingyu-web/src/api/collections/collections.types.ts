/*
 * Collection contracts — verified live 2026-09-24 (isolated test DB).
 *
 * GET  /api/v1/me/collections              bare array
 * POST /api/v1/me/collections              200 bare summary
 * PATCH/DELETE /api/v1/me/collections/{id} 200 summary / 204
 * GET  /api/v1/collections/{id}            bare CollectionView
 *
 * UNLISTED is NOT link-readable (anon + other user → 404), same as PRIVATE.
 * Backend does not reliably validate visibility — the UI must.
 */

export const COLLECTION_VISIBILITIES = ["PRIVATE", "PUBLIC", "UNLISTED"] as const;
export type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number];

export type CollectionSummary = {
  id: string;
  title: string;
  visibility: string;
  itemCount: number;
};

export type CollectionItem = {
  id: string;
  title: string;
  objectType: string;
  objectId: string;
};

export type CollectionDetail = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  items: CollectionItem[];
};

export type CreateCollectionPayload = {
  title: string;
  visibility?: CollectionVisibility;
};

export type UpdateCollectionPayload = {
  title?: string;
  visibility?: CollectionVisibility;
};

export function isCollectionVisibility(value: string): value is CollectionVisibility {
  return (COLLECTION_VISIBILITIES as readonly string[]).includes(value);
}

export function visibilityLabel(value: string): string {
  if (value === "PRIVATE") return "仅自己可见";
  if (value === "PUBLIC") return "所有人可查看";
  if (value === "UNLISTED") return "未公开，目前仅自己可查看";
  return "未公开";
}
