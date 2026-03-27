"use client";

import { useEffect, useState, useCallback } from "react";
import { request } from "@/lib/auth/api";

const BASE = "/api";

export function useAdminData<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(() => {
    setLoading(true);
    fetcher()
      .then(setData)
      .catch((e: any) => setError(e.message || "加载失败"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
