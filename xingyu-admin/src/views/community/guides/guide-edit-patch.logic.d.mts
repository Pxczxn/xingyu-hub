export declare function guideUpdatePatch(
  original: { title: string; body: string; status: string; sortOrder: number | null },
  current: { title: string; body: string; status: string; sortOrder: number | null }
): Record<string, string | null>
