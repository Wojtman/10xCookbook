import type { SupabaseClient } from '../../db/supabase.client';
import type {
  IngredientCatalogDTO,
  IngredientSearchQueryParams,
  IngredientSearchResponseDTO,
} from '../../types';
import {
  escapeIngredientSearchTerm,
  INGREDIENT_SEARCH_DEFAULT_LIMIT,
  INGREDIENT_SEARCH_MAX_LIMIT,
} from '../validation/ingredient.validator';

/**
 * Error representing an unexpected failure while searching ingredients.
 */
export class IngredientServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'IngredientServiceError';
  }
}

const INGREDIENT_TABLE = 'ingredients';
const INGREDIENT_COLUMNS = 'id, name, description';

/**
 * Performs a sanitized ingredient catalogue search using Supabase.
 *
 * @param client - Scoped Supabase client provided by Astro locals
 * @param params - Validated search parameters
 * @returns Matching ingredient entries and the total count
 * @throws IngredientServiceError when Supabase fails or returns an unexpected shape
 */
export async function searchIngredients(
  client: SupabaseClient,
  params: IngredientSearchQueryParams,
): Promise<IngredientSearchResponseDTO> {
  const limit = Math.min(params.limit ?? INGREDIENT_SEARCH_DEFAULT_LIMIT, INGREDIENT_SEARCH_MAX_LIMIT);

  const sanitizedTerm = escapeIngredientSearchTerm(params.q);
  const prefixPattern = `${sanitizedTerm}%`;
  const infixPattern = `%${sanitizedTerm}%`;

  const query = client
    .from(INGREDIENT_TABLE)
    .select(INGREDIENT_COLUMNS, { count: 'exact' })
    .or(
      [
        `name.ilike.${prefixPattern}`,
        `name.ilike.${infixPattern}`,
        `description.ilike.${infixPattern}`,
      ].join(','),
    )
    .order('name', { ascending: true })
    .limit(INGREDIENT_SEARCH_MAX_LIMIT);

  const { data, error, count } = await query;

  if (error) {
    throw new IngredientServiceError('Failed to search ingredients via Supabase', error);
  }

  if (!Array.isArray(data)) {
    throw new IngredientServiceError('Supabase returned an unexpected response while searching ingredients');
  }

  const normalizedTerm = params.q.toLocaleLowerCase();

  const ranked = data
    .map((item) => item as IngredientCatalogDTO)
    .sort((a, b) => {
      const scoreA = computeRelevanceScore(a, normalizedTerm);
      const scoreB = computeRelevanceScore(b, normalizedTerm);

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    })
    .slice(0, limit);

  return {
    ingredients: ranked,
    total: typeof count === 'number' ? count : ranked.length,
  };
}

function computeRelevanceScore(ingredient: IngredientCatalogDTO, term: string): number {
  const name = ingredient.name.toLocaleLowerCase();
  const description = (ingredient.description ?? '').toLocaleLowerCase();

  if (name === term) {
    return 0;
  }

  if (name.startsWith(term)) {
    return 1;
  }

  if (name.includes(term)) {
    return 2;
  }

  if (description.includes(term)) {
    return 3;
  }

  return 4;
}


