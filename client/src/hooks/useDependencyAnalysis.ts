import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeDependencies } from '../services/api';
import type { DependencyAnalysisResult, ModItem } from '../types';

export function useDependencyAnalysis(mods: ModItem[]) {
  const [cache, setCache] = useState<Record<string, DependencyAnalysisResult>>({});
  const [fallbackAnalysis, setFallbackAnalysis] = useState<DependencyAnalysisResult | null>(null);
  const [isAnalyzingDeps, setIsAnalyzingDeps] = useState<boolean>(false);

  const inFlightKeyRef = useRef<string | null>(null);

  const cacheKey = useMemo(
    () =>
      mods
        .map((m) => m.id)
        .slice()
        .sort()
        .join(','),
    [mods]
  );

  const cachedResult = cache[cacheKey];

  const runDependencyCheck = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && cachedResult) {
        return;
      }

      setIsAnalyzingDeps(true);
      try {
        const result = await analyzeDependencies(mods);
        setCache((prev) => ({ ...prev, [cacheKey]: result }));
        setFallbackAnalysis(result);
      } catch (err) {
        console.error('Dependency check failed:', err);
      } finally {
        setIsAnalyzingDeps(false);
      }
    },
    [cacheKey, cachedResult, mods]
  );

  useEffect(() => {
    if (cachedResult || inFlightKeyRef.current === cacheKey) {
      return;
    }

    let isMounted = true;
    inFlightKeyRef.current = cacheKey;

    analyzeDependencies(mods)
      .then((result) => {
        if (isMounted) {
          setCache((prev) => ({ ...prev, [cacheKey]: result }));
          setFallbackAnalysis(result);
        }
      })
      .catch((err) => {
        console.error('Dependency check failed:', err);
      })
      .finally(() => {
        if (inFlightKeyRef.current === cacheKey) {
          inFlightKeyRef.current = null;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cacheKey, cachedResult, mods]);

  return {
    depAnalysis: cachedResult ?? fallbackAnalysis,
    isAnalyzingDeps,
    runDependencyCheck: () => runDependencyCheck(true),
  };
}
