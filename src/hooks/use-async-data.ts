import * as React from "react";

export interface AsyncDataState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<T | undefined>;
}

interface AsyncDataOptions<T> {
  enabled?: boolean;
  initialData?: T;
  cacheKey?: string;
  staleMs?: number;
}

const cache = new Map<string, { data: unknown; updatedAt: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_STALE_MS = 30_000;
let cacheVersion = 0;

function readFreshCache<T>(key: string | undefined, staleMs: number): T | undefined {
  if (!key) return undefined;
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.updatedAt > staleMs) return undefined;
  return entry.data as T;
}

function writeCache<T>(key: string | undefined, data: T) {
  if (!key) return;
  cache.set(key, { data, updatedAt: Date.now() });
}

function loadWithDeduplication<T>(key: string | undefined, load: () => Promise<T>): Promise<T> {
  if (!key) return load();

  const pending = inFlightRequests.get(key);
  if (pending) return pending as Promise<T>;

  const versionAtStart = cacheVersion;
  const request = Promise.resolve()
    .then(load)
    .then((value) => {
      if (versionAtStart === cacheVersion) writeCache(key, value);
      return value;
    })
    .finally(() => {
      if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

function clearCachedData() {
  cacheVersion += 1;
  cache.clear();
  inFlightRequests.clear();
}

function useStableDependencies(deps: React.DependencyList): React.DependencyList {
  const depsRef = React.useRef(deps);
  const previousDeps = depsRef.current;
  const changed =
    previousDeps.length !== deps.length ||
    deps.some((dependency, index) => !Object.is(dependency, previousDeps[index]));

  if (changed) depsRef.current = deps;
  return depsRef.current;
}

export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: React.DependencyList,
  options: AsyncDataOptions<T> = {},
): AsyncDataState<T> {
  const enabled = options.enabled ?? true;
  const cacheKey = options.cacheKey;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const stableDeps = useStableDependencies(deps);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const [data, setDataState] = React.useState<T | undefined>(
    () => readFreshCache<T>(cacheKey, staleMs) ?? options.initialData,
  );
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(enabled && data === undefined);
  const dataRef = React.useRef<T | undefined>(data);

  const setData = React.useCallback((value: T | undefined) => {
    dataRef.current = value;
    setDataState(value);
  }, []);

  const reload = React.useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return dataRef.current;
    }

    setIsLoading(true);
    setError(null);
    try {
      const value = await loadWithDeduplication(cacheKey, () => loadRef.current());
      setData(value);
      return value;
    } catch (caught) {
      const normalized = caught instanceof Error ? caught : new Error("Falha ao carregar dados");
      setError(normalized);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, enabled, setData]);

  React.useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const cached = readFreshCache<T>(cacheKey, staleMs);
    if (cached !== undefined) {
      setData(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    loadWithDeduplication(cacheKey, () => loadRef.current())
      .then((value) => {
        if (!active) return;
        setData(value);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught : new Error("Falha ao carregar dados"));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, enabled, setData, stableDeps, staleMs]);

  return { data, error, isLoading, reload };
}

interface AsyncMutationOptions<TInput, TOutput> {
  mutationFn: (input: TInput) => Promise<TOutput>;
  onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>;
  onError?: (error: Error, input: TInput) => void;
}

export function useAsyncMutation<TInput, TOutput = unknown>({
  mutationFn,
  onSuccess,
  onError,
}: AsyncMutationOptions<TInput, TOutput>) {
  const [isPending, setIsPending] = React.useState(false);

  const mutate = React.useCallback(
    async (input: TInput) => {
      setIsPending(true);
      try {
        const result = await mutationFn(input);
        clearCachedData();
        await onSuccess?.(result, input);
        return result;
      } catch (caught) {
        const normalized = caught instanceof Error ? caught : new Error("Operação não concluída");
        onError?.(normalized, input);
        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn, onError, onSuccess],
  );

  return { mutate, isPending };
}
