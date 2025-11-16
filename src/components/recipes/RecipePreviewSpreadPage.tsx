import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BookLayout } from "@/components/recipes/BookLayout";
import { supabaseClient } from "@/db/supabase.client";
import { useCookbookSelection } from "@/lib/hooks/useCookbookSelection";
import { useRecipeList } from "@/lib/hooks/useRecipeList";
import { useRecipeDetailsCache } from "@/lib/hooks/useRecipeDetailsCache";
import type { CookbookDTO, CookbookListResponseDTO, RecipeListQueryParams } from "@/types";

import { RecipePreviewCard } from "./RecipePreviewCard";
import { SidebarRecipeList } from "./SidebarRecipeList";
import type { RecipeListQueryState } from "@/lib/types/recipePreview";
import { SessionBanner } from "./SessionBanner";
import { SpreadNavigation } from "./SpreadNavigation";
import { ToastHost } from "./ToastHost";
import { LogoutButton } from "@/components/auth/LogoutButton";

const DEFAULT_SORT: RecipeListQueryState["sort"] = "display_order";
const DEFAULT_ORDER: RecipeListQueryState["order"] = "asc";
const SIDEBAR_FETCH_LIMIT = 1000; // Matches DEFAULT_LIMIT in useRecipeList
const MIN_PAGE = 1;

export interface RecipePreviewSpreadPageProps {
  initialCookbookId?: string;
  initialPage?: number;
  initialSort?: RecipeListQueryState["sort"];
  initialOrder?: RecipeListQueryState["order"];
  initialTags?: string | null;
  initialSearch?: string | null;
  currentUserName?: string;
  initialUserId?: string | null;
  initialSession?: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: number | null;
  } | null;
}

export function RecipePreviewSpreadPage({
  initialCookbookId,
  initialPage,
  initialSort,
  initialOrder,
  initialTags,
  initialSearch,
  currentUserName,
  initialUserId,
  initialSession,
}: RecipePreviewSpreadPageProps) {
  const sanitizedPage =
    Number.isFinite(initialPage) && (initialPage ?? 0) >= MIN_PAGE ? (initialPage as number) : MIN_PAGE;
  const sanitizedSort = initialSort ?? DEFAULT_SORT;
  const sanitizedOrder = initialOrder ?? DEFAULT_ORDER;

  const [listQueryState, setListQueryState] = useState<RecipeListQueryState>(() => ({
    page: sanitizedPage,
    sort: sanitizedSort,
    order: sanitizedOrder,
    ...(initialTags ? { tags: initialTags } : {}),
    ...(initialSearch ? { search: initialSearch } : {}),
  }));

  const [isSessionReady, setIsSessionReady] = useState(() => (initialSession ? false : true));
  const sessionSyncAttemptedRef = useRef(false);

  useEffect(() => {
    if (!initialSession) {
      setIsSessionReady(true);
      return;
    }

    if (sessionSyncAttemptedRef.current) {
      return;
    }

    sessionSyncAttemptedRef.current = true;
    let isCancelled = false;

    const syncSession = async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();

        if (data.session?.access_token === initialSession.accessToken) {
          if (!isCancelled) {
            setIsSessionReady(true);
          }
          return;
        }

        await supabaseClient.auth.setSession({
          access_token: initialSession.accessToken,
          refresh_token: initialSession.refreshToken,
        });
      } catch {
        // Intentionally swallow session sync errors; subsequent requests will retry.
      } finally {
        if (!isCancelled) {
          setIsSessionReady(true);
        }
      }
    };

    void syncSession();

    return () => {
      isCancelled = true;
    };
  }, [initialSession]);

  const { sort, order, tags, search } = listQueryState;

  const listQuery = useMemo<RecipeListQueryParams>(
    () => ({
      page: MIN_PAGE,
      limit: SIDEBAR_FETCH_LIMIT,
      sort,
      order,
      ...(tags ? { tags } : {}),
      ...(search ? { search } : {}),
    }),
    [order, search, sort, tags]
  );

  const {
    cookbookId,
    cookbook,
    userId,
    isAnonymous,
    isLoading: isLoadingCookbook,
    error: cookbookError,
  } = useCookbookSelection(initialCookbookId, {
    initialUserId: initialUserId ?? undefined,
    sessionReady: isSessionReady,
  });

  const [fallbackCookbook, setFallbackCookbook] = useState<CookbookDTO | null>(null);
  const [fallbackCookbookError, setFallbackCookbookError] = useState<string | undefined>(undefined);
  const [isFetchingFallbackCookbook, setIsFetchingFallbackCookbook] = useState(false);
  const fallbackFetchAttemptedRef = useRef(false);

  useEffect(() => {
    if (isAnonymous) {
      if (fallbackFetchAttemptedRef.current) {
        fallbackFetchAttemptedRef.current = false;
      }

      setFallbackCookbook((prev) => (prev !== null ? null : prev));
      setFallbackCookbookError((prev) => (prev !== undefined ? undefined : prev));
      setIsFetchingFallbackCookbook((prev) => (prev ? false : prev));
      return;
    }

    if (cookbook || cookbookId) {
      if (fallbackFetchAttemptedRef.current) {
        fallbackFetchAttemptedRef.current = false;
      }

      setFallbackCookbook((prev) => (prev !== null ? null : prev));
      setFallbackCookbookError((prev) => (prev !== undefined ? undefined : prev));
      return;
    }

    if (isLoadingCookbook || fallbackFetchAttemptedRef.current) {
      return;
    }

    fallbackFetchAttemptedRef.current = true;
    let isCancelled = false;

    const fetchFallbackCookbook = async () => {
      setIsFetchingFallbackCookbook(true);
      setFallbackCookbookError(undefined);

      try {
        const response = await fetch("/api/cookbooks?sort=created_at&order=desc", {
          credentials: "include",
        });

        const payload = (await response.json().catch(() => null)) as
          | (Partial<CookbookListResponseDTO> & { error?: string })
          | null;

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Failed to load cookbook.";
          throw new Error(message);
        }

        const cookbooks = Array.isArray(payload?.cookbooks) ? (payload?.cookbooks as CookbookDTO[]) : [];

        if (cookbooks.length === 0) {
          throw new Error("No cookbook found.");
        }

        const sortedCookbooks = [...cookbooks].sort((a, b) => b.created_at.localeCompare(a.created_at));
        const resolvedCookbook = cookbooks.find((item) => item.is_default) ?? sortedCookbooks[0] ?? null;

        if (!resolvedCookbook) {
          throw new Error("No cookbook found.");
        }

        if (!isCancelled) {
          setFallbackCookbook(resolvedCookbook);
        }
      } catch (error) {
        if (!isCancelled) {
          setFallbackCookbook(null);
          setFallbackCookbookError(error instanceof Error ? error.message : "Failed to load cookbook.");
        }
      } finally {
        if (!isCancelled) {
          setIsFetchingFallbackCookbook(false);
        }
      }
    };

    void fetchFallbackCookbook();

    return () => {
      isCancelled = true;
    };
  }, [cookbook, cookbookId, isAnonymous, isLoadingCookbook]);

  const resolvedCookbook = cookbook ?? fallbackCookbook ?? null;
  const effectiveCookbookId = resolvedCookbook?.id ?? cookbookId;
  const effectiveUserId = userId ?? resolvedCookbook?.user_id ?? null;
  const cookbookLoading = isLoadingCookbook || isFetchingFallbackCookbook;
  const cookbookLoadError = resolvedCookbook ? undefined : (fallbackCookbookError ?? cookbookError);

  const {
    items: recipeItems,
    pagination,
    isLoading: isLoadingRecipes,
    error: recipeError,
    refetch,
  } = useRecipeList({
    cookbookId: effectiveCookbookId,
    userId: effectiveUserId,
    query: listQuery,
    enabled: !isAnonymous && Boolean(effectiveCookbookId) && Boolean(effectiveUserId),
  });

  const totalSpreads = pagination?.totalSpreads ?? 0;
  const currentPage =
    totalSpreads > 0
      ? Math.min(Math.max(listQueryState.page ?? MIN_PAGE, MIN_PAGE), totalSpreads)
      : Math.max(listQueryState.page ?? MIN_PAGE, MIN_PAGE);

  useEffect(() => {
    if (!pagination) {
      return;
    }

    setListQueryState((prev) => {
      const { totalSpreads = 0 } = pagination;

      if (totalSpreads === 0) {
        if (prev.page === MIN_PAGE) {
          return prev;
        }
        return {
          ...prev,
          page: MIN_PAGE,
        };
      }

      if (prev.page <= totalSpreads) {
        return prev;
      }

      return {
        ...prev,
        page: totalSpreads,
      };
    });
  }, [pagination]);

  const {
    getRecipe,
    prefetchRecipes,
    removeRecipes,
    isLoadingRecipe,
    error: detailsError,
  } = useRecipeDetailsCache(isAnonymous ? undefined : effectiveUserId);

  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [leftRecipeId, rightRecipeId] = useMemo(() => {
    const leftIndex = (currentPage - 1) * 2;
    const rightIndex = leftIndex + 1;
    return [recipeItems[leftIndex]?.id, recipeItems[rightIndex]?.id];
  }, [currentPage, recipeItems]);

  useEffect(() => {
    if (isAnonymous) {
      return;
    }
    void prefetchRecipes([leftRecipeId, rightRecipeId]);
  }, [isAnonymous, leftRecipeId, rightRecipeId, prefetchRecipes]);

  const leftRecipe = useMemo(() => getRecipe(leftRecipeId), [getRecipe, leftRecipeId]);
  const rightRecipe = useMemo(() => getRecipe(rightRecipeId), [getRecipe, rightRecipeId]);

  const handleSelectRecipe = useCallback((_recipeId: string, index: number) => {
    const nextPage = Math.floor(index / 2) + 1;
    setListQueryState((prev) => ({
      ...prev,
      page: nextPage,
    }));
  }, []);

  const updatePage = useCallback((page: number) => {
    setListQueryState((prev) => ({
      ...prev,
      page: page < MIN_PAGE ? MIN_PAGE : page,
    }));
  }, []);

  const handleDeleteRecipe = useCallback(
    async (recipeId: string, recipeTitle?: string) => {
      if (!recipeId || isAnonymous) {
        return;
      }

      if (typeof window !== "undefined") {
        const confirmationMessage = recipeTitle
          ? `Delete "${recipeTitle}"? This will permanently remove its ingredients and tags.`
          : "Delete this recipe? This will permanently remove its ingredients and tags.";

        const confirmed = window.confirm(confirmationMessage);
        if (!confirmed) {
          return;
        }
      }

      setDeleteError(null);
      setDeletingRecipeId(recipeId);

      try {
        const response = await fetch(`/api/recipes/${recipeId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          let message = "Failed to delete recipe.";
          try {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
              message = payload.error;
            }
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message);
        }

        removeRecipes([recipeId]);
        await refetch();

        setListQueryState((prev) => ({
          ...prev,
          page: Math.max(prev.page ?? MIN_PAGE, MIN_PAGE),
        }));
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Failed to delete recipe.");
      } finally {
        setDeletingRecipeId(null);
      }
    },
    [isAnonymous, refetch, removeRecipes]
  );

  const isSidebarLoading = cookbookLoading || isLoadingRecipes;
  const sidebarError = useMemo(() => {
    if (isAnonymous) {
      return undefined;
    }
    const messages = [recipeError, deleteError].filter((message): message is string => Boolean(message));
    if (messages.length === 0) {
      return undefined;
    }
    return messages.join(" ");
  }, [deleteError, isAnonymous, recipeError]);
  const spreadError = cookbookLoadError || deleteError || recipeError || detailsError;

  const navigationPage = listQueryState.page;
  const hasPrev = navigationPage > MIN_PAGE;
  const hasNext = totalSpreads > 0 && navigationPage < totalSpreads;

  return (
    <BookLayout
      banner={<SessionBanner visible={isAnonymous} />}
      sidebar={
        <SidebarRecipeList
          items={recipeItems}
          selectedRecipeId={leftRecipeId}
          onSelectRecipe={handleSelectRecipe}
          loading={isSidebarLoading}
          error={sidebarError}
          onDeleteRecipe={handleDeleteRecipe}
          deletingRecipeId={deletingRecipeId}
        />
      }
      spread={
        <div className="flex h-full flex-col gap-6 px-6 py-6 md:px-10 md:py-8" data-test-id="recipe-preview-spread">
          <header className="book-wood-panel text-center shadow-book">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:text-left">
              <div className="flex flex-1 flex-col items-center gap-3 md:items-start">
                {cookbookLoading ? (
                  <div className="h-8 w-56 animate-pulse rounded-md book-skeleton" />
                ) : (
                  <h1 className="book-burned-text text-2xl tracking-[0.15em]">
                    {resolvedCookbook?.title ?? "Cookbook"}
                  </h1>
                )}
                {!isAnonymous && !resolvedCookbook && !cookbookLoading && (
                  <p className="text-sm text-ink-soft">{cookbookLoadError ?? "Select a cookbook to begin."}</p>
                )}
                {spreadError && !isAnonymous && (
                  <p className="text-sm text-ink-soft" role="alert">
                    {spreadError}
                  </p>
                )}
              </div>
              {!isAnonymous ? (
                <div className="flex flex-col items-center gap-2 text-sm text-ink-soft md:items-end">
                  <span>
                    Signed in as <span className="font-medium text-ink">{currentUserName ?? "Account"}</span>
                  </span>
                  <LogoutButton className="flex-row items-center gap-3" />
                </div>
              ) : null}
            </div>
          </header>

          <div className="flex-1">
            <div className="book-divider grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
              <RecipePreviewCard
                recipe={leftRecipe}
                side="left"
                loading={isSidebarLoading || isLoadingRecipe(leftRecipeId)}
              />
              <RecipePreviewCard
                recipe={rightRecipe}
                side="right"
                loading={isSidebarLoading || isLoadingRecipe(rightRecipeId)}
              />
            </div>
          </div>

          <SpreadNavigation
            page={navigationPage}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={() => updatePage((navigationPage || MIN_PAGE) - 1)}
            onNext={() => updatePage((navigationPage || MIN_PAGE) + 1)}
          />
        </div>
      }
      toasts={<ToastHost />}
    />
  );
}
