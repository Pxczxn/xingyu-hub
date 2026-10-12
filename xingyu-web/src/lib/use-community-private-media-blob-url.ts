import { useEffect, useState } from "react";
import { apiRequestBlob } from "@/api/client";
import { onAuthChanged } from "@/lib/storage";
import { parseCommunityPrivateMediaPath } from "@/lib/community-private-media";

export type PrivateMediaBlobStatus = "idle" | "loading" | "ready" | "error";

/**
 * 通过带 satoken 头的 GET 拉取私有媒体字节，返回短期 blob: URL（绝不把会话 token 写入地址栏或 img src 路径）。
 */
export function useCommunityPrivateMediaBlobUrl(sourceUrl: string | null | undefined): {
  blobUrl: string | null;
  status: PrivateMediaBlobStatus;
} {
  const mediaPath = sourceUrl ? parseCommunityPrivateMediaPath(sourceUrl) : null;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PrivateMediaBlobStatus>("idle");
  const [authGeneration, setAuthGeneration] = useState(0);

  useEffect(() => onAuthChanged(() => setAuthGeneration((n) => n + 1)), []);

  useEffect(() => {
    if (!mediaPath) {
      setBlobUrl(null);
      setStatus("idle");
      return;
    }

    let active = true;
    let created: string | null = null;
    setStatus("loading");
    setBlobUrl(null);

    apiRequestBlob(mediaPath)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setBlobUrl(null);
          setStatus("error");
        }
      });

    return () => {
      active = false;
      if (created) {
        URL.revokeObjectURL(created);
      }
      setBlobUrl(null);
    };
  }, [mediaPath, authGeneration]);

  return { blobUrl, status };
}
