import { cn } from "@/lib/utils";

export type RuleCapsuleItem = {
  id: string;
  label: string;
  status?: "pass" | "fail" | "neutral";
};

type RuleCapsulesProps = {
  items: RuleCapsuleItem[];
  ariaLabel: string;
  className?: string;
  live?: "polite" | "off";
};

export function RuleCapsules({ items, ariaLabel, className, live = "off" }: RuleCapsulesProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn("mt-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2", className)}
      aria-label={ariaLabel}
      {...(live === "polite" ? { "aria-live": "polite" as const } : {})}
    >
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
              item.status === "pass" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              item.status === "fail" && "border-red-200 bg-red-50 text-red-600",
              (!item.status || item.status === "neutral") && "border-zinc-200 bg-white text-zinc-600"
            )}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
