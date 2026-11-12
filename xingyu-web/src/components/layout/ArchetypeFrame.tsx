import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CanvasFrame } from "./CanvasFrame";
import { SectionRail } from "./SectionRail";
import { SplitPane } from "./SplitPane";

/*
 * ArchetypeFrame — picks a page's GRID by archetype and its HEADER by the H axis.
 *
 * BELONGS TO: all eight archetypes (A §1). The single place that knows "SK6 is
 * [feed | 300 rail]" and "SK5 is a 720 column — or 880 with a rail", so a page
 * declares its identity (`SK6` + `线` + `紧` + `错`) instead of hand-rolling
 * `max-w-*`.
 * AXIS: H selects the header slot; R is what the grid encodes — 齐 one column,
 * 错 main + rail, 出 delegated to `BleedBand`. D is not a grid: it is a density
 * class for the block stack inside the column.
 *
 * Not here on purpose: copy, data, any `<h1>`. A `line`/`banner` header is what
 * the page renders into `headerSlot`; `shell` means the shell already rendered
 * it and this frame leaves the slot empty. SK4/SK8 delegate to `SplitPane` /
 * `CanvasFrame` so the fixed-height maths exists once (hence `density` is inert
 * on those two: panes are not block stacks).
 */
export type ArchetypeSkeleton = "SK1" | "SK2" | "SK3" | "SK4" | "SK5" | "SK6" | "SK7" | "SK8";
/** D axis. */
export type ArchetypeDensity = "loose" | "compact" | "dense";
/** H axis: `line` 无面 masthead · `banner` 有面横幅 · `shell` 壳层已出标题。 */
export type HeaderTreatment = "line" | "banner" | "shell";

type ColumnSkeleton = Exclude<ArchetypeSkeleton, "SK4" | "SK8">;

export type ArchetypeFrameProps = {
  skeleton: ArchetypeSkeleton;
  header?: HeaderTreatment;
  /** Page header element. Ignored when `header="shell"`. */
  headerSlot?: ReactNode;
  /** D axis, applied to the block stack inside the main column. */
  density?: ArchetypeDensity;
  /** Trailing rail (SK1/2/3/6) or leading contents rail (SK7). */
  rail?: ReactNode;
  railLabel?: string;
  /** SK8 leading 48px tool track. */
  toolbar?: ReactNode;
  toolbarLabel?: string;
  /** SK4 leading list column. */
  list?: ReactNode;
  listLabel?: string;
  /** SK4: which pane is visible below `lg`. */
  mobileView?: "list" | "detail";
  /** Main column (SK4: detail pane · SK8: canvas). */
  children: ReactNode;
  className?: string;
};

const DENSITY: Record<ArchetypeDensity, string> = {
  loose: "density-loose",
  compact: "density-compact",
  dense: "density-dense",
};

/** A §1 anatomy: `[main | rail]` from `lg` up. */
const WITH_RAIL: Record<ColumnSkeleton, string> = {
  SK1: "mx-auto lg:grid lg:grid-cols-[minmax(0,var(--reading-measure))_220px] lg:gap-8",
  SK2: "lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6",
  SK3: "lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6",
  /*
   * SK5's rail is a LATER addition (2026-11-10) and it is what R=错 returned to
   * the three SK5 flow pages (`PendingAudit` / `VerifyEmail` /
   * `CollaborationAccept`): they were each hand-rolling this exact two-column
   * grid because `SOLO.SK5`'s 720 cap has no track to put a rail in — the rail
   * simply fell below the content. Two changes, both load-bearing:
   *
   *   - the cap widens 720 → 880, because 720 minus a 220 rail and a 24 gap
   *     leaves a 476px main column, which is narrower than the 480–640 that
   *     `B §2` reads paragraphs at;
   *   - the grid only exists from `lg`. Below that the classes are inert, so the
   *     rail — which is the TRAILING slot here, not a leading one — lands after
   *     the content instead of before it, i.e. the mobile order stays
   *     "conclusion first, actions underneath".
   *
   * Without `rail` SK5 still takes `SOLO.SK5` (720, centred): a flow page with
   * one committed action has no second column to fill, and widening it would
   * push the form away from the axis for no gain.
   */
  SK5: "mx-auto w-full max-w-[880px] lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-6",
  SK6: "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6",
  SK7: "mx-auto lg:grid lg:grid-cols-[256px_minmax(0,var(--reading-measure))] lg:gap-10",
};

/** The same archetypes with no rail: the main column alone. */
const SOLO: Record<ColumnSkeleton, string> = {
  SK1: "mx-auto w-full max-w-[var(--reading-measure)]",
  SK2: "",
  SK3: "",
  SK5: "mx-auto w-full max-w-[720px]",
  SK6: "",
  SK7: "mx-auto w-full max-w-[var(--reading-measure)]",
};

export function ArchetypeFrame({
  skeleton,
  header = "line",
  headerSlot,
  density = "compact",
  rail,
  railLabel,
  toolbar,
  toolbarLabel,
  list,
  listLabel,
  mobileView,
  children,
  className,
}: ArchetypeFrameProps) {
  if (skeleton === "SK4")
    return (
      <SplitPane
        list={list} detail={children} listLabel={listLabel ?? "列表"}
        detailLabel={railLabel ?? "详情"} mobileView={mobileView} className={className}
      />
    );

  if (skeleton === "SK8")
    return (
      <CanvasFrame
        toolbar={toolbar} inspector={rail} toolbarLabel={toolbarLabel}
        inspectorLabel={railLabel} className={className}
      >
        {children}
      </CanvasFrame>
    );

  const railNode = rail ? <SectionRail label={railLabel ?? "侧栏"}>{rail}</SectionRail> : null;
  const leadRail = skeleton === "SK7";

  return (
    <div className={cn("min-w-0", railNode ? WITH_RAIL[skeleton] : SOLO[skeleton], className)}>
      {leadRail ? railNode : null}
      <div className="min-w-0">
        {header === "shell" || headerSlot === undefined ? null : (
          <div className={header === "banner" ? "mb-8" : "mb-6"}>{headerSlot}</div>
        )}
        <div className={DENSITY[density]}>{children}</div>
      </div>
      {leadRail ? null : railNode}
    </div>
  );
}
