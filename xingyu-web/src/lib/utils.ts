import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * Default tailwind-merge treats every `text-*` as a color (`theme.colors` is
 * `isAny`). Custom steps such as `text-h1` then lose to a later `text-primary`
 * inside `cn()`, and the heading renders at the inherited 16px. Register the
 * design-system sizes as font sizes so they conflict with `text-sm` / `text-xl`
 * and sit beside color utilities.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "display-lg",
            "h1",
            "h2",
            "h3",
            "title",
            "card",
            "meta",
            "body",
            "reading",
            "caption",
            "metric",
          ],
        },
      ],
    },
  },
});

/** Merge conditional class names and de-duplicate conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
