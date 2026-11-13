import { cn } from "@/lib/utils";

/**
 * Underline tabs shared by the home feed, discover categories and galaxy list.
 * Route links and button tabs both call these helpers so the three surfaces
 * stay on one treatment.
 */
export const underlineTabListClassName =
  "flex w-full snap-x snap-mandatory items-center justify-start overflow-x-auto border-b border-border bg-transparent p-0";

export function underlineTabClassName(active: boolean) {
  return cn(
    "inline-flex shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-none border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active
      ? "border-primary bg-transparent font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}
