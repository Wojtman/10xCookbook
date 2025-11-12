import { useCallback, useMemo, useRef, useState } from 'react';

import { supabaseClient } from '@/db/supabase.client';
import { RecipeService } from '@/lib/services/recipe.service';
import type { RecipeDetailDTO, TagDTO } from '@/types';

import type { RecipePreviewVM } from '../types/recipePreview';

interface CacheState {
  map: Map<string, RecipePreviewVM>;
  loadingIds: Set<string>;
  error?: string;
}

export interface UseRecipeDetailsCacheResult {
  getRecipe: (recipeId: string | undefined) => RecipePreviewVM | undefined;
  loadRecipe: (recipeId: string | undefined) => Promise<RecipePreviewVM | undefined>;
  prefetchRecipes: (recipeIds: Array<string | undefined>) => Promise<void>;
  isLoadingAny: boolean;
  isLoadingRecipe: (recipeId: string | undefined) => boolean;
  error?: string;
}

function mapRecipeDetailToPreview(dto: RecipeDetailDTO): RecipePreviewVM {
  const sortedIngredients = [...(dto.ingredients ?? [])].sort((a, b) => a.display_order - b.display_order);
  const dedupedTags = Array.from(
    dto.tags.reduce((acc, tag) => acc.set(tag.id, tag as TagDTO), new Map<string, TagDTO>()).values()
  );

  return {
    id: dto.id,
    title: dto.title ?? 'Untitled recipe',
    preparationDescription: dto.preparation_description ?? '',
    imageUrl: dto.image_url,
    imageAltText: dto.image_alt_text,
    ingredients: sortedIngredients,
    tags: dedupedTags,
    prepTimeMinutes: dto.prep_time_minutes,
  };
}

export function useRecipeDetailsCache(userId?: string | null): UseRecipeDetailsCacheResult {
  const [state, setState] = useState<CacheState>({
    map: new Map<string, RecipePreviewVM>(),
    loadingIds: new Set<string>(),
    error: undefined,
  });

  const recipeServiceRef = useRef<RecipeService | null>(null);

  if (!recipeServiceRef.current) {
    recipeServiceRef.current = new RecipeService(supabaseClient);
  }

  const setLoading = useCallback((recipeId: string, isLoading: boolean) => {
    setState(prev => {
      const nextLoading = new Set(prev.loadingIds);
      if (isLoading) {
        nextLoading.add(recipeId);
      } else {
        nextLoading.delete(recipeId);
      }

      return {
        ...prev,
        loadingIds: nextLoading,
      };
    });
  }, []);

  const upsertRecipe = useCallback((recipe: RecipePreviewVM) => {
    setState(prev => {
      const nextMap = new Map(prev.map);
      nextMap.set(recipe.id, recipe);
      return {
        ...prev,
        map: nextMap,
        error: undefined,
      };
    });
  }, []);

  const handleError = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      error: message,
    }));
  }, []);

  const loadRecipe = useCallback(
    async (recipeId: string | undefined) => {
      if (!recipeId || !userId) {
        return undefined;
      }

      if (state.map.has(recipeId)) {
        return state.map.get(recipeId);
      }

      if (state.loadingIds.has(recipeId)) {
        return undefined;
      }

      try {
        setLoading(recipeId, true);
        const recipeService = recipeServiceRef.current!;
        const dto = await recipeService.getRecipeById(recipeId, userId);

        if (!dto) {
          handleError('Recipe could not be found.');
          return undefined;
        }

        const preview = mapRecipeDetailToPreview(dto);
        upsertRecipe(preview);
        return preview;
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'Failed to load recipe details.');
        return undefined;
      } finally {
        setLoading(recipeId, false);
      }
    },
    [handleError, setLoading, state.loadingIds, state.map, upsertRecipe, userId]
  );

  const prefetchRecipes = useCallback(
    async (recipeIds: Array<string | undefined>) => {
      const validIds = recipeIds.filter((id): id is string => Boolean(id));
      if (!userId || validIds.length === 0) {
        return;
      }

      await Promise.all(validIds.map(id => loadRecipe(id)));
    },
    [loadRecipe, userId]
  );

  const getRecipe = useCallback(
    (recipeId: string | undefined) => {
      if (!recipeId) {
        return undefined;
      }
      return state.map.get(recipeId);
    },
    [state.map]
  );

  const isLoadingRecipe = useCallback(
    (recipeId: string | undefined) => {
      if (!recipeId) {
        return false;
      }
      return state.loadingIds.has(recipeId);
    },
    [state.loadingIds]
  );

  const isLoadingAny = useMemo(() => state.loadingIds.size > 0, [state.loadingIds]);

  return {
    getRecipe,
    loadRecipe,
    prefetchRecipes,
    isLoadingAny,
    isLoadingRecipe,
    error: state.error,
  };
}

