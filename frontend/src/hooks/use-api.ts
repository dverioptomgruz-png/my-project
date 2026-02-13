"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
}

/**
 * Generic hook that wraps async API calls with loading/error/data state.
 *
 * @param fetchFn - An async function that returns data of type T
 * @param immediate - Whether to run the fetch function immediately on mount (default: true)
 * @returns Object with data, error, loading state, and a refetch function
 *
 * @example
 * ```tsx
 * const { data: users, loading, error, refetch } = useApi(() => api.get<User[]>('/users'));
 * ```
 */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  immediate = true
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: immediate,
  });

  // Use ref to keep track of the latest fetchFn without re-triggering effects
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // Track whether the component is mounted
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetchFnRef.current();
      if (mountedRef.current) {
        setState({ data, error: null, loading: false });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          data: null,
          error:
            err instanceof Error
              ? err
              : new Error(
                  typeof err === "object" && err !== null && "message" in err
                    ? String((err as Record<string, unknown>).message)
                    : "An unexpected error occurred"
                ),
          loading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      refetch();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [immediate, refetch]);

  return {
    ...state,
    refetch,
  };
}
