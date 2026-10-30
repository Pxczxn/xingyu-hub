import type { MomentView } from "@/api/moments/moments.types";

/*
 * Discover expansion for a MOMENT.
 *
 * A moment has one plain-text body and no outline, chapter switcher, or series
 * context, so reusing DiscoverReadingPanel would mean feeding it a fake article
 * shape. This panel spans both reader columns and keeps the one thing the row
 * promises: the full body, with the same reading width and wrapping rules as
 * the article preview.
 */
export function DiscoverMomentPanel({ moment }: { moment: MomentView }) {
  return (
    <div className="contents">
      <section
        aria-label="动态正文"
        data-reading-viewport
        className="discover-reading-body discover-moment-body min-w-0 rounded-lg border border-border/60 bg-card"
      >
        <div className="discover-reading-viewport rounded-lg p-4">
          <p className="whitespace-pre-wrap break-words text-card leading-7 text-primary">
            {moment.body}
          </p>
        </div>
      </section>
    </div>
  );
}
