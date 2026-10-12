import { cn } from "@/lib/cn";
import { isCommunityPrivateMediaPath } from "@/lib/community-private-media";
import { useCommunityPrivateMediaBlobUrl } from "@/lib/use-community-private-media-blob-url";

type CommunityPrivateMediaImageProps = {
  url: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

/**
 * 私有社区媒体：fetch + blob URL。公开或外部 URL 原样交给浏览器（不附带会话凭据）。
 */
export function CommunityPrivateMediaImage({
  url,
  alt,
  className,
  loading = "lazy",
}: CommunityPrivateMediaImageProps) {
  const isPrivate = isCommunityPrivateMediaPath(url);
  const { blobUrl, status } = useCommunityPrivateMediaBlobUrl(isPrivate ? url : null);

  if (!isPrivate) {
    return <img src={url} alt={alt} className={className} loading={loading} />;
  }

  if (status === "loading" || status === "idle") {
    return (
      <div
        className={cn(className, "bg-muted animate-pulse")}
        role="img"
        aria-label={alt}
        aria-busy="true"
      />
    );
  }

  if (status === "error" || !blobUrl) {
    return (
      <div
        className={cn(
          className,
          "bg-muted text-muted-foreground flex items-center justify-center text-xs",
        )}
        role="img"
        aria-label={alt}
      >
        图片无法加载
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} loading={loading} />;
}
