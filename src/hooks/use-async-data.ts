import * as React from "react";

export interface AsyncDataState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<T | undefined>;
}

export function useAsyncData<T>(load: () => Promise<T>, deps: React.DependencyList): AsyncDataState<T> {
  const [data, setData] = React.useState<T>();
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const value = await load();
      setData(value);
      return value;
    } catch (caught) {
      const normalized = caught instanceof Error ? caught : new Error("Falha ao carregar dados");
      setError(normalized);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, deps);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    load()
      .then((value) => {
        if (active) setData(value);
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
  }, deps);

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
        await onSuccess?.(result, input);
        return result;
      } catch (caught) {
        const normalized = caught instanceof Error ? caught : new Error("Operacao nao concluida");
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
