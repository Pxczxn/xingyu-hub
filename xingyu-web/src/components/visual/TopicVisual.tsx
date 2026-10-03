import {
  BookMarked,
  BookOpen,
  CircleDot,
  Code2,
  Coffee,
  Compass,
  GitBranch,
  Layers,
  Megaphone,
  Orbit,
  Palette,
  Rocket,
  Shapes,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { stableVariant } from "./visual-seed";

const FALLBACK_ICONS: Array<[string, LucideIcon]> = [
  ["Compass", Compass],
  ["Shapes", Shapes],
  ["CircleDot", CircleDot],
  ["Orbit", Orbit],
  ["Sparkles", Sparkles],
  ["BookMarked", BookMarked],
  ["Layers", Layers],
];

export function topicVisualIconName(name: string, key: string): string {
  const value = name.trim().toLowerCase();
  if (/(技术|编程|工程|tech|programming|developer)/i.test(value)) return "Code2";
  if (/(人工智能|ai|大模型|智能)/i.test(value)) return "Sparkles";
  if (/(设计|design|视觉|交互)/i.test(value)) return "Palette";
  if (/(生活|life)/i.test(value)) return "Coffee";
  if (/(开源|opensource|open-source)/i.test(value)) return "GitBranch";
  if (/(阅读|读书|reading|book)/i.test(value)) return "BookOpen";
  if (/(创业|startup|growth)/i.test(value)) return "Rocket";
  if (/(公告|announcement|通知)/i.test(value)) return "Megaphone";
  if (/(综合|general)/i.test(value)) return "Compass";
  return FALLBACK_ICONS[stableVariant(key, FALLBACK_ICONS.length)][0];
}

function semanticIcon(name: string, key: string): LucideIcon {
  const iconName = topicVisualIconName(name, key);
  const icons: Record<string, LucideIcon> = {
    Code2,
    Sparkles,
    Palette,
    Coffee,
    GitBranch,
    BookOpen,
    Rocket,
    Megaphone,
    Compass,
    Shapes,
    CircleDot,
    Orbit,
    BookMarked,
    Layers,
  };
  return icons[iconName] ?? Shapes;
}

export function TopicVisual({
  name,
  stableKey,
  size = "sm",
  className,
}: {
  name: string;
  stableKey: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = semanticIcon(name, stableKey);
  const iconName = topicVisualIconName(name, stableKey);

  return (
    <span
      aria-hidden
      data-testid="topic-visual"
      data-topic-visual-key={stableKey}
      data-topic-visual-icon={iconName}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-accent/10 text-primary transition-colors group-hover:border-accent/50 group-hover:text-accent",
        size === "md" ? "h-12 w-12 rounded-lg" : "h-9 w-9 rounded-md",
        className,
      )}
    >
      <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-accent/35" />
      <span className="absolute bottom-2 left-2 h-px w-3 bg-accent/45" />
      <span className="absolute bottom-2 right-2 h-1 w-1 rounded-full bg-accent/75" />
      <Icon className={size === "md" ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.8} />
    </span>
  );
}
