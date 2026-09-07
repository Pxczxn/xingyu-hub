import * as React from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/paths";

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function Avatar({ className, src, alt, fallback, size = "md", ...props }: AvatarProps) {
  const [useDefault, setUseDefault] = React.useState(!src);
  const [defaultFailed, setDefaultFailed] = React.useState(false);
  const initials = fallback?.slice(0, 2).toUpperCase() ?? "?";

  React.useEffect(() => {
    setUseDefault(!src);
    setDefaultFailed(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {useDefault ? (
        defaultFailed ? (
          <span>{initials}</span>
        ) : (
          <img
            src={DEFAULT_AVATAR_URL}
            alt={alt ?? fallback ?? "avatar"}
            className="h-full w-full object-cover"
            onError={() => setDefaultFailed(true)}
          />
        )
      ) : (
        <img
          src={src!}
          alt={alt ?? fallback ?? "avatar"}
          className="h-full w-full object-cover"
          onError={() => setUseDefault(true)}
        />
      )}
    </div>
  );
}
