"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/lib/api-client";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<T>, "reload">>({
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loader()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          err && typeof err === "object" && "problem" in err
            ? String((err as ApiError).problem.detail || (err as ApiError).problem.title)
            : "加载失败";
        setState({ data: null, loading: false, error: message });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { ...state, reload };
}
