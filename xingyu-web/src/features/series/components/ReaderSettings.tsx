import {
  READER_LAYOUTS,
  READER_MAX_FONT_SIZE,
  READER_MIN_FONT_SIZE,
  type ReaderLayout,
} from "../reader-preferences";
import { cn } from "@/lib/cn";

/*
 * Typography controls, shared by the desktop toolbar (inline) and the mobile
 * reading-settings sheet (stacked). They were written twice in the first draft;
 * two copies is how the bounds, the accessible names and the reset behaviour
 * drift apart.
 *
 * The font-size value sits between the two buttons because it is a readout, not
 * a third control. The width options are mutually exclusive, so each carries
 * `aria-pressed` rather than relying on colour alone.
 */
export function ReaderSettings({
  fontSize,
  layout,
  onFontSizeChange,
  onLayoutChange,
  onReset,
  stacked = false,
}: {
  fontSize: number;
  layout: ReaderLayout;
  onFontSizeChange: (fontSize: number) => void;
  onLayoutChange: (layout: ReaderLayout) => void;
  onReset: () => void;
  stacked?: boolean;
}) {
  const fontButton = cn(
    "focus-ring rounded border border-border text-center transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
    stacked ? "h-11 w-11 text-base" : "h-7 px-2",
  );
  const widthButton = cn(
    "focus-ring rounded border transition-colors",
    stacked ? "px-3 py-3" : "px-2 py-0.5",
    "hover:bg-muted/50 hover:text-foreground",
  );

  return (
    <div
      className={cn(
        "text-meta text-muted-foreground",
        stacked ? "flex flex-col gap-5" : "flex flex-wrap items-center gap-3",
      )}
    >
      <div className={cn("flex items-center", stacked ? "justify-between gap-4" : "gap-1")}>
        {stacked ? <span className="font-medium text-foreground">字号</span> : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="减小字号"
            disabled={fontSize <= READER_MIN_FONT_SIZE}
            onClick={() => onFontSizeChange(Math.max(READER_MIN_FONT_SIZE, fontSize - 1))}
            className={fontButton}
          >
            A-
          </button>
          <span
            className={cn("text-center tabular-nums", stacked ? "w-9" : "w-7")}
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="sr-only">当前字号 </span>
            {fontSize}
          </span>
          <button
            type="button"
            aria-label="增大字号"
            disabled={fontSize >= READER_MAX_FONT_SIZE}
            onClick={() => onFontSizeChange(Math.min(READER_MAX_FONT_SIZE, fontSize + 1))}
            className={fontButton}
          >
            A+
          </button>
        </div>
      </div>

      {stacked ? null : <span aria-hidden className="h-4 w-px bg-border" />}

      <div className={cn("flex items-center", stacked ? "justify-between gap-4" : "gap-1")}>
        {stacked ? <span className="font-medium text-foreground">阅读宽度</span> : null}
        <div role="group" aria-label="阅读宽度" className="flex items-center gap-1">
          {READER_LAYOUTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={layout === key}
              onClick={() => onLayoutChange(key)}
              className={cn(
                widthButton,
                layout === key
                  ? "border-accent-line bg-accent-soft font-medium text-accent-strong"
                  : "border-border",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {stacked ? null : <span aria-hidden className="h-4 w-px bg-border" />}

      <button
        type="button"
        onClick={onReset}
        className={cn(
          "focus-ring rounded-sm transition-colors hover:text-accent-strong",
          stacked
            ? "w-full rounded-md border border-border py-3 text-center font-medium text-foreground hover:bg-muted/50"
            : "px-1",
        )}
      >
        恢复默认
      </button>
    </div>
  );
}
