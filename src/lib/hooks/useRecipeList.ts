import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabaseClient } from '@/db/supabase.client';
import { RecipeService } from '@/lib/services/recipe.service';
import type { RecipeListItemDTO, RecipeListQueryParams, TagDTO } from '@/types';

import type { SidebarRecipeListItemVM, SpreadPaginationVM } from '../types/recipePreview';

interface UseRecipeListArgs {
  cookbookId?: string;
  userId?: string | null;
  query: RecipeListQueryParams;
  enabled?: boolean;
}

interface UseRecipeListState {
  items: SidebarRecipeListItemVM[];
  pagination?: SpreadPaginationVM;
  isLoading: boolean;
  error?: string;
}

export interface UseRecipeListResult {
  items: SidebarRecipeListItemVM[];
  pagination?: SpreadPaginationVM;
  isLoading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

const LIMIT_PER_SPREAD = 2;
const DEFAULT_LIMIT = 1000; // Large limit to fetch all recipes for sidebar

function mapRecipeToSidebarVM(recipe: RecipeListItemDTO): SidebarRecipeListItemVM {
  const tags: Array<Pick<TagDTO, 'id' | 'slug' | 'label' | 'icon'>> = (recipe.tags ?? []).map(tag => ({
    id: tag.id,
    slug: tag.slug,
    label: tag.label,
    icon: tag.icon,
  }));

  return {
    id: recipe.id,
    title: recipe.title?.trim() || 'Untitled recipe',
    ingredientCount: recipe.ingredient_count ?? 0,
    tags,
    displayOrder: recipe.display_order,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
  };
}

function buildPaginationVM(page: number, total: number): SpreadPaginationVM {
  const totalSpreads = total > 0 ? Math.ceil(total / LIMIT_PER_SPREAD) : 0;
  const safePage = totalSpreads === 0 ? 1 : Math.min(Math.max(page, 1), totalSpreads);

  return {
    page: safePage,
    limitPerSpread: LIMIT_PER_SPREAD,
    total,
    totalSpreads,
    hasPrev: safePage > 1,
    hasNext: totalSpreads > 0 && safePage < totalSpreads,
  };
}

export function useRecipeList({ cookbookId, userId, query, enabled = true }: UseRecipeListArgs): UseRecipeListResult {
  const [state, setState] = useState<UseRecipeListState>({
    items: [],
    pagination: undefined,
    isLoading: false,
    error: undefined,
  });

  const activeRequest = useRef(0);

  const normalizedQuery = useMemo(() => {
    const { page = 1, limit, sort = 'display_order', order = 'asc', tags, search } = query;
    return { page, limit, sort, order, tags, search };
  }, [query]);

  const fetchList = useCallback(async () => {
    const { page, sort, order, tags, search } = normalizedQuery;

    if (!cookbookId || !userId || !enabled) {
      setState({
        items: [],
        pagination: enabled ? buildPaginationVM(page, 0) : undefined,
        isLoading: false,
        error: undefined,
      });
      return;
    }

    const requestId = ++activeRequest.current;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: undefined,
    }));

    try {
      const recipeService = new RecipeService(supabaseClient);
      // Use limit from query if provided, otherwise use a large limit to fetch all recipes for sidebar
      const queryLimit = normalizedQuery.limit ?? DEFAULT_LIMIT;
      const response = await recipeService.listRecipes(cookbookId, userId, {
        page,
        limit: queryLimit,
        sort,
        order,
        ...(tags ? { tags } : {}),
        ...(search ? { search } : {}),
      });

      if (activeRequest.current !== requestId) {
        return;
      }

      const items = response.recipes.map(mapRecipeToSidebarVM);
      const pagination = buildPaginationVM(response.pagination.page ?? page, response.pagination.total);

      setState({
        items,
        pagination,
        isLoading: false,
        error: undefined,
      });
    } catch (error) {
      if (activeRequest.current !== requestId) {
        return;
      }

      const message =
        error instanceof Error ? error.message || 'Failed to load recipes.' : 'Failed to load recipes.';

      setState({
        items: [],
        pagination: undefined,
        isLoading: false,
        error: message,
      });
    }
  }, [cookbookId, enabled, normalizedQuery, userId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const refetch = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return useMemo(
    () => ({
      items: state.items,
      pagination: state.pagination,
      isLoading: state.isLoading,
      error: state.error,
      refetch,
    }),
    [refetch, state.error, state.isLoading, state.items, state.pagination]
  );
}

