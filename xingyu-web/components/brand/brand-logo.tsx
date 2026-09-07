import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn("inline-flex shrink-0 items-center", className)}
      aria-label="星语社区首页"
    >
      <Image
        src="/brand/logo-header.png"
        alt="星语社区"
        width={292}
        height={88}
        priority={priority}
        className="h-11 w-auto object-contain"
      />
    </Link>
  );
}
