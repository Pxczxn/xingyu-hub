import { useEffect, useState } from "react";
import { communityApi, type ProfileDetail } from "@/lib/community-api";

export function useUser(username: string) {
  const [data, setData] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    communityApi
      .getProfile(username)
      .then(setData)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [username]);

  return { data, loading, error };
}
