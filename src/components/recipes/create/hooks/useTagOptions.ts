import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TagDTO } from "@/types";

import type { TagOptionsState, UseTagOptionsResult } from "../types";

interface TagsApiResponse {
  tags: TagDTO[];
  total: number;
}

const DEFAULT_STATE: TagOptionsState = {
  tags: [],
  isLoading: true,
  error: undefined,
};

export function useTagOptions(): UseTagOptionsResult {
  const [state, setState] = useState<TagOptionsState>(DEFAULT_STATE);
  const activeRequest = useRef(0);

  const fetchTags = useCallback(async () => {
    const requestId = ++activeRequest.current;

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: undefined,
    }));

    try {
      const response = await fetch("/api/tags", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to retrieve tags (status ${response.status})`);
      }

      const data = (await response.json()) as TagsApiResponse;

      if (activeRequest.current !== requestId) {
        return;
      }

      setState({
        tags: Array.isArray(data.tags) ? data.tags : [],
        isLoading: false,
        error: undefined,
      });
    } catch (error) {
      if (activeRequest.current !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to load tags.";

      setState({
        tags: [],
        isLoading: false,
        error: message,
      });
    }
  }, []);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const refresh = useCallback(async () => {
    await fetchTags();
  }, [fetchTags]);

  return useMemo(
    () => ({
      tags: state.tags,
      isLoading: state.isLoading,
      error: state.error,
      refresh,
    }),
    [refresh, state.error, state.isLoading, state.tags]
  );
}
