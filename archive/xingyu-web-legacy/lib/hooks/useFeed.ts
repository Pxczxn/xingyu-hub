import { useEffect, useState } from "react";
import { communityApi, type ContentSummary } from "@/lib/community-api";

export function useFeed(type = "recommended", size = 20) {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    communityApi
      .getFeed(type, 0, size)
      .then(setItems)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [type, size]);

  return { items, loading, error };
}
