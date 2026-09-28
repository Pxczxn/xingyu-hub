import { cn } from "@/lib/utils";

export function getLengthHintStatus(length: number, minLength: number, maxLength: number): "pass" | "fail" {
  return length >= minLength && length <= maxLength ? "pass" : "fail";
}

export function formatLengthHint(length: number, maxLength: number): string {
  return `${length}/${maxLength}`;
}

export function lengthHintClassName(status: "pass" | "fail" | "neutral"): string {
  if (status === "pass") return "text-emerald-600";
  if (status === "fail") return "text-red-600";
  return "text-zinc-400";
}
