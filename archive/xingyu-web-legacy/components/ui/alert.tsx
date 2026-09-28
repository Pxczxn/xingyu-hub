import { cn } from "@/lib/utils";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "success";
};

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        variant === "destructive" && "border-red-200 bg-red-50 text-red-800",
        variant === "success" && "border-green-200 bg-green-50 text-green-800",
        variant === "default" && "border-zinc-200 bg-zinc-50 text-zinc-800",
        className
      )}
      {...props}
    />
  );
}
