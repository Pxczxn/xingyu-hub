/*
 * Layout skeletons — phase 2 infrastructure (A §4 "须新造").
 *
 * Nine pure-presentational containers, one per archetype concern. Every one of
 * them owns layout only: no data, no copy, no state, no `useEffect`. A page
 * composes them and keeps its own business logic exactly where it is today.
 *
 * Import from here rather than from the individual files, so a phase 3 batch
 * has one path to change if a skeleton is revised.
 */
export { ArchetypeFrame } from "./ArchetypeFrame";
export type {
  ArchetypeDensity,
  ArchetypeFrameProps,
  ArchetypeSkeleton,
  HeaderTreatment,
} from "./ArchetypeFrame";

export { BleedBand } from "./BleedBand";
export type { BleedBandMotif, BleedBandProps, BleedBandTone } from "./BleedBand";

export { CanvasFrame } from "./CanvasFrame";
export type { CanvasFrameProps } from "./CanvasFrame";

export { FeedRow } from "./FeedRow";
export type { FeedRowProps } from "./FeedRow";

export {
  READER_DEFAULT_FONT_SIZE,
  READER_DEFAULT_LINE_HEIGHT,
  READER_FONT_SIZES,
  READER_LINE_HEIGHT_STEPS,
  ReaderDocInfo,
  ReaderFrame,
  ReaderProgress,
  ReaderSettingsButton,
  ReaderSourceCard,
  ReaderTools,
  readerDocumentStats,
} from "./ReaderFrame";
export type {
  ReaderDocumentStats,
  ReaderFrameProps,
  ReaderLineHeightStep,
  ReaderSourceRow,
  ReaderToolsProps,
} from "./ReaderFrame";

export { ReadingToolbar } from "./ReadingToolbar";
export type { ReadingToolbarProps } from "./ReadingToolbar";

export { SectionRail } from "./SectionRail";
export type { SectionRailProps } from "./SectionRail";

export { SplitPane } from "./SplitPane";
export type { SplitPaneProps } from "./SplitPane";

export { StepFlow } from "./StepFlow";
export type { StepFlowProps, StepFlowStep } from "./StepFlow";

export { TableFrame } from "./TableFrame";
export type { TableFrameProps } from "./TableFrame";
