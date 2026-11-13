import { cn } from "@/lib/cn";
import { underlineTabClassName, underlineTabListClassName } from "@/components/ui/underline-tabs";

export type GalaxyTab = "explore" | "mine";

const TABS: { id: GalaxyTab; label: string }[] = [
  { id: "explore", label: "探索星系" },
  { id: "mine", label: "我的星系" },
];

export function GalaxyTabs({
  value,
  onChange,
}: {
  value: GalaxyTab;
  onChange: (tab: GalaxyTab) => void;
}) {
  return (
    <div role="tablist" aria-label="星系" className={underlineTabListClassName}>
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`galaxy-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`galaxy-tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn("focus-ring", underlineTabClassName(selected))}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
