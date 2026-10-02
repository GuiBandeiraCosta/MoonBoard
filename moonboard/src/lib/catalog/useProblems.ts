import { useCallback, useEffect, useRef, useState } from 'react';
import { countProblems, queryProblems, type ProblemQuery, type ProblemSummary } from './db';

const PAGE = 50;

interface Result {
  key: string;
  items: ProblemSummary[];
  total: number;
  error: string | null;
}

/** Paged problem list with debounce, re-queried when the query object changes. */
export function useProblems(query: ProblemQuery | null) {
  const key = query ? JSON.stringify(query) : null;
  const [result, setResult] = useState<Result | null>(null);
  const gen = useRef(0);

  useEffect(() => {
    if (!query) return;
    const myGen = ++gen.current;
    const t = setTimeout(
      async () => {
        try {
          const [rows, n] = await Promise.all([queryProblems({ ...query, limit: PAGE, offset: 0 }), countProblems(query)]);
          if (gen.current !== myGen) return;
          setResult({ key: key!, items: rows, total: n, error: null });
        } catch (e) {
          if (gen.current !== myGen) return;
          setResult({ key: key!, items: [], total: 0, error: e instanceof Error ? e.message : String(e) });
        }
      },
      query.search ? 200 : 0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Loading whenever the latest query has not produced a result yet.
  const current = result && result.key === key ? result : null;
  const loading = key != null && current == null;
  const items = current?.items ?? result?.items ?? [];
  const total = current?.total ?? 0;
  const hasMore = current != null && items.length < total;

  const loadMore = useCallback(async () => {
    if (!query || !current || !hasMore) return;
    const myGen = gen.current;
    try {
      const rows = await queryProblems({ ...query, limit: PAGE, offset: current.items.length });
      if (gen.current !== myGen) return;
      setResult((prev) => (prev && prev.key === current.key ? { ...prev, items: [...prev.items, ...rows] } : prev));
    } catch {
      // keep what we have
    }
  }, [query, current, hasMore]);

  return { items, total, loading, error: current?.error ?? null, hasMore, loadMore };
}
