import { Search, X } from "lucide-react";

/*
 * A small client-side search input, meant to sit in a section header next to
 * the list it filters (PageSection `action`). It only forwards the keyword —
 * matching logic stays in the page, so the data semantics remain the caller's.
 *
 * Extracted from the topics plaza so the series plaza can share the exact same
 * field instead of duplicating ~40 lines of markup. The topics responsive test
 * still pins the width contract through this component: `w-full sm:w-64` —
 * it fills the header line on a phone and stays bounded next to the title on
 * desktop; never a fixed width that cannot shrink beside the heading.
 *
 * `type="text"` rather than `type="search"`: the latter maps to `searchbox`
 * in ARIA, which breaks `getByRole("textbox", { name })` in tests, for only
 * browser-inconsistent decoration in return.
 */
export function SearchField({
  value,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The accessible name; callers pass their domain wording, e.g. 「搜索话题」. */
  ariaLabel: string;
  placeholder: string;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className="relative w-full sm:w-64">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && hasValue) onChange("");
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="focus-ring h-9 w-full rounded-lg border border-input bg-surface-sunken/60 pl-9 pr-9 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-accent-line focus-visible:bg-card"
      />
      {hasValue ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="清除搜索"
          className="focus-ring absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
