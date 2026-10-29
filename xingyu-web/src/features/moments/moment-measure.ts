/*
 * The reading measure for a moment, shared by the feed and the detail view.
 *
 * A moment is short by definition, so these pages do NOT typeset at the
 * long-form reading measure (Batch 13's 18px / 717.8px). What they need is an
 * upper bound: the shell is 1234.5px wide, and a 15px line stretched across it
 * carries ~80 Chinese characters — nearly twice the comfortable band, which is
 * why a two-line moment read as a wall.
 *
 * 46rem (736px) puts the body at ~47 characters per line at the card step,
 * which is where HomeFeedItem's excerpt already sits (`max-w-[62ch]` at 15px).
 * The number is stated in rem, not `ch`, for the reason recorded in
 * `xingyu-web/src/styles/tokens.css`: `ch` resolves against each element's own
 * font-size, so the same `68ch` meant two different widths either side of a
 * font-size change.
 *
 * It lives here rather than in either page because the two MUST agree: reading
 * a moment and then tapping back into the feed should not re-wrap the text
 * under you. One constant, two importers.
 */
export const MOMENT_MEASURE = "max-w-[46rem]";
