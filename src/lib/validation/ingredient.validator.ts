import { z } from "zod";
import type { IngredientSearchQueryParams } from "../../types";

/**
 * Validation schema and helpers for ingredient catalogue search queries.
 */

export const INGREDIENT_SEARCH_MIN_QUERY_LENGTH = 2;
export const INGREDIENT_SEARCH_DEFAULT_LIMIT = 10;
export const INGREDIENT_SEARCH_MAX_LIMIT = 50;

/**
 * Zod schema validating the query parameters for the ingredient search endpoint.
 *
 * - `q` must be a trimmed string with at least two characters after normalization.
 * - `limit` is optional, coerced to a number, and constrained between 1 and 50.
 */
export const IngredientSearchQuerySchema = z.object({
  q: z
    .string({
      required_error: "q is required",
      invalid_type_error: "q must be a string",
    })
    .trim()
    .min(INGREDIENT_SEARCH_MIN_QUERY_LENGTH, `q must be at least ${INGREDIENT_SEARCH_MIN_QUERY_LENGTH} characters`)
    .transform((value) => value.replace(/\s+/g, " ")),
  limit: z.optional(
    z.coerce
      .number({
        invalid_type_error: "limit must be a number",
      })
      .int("limit must be an integer")
      .min(1, "limit must be at least 1")
      .max(INGREDIENT_SEARCH_MAX_LIMIT, `limit must not exceed ${INGREDIENT_SEARCH_MAX_LIMIT}`)
  ),
});

export type IngredientSearchQueryInput = z.infer<typeof IngredientSearchQuerySchema>;

/**
 * Parses raw query parameters into a normalized payload adhering to
 * `IngredientSearchQueryParams`.
 *
 * @param input - Raw query parameter bag (e.g., Astro's `request.url.searchParams`)
 * @returns Validated and normalized query parameters
 */
export function parseIngredientSearchQuery(input: Record<string, unknown>): IngredientSearchQueryParams {
  const result = IngredientSearchQuerySchema.parse(input);

  return {
    q: result.q,
    ...(result.limit !== undefined && { limit: result.limit }),
  };
}

const WILDCARD_ESCAPE_REGEX = /([%_\\])/g;

/**
 * Escapes SQL LIKE wildcard characters to prevent accidental broad matches.
 *
 * @param value - Raw search term
 * @returns Escaped search term safe for `ilike` queries
 */
export function escapeIngredientSearchTerm(value: string): string {
  return value.replace(WILDCARD_ESCAPE_REGEX, "\\$1");
}
