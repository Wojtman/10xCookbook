import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabaseClient } from "@/db/supabase.client";
import { CookbookService } from "@/lib/services/cookbook.service";
import type { CookbookDTO } from "@/types";

interface UseCookbookSelectionState {
  cookbookId?: string;
  cookbook?: CookbookDTO | null;
  userId?: string | null;
  isAnonymous: boolean;
  isLoading: boolean;
  error?: string;
}

export interface UseCookbookSelectionResult {
  cookbookId?: string;
  cookbook?: CookbookDTO | null;
  userId?: string | null;
  isAnonymous: boolean;
  isLoading: boolean;
  error?: string;
  refresh: () => Promise<void>;
}

interface UseCookbookSelectionOptions {
  initialUserId?: string;
  sessionReady?: boolean;
}

/**
 * Resolves the active cookbook for the recipe preview spread view.
 * - Determines the current Supabase user session.
 * - Chooses the cookbook passed via query or falls back to the default cookbook.
 * - Flags anonymous sessions so the view can disable authenticated-only actions.
 */
export function useCookbookSelection(
  initialCookbookId?: string,
  options: UseCookbookSelectionOptions = {}
): UseCookbookSelectionResult {
  const { initialUserId, sessionReady = true } = options;
  const [state, setState] = useState<UseCookbookSelectionState>(() => ({
    cookbookId: initialCookbookId,
    cookbook: undefined,
    userId: initialUserId ?? undefined,
    isAnonymous: initialUserId ? false : true,
    isLoading: true,
    error: undefined,
  }));

  const activeRequest = useRef(0);

  const loadCookbook = useCallback(
    async (overrideCookbookId?: string) => {
      if (!sessionReady) {
        return;
      }

      const requestId = ++activeRequest.current;

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: undefined,
      }));

      try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        const user = sessionData.session?.user ?? null;
        const resolvedUserId = user?.id ?? initialUserId ?? null;

        // Anonymous session — no cookbook requests should be made.
        if (!resolvedUserId) {
          if (activeRequest.current !== requestId) {
            return;
          }
          setState({
            cookbookId: undefined,
            cookbook: undefined,
            userId: null,
            isAnonymous: true,
            isLoading: false,
            error: undefined,
          });
          return;
        }

        const cookbookService = new CookbookService(supabaseClient);

        let cookbook: CookbookDTO | null = null;
        let cookbookId = overrideCookbookId ?? initialCookbookId;

        if (cookbookId) {
          cookbook = await cookbookService.getCookbookById(cookbookId, resolvedUserId);
          if (!cookbook) {
            throw new Error("COOKBOOK_NOT_FOUND");
          }
        } else {
          const { cookbooks } = await cookbookService.listCookbooks(resolvedUserId);
          const sortedCookbooks = [...cookbooks].sort((a, b) => b.created_at.localeCompare(a.created_at));
          cookbook = cookbooks.find((item) => item.is_default) ?? sortedCookbooks[0] ?? null;

          if (!cookbook) {
            try {
              const response = await fetch("/api/cookbooks?order=desc", { credentials: "include" });
              if (response.ok) {
                const data = (await response.json()) as { cookbooks?: CookbookDTO[] };
                const apiCookbooks = Array.isArray(data.cookbooks) ? data.cookbooks : [];
                const sortedApiCookbooks = [...apiCookbooks].sort((a, b) => b.created_at.localeCompare(a.created_at));
                cookbook = apiCookbooks.find((item) => item.is_default) ?? sortedApiCookbooks[0] ?? null;
              }
            } catch (apiError) {
              console.error("Failed to load cookbooks via API fallback", apiError);
            }
          }

          cookbookId = cookbook?.id;
        }

        if (activeRequest.current !== requestId) {
          return;
        }

        if (!cookbookId) {
          setState({
            cookbookId: undefined,
            cookbook: null,
            userId: resolvedUserId,
            isAnonymous: false,
            isLoading: false,
            error: "No cookbook found.",
          });
          return;
        }

        setState({
          cookbookId,
          cookbook: cookbook ?? null,
          userId: resolvedUserId,
          isAnonymous: false,
          isLoading: false,
          error: undefined,
        });
      } catch (error) {
        if (activeRequest.current !== requestId) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message === "COOKBOOK_NOT_FOUND"
              ? "Selected cookbook is unavailable."
              : error.message
            : "Failed to load cookbook.";

        setState((prev) => ({
          ...prev,
          cookbookId: undefined,
          cookbook: null,
          isAnonymous: prev.isAnonymous,
          isLoading: false,
          error: message,
        }));
      }
    },
    [initialCookbookId, initialUserId, sessionReady]
  );

  useEffect(() => {
    void loadCookbook();
  }, [loadCookbook]);

  const refresh = useCallback(async () => {
    await loadCookbook(state.cookbookId);
  }, [loadCookbook, state.cookbookId]);

  return useMemo(
    () => ({
      cookbookId: state.cookbookId,
      cookbook: state.cookbook,
      userId: state.userId,
      isAnonymous: state.isAnonymous,
      isLoading: state.isLoading,
      error: state.error,
      refresh,
    }),
    [refresh, state.cookbook, state.cookbookId, state.error, state.isAnonymous, state.isLoading, state.userId]
  );
}
