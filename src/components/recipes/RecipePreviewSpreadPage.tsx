import { useCallback, useEffect, useMemo, useState } from 'react';

import { BookLayout } from '@/components/recipes/BookLayout';
import { useCookbookSelection } from '@/lib/hooks/useCookbookSelection';
import { useRecipeList } from '@/lib/hooks/useRecipeList';
import { useRecipeDetailsCache } from '@/lib/hooks/useRecipeDetailsCache';
import type { RecipeListQueryParams } from '@/types';

import { RecipePreviewCard } from './RecipePreviewCard';
import { SidebarRecipeList } from './SidebarRecipeList';
import type { RecipeListQueryState } from '@/lib/types/recipe-preview';
import { SessionBanner } from './SessionBanner';
import { SpreadNavigation } from './SpreadNavigation';
import { ToastHost } from './ToastHost';

const DEFAULT_SORT: RecipeListQueryState['sort'] = 'display_order';
const DEFAULT_ORDER: RecipeListQueryState['order'] = 'asc';
const SIDEBAR_FETCH_LIMIT = 1000; // Matches DEFAULT_LIMIT in useRecipeList
const MIN_PAGE = 1;

export interface RecipePreviewSpreadPageProps {
  initialCookbookId?: string;
  initialPage?: number;
  initialSort?: RecipeListQueryState['sort'];
  initialOrder?: RecipeListQueryState['order'];
  initialTags?: string | null;
  initialSearch?: string | null;
}

export function RecipePreviewSpreadPage({
  initialCookbookId,
  initialPage,
  initialSort,
  initialOrder,
  initialTags,
  initialSearch,
}: RecipePreviewSpreadPageProps) {
  const sanitizedPage = Number.isFinite(initialPage) && (initialPage ?? 0) >= MIN_PAGE ? (initialPage as number) : MIN_PAGE;
  const sanitizedSort = initialSort ?? DEFAULT_SORT;
  const sanitizedOrder = initialOrder ?? DEFAULT_ORDER;

  const [listQueryState, setListQueryState] = useState<RecipeListQueryState>(() => ({
    page: sanitizedPage,
    sort: sanitizedSort,
    order: sanitizedOrder,
    ...(initialTags ? { tags: initialTags } : {}),
    ...(initialSearch ? { search: initialSearch } : {}),
  }));

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

  const { cookbookId, cookbook, userId, isAnonymous, isLoading: isLoadingCookbook, error: cookbookError } =
    useCookbookSelection(initialCookbookId);

  const {
    items: recipeItems,
    pagination,
    isLoading: isLoadingRecipes,
    error: recipeError,
  } = useRecipeList({
    cookbookId,
    userId,
    query: listQuery,
    enabled: !isAnonymous && Boolean(cookbookId),
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

    setListQueryState(prev => {
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

  const { getRecipe, prefetchRecipes, isLoadingRecipe, error: detailsError } = useRecipeDetailsCache(
    isAnonymous ? undefined : userId
  );

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

  const handleSelectRecipe = useCallback(
    (_recipeId: string, index: number) => {
      const nextPage = Math.floor(index / 2) + 1;
      setListQueryState(prev => ({
        ...prev,
        page: nextPage,
      }));
    },
    []
  );

  const updatePage = useCallback(
    (page: number) => {
      setListQueryState(prev => ({
        ...prev,
        page: page < MIN_PAGE ? MIN_PAGE : page,
      }));
    },
    []
  );

  const isSidebarLoading = isLoadingCookbook || isLoadingRecipes;
  const spreadError = cookbookError || recipeError || detailsError;

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
          error={isAnonymous ? undefined : recipeError}
        />
      }
      spread={
        <div className="flex h-full flex-col bg-white">
          <header className="border-b border-neutral-200 px-8 py-6">
            <div className="flex flex-col items-center gap-2">
              {isLoadingCookbook ? (
                <div className="h-7 w-56 animate-pulse rounded bg-neutral-100" />
              ) : (
                <h1 className="text-2xl font-semibold text-neutral-900 text-center">
                  {cookbook?.title ?? 'Cookbook'}
                </h1>
              )}
              {!isAnonymous && !cookbook && !isLoadingCookbook && (
                <p className="text-sm text-neutral-500">
                  {cookbookError ?? 'Select a cookbook to begin.'}
                </p>
              )}
              {spreadError && !isAnonymous && (
                <p className="text-sm text-red-600" role="alert">
                  {spreadError}
                </p>
              )}
            </div>
          </header>

          <div className="flex-1">
            <div className="grid h-full grid-cols-1 divide-y divide-neutral-200 lg:grid-cols-2 lg:divide-y-0 lg:divide-x">
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

