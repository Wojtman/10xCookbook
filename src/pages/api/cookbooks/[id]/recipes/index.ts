import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { RecipeService } from "../../../../../lib/services/recipe.service";
import { RecipeListQuerySchema, UUIDParamSchema } from "../../../../../lib/validation/recipe.validator";
import { buildErrorResponse } from "../../../../../lib/utils/error-response";

export const prerender = false;

/**
 * GET /api/cookbooks/:id/recipes
 * List all recipes for a specific cookbook with pagination, filtering, and sorting
 *
 * Path Parameters:
 * - id: Cookbook UUID
 *
 * Query Parameters:
 * - page: number (default: 1, min: 1)
 * - limit: number (default: 20, min: 1, max: 100)
 * - sort: 'display_order' | 'created_at' | 'updated_at' | 'title' | 'prep_time_minutes' (default: 'display_order')
 * - order: 'asc' | 'desc' (default: 'asc')
 * - tags: comma-separated tag slugs
 * - search: full-text search query
 * - prep_time_min: minimum prep time in minutes
 * - prep_time_max: maximum prep time in minutes
 *
 * Requires authentication via Supabase Auth
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  try {
    // 1. Get authenticated user from Supabase session
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify(buildErrorResponse("unauthorized", "Authentication required")), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Validate cookbook ID parameter
    let cookbookId: string;
    try {
      cookbookId = UUIDParamSchema.parse(params.id);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse("validation_error", "Invalid cookbook ID format", ["id"])),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // 3. Extract and validate query parameters
    const queryParams = {
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      sort: url.searchParams.get("sort") || undefined,
      order: url.searchParams.get("order") || undefined,
      tags: url.searchParams.get("tags") || undefined,
      search: url.searchParams.get("search") || undefined,
      prep_time_min: url.searchParams.get("prep_time_min") || undefined,
      prep_time_max: url.searchParams.get("prep_time_max") || undefined,
    };

    let validatedParams;
    try {
      validatedParams = RecipeListQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(
            buildErrorResponse(
              "validation_error",
              "Invalid query parameters",
              error.errors.map((e) => e.path.join("."))
            )
          ),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // 4. Get recipes from database via service layer
    const recipeService = new RecipeService(locals.supabase);

    let result;
    try {
      result = await recipeService.listRecipes(cookbookId, user.id, validatedParams);
    } catch (error) {
      // Check if error is due to cookbook not found or access denied
      if (error instanceof Error && error.message.includes("not found or access denied")) {
        return new Response(
          JSON.stringify(buildErrorResponse("not_found", "Cookbook not found or you do not have access to it")),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // 5. Return successful response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing recipes:", error);
    return new Response(
      JSON.stringify(buildErrorResponse("internal_error", "An unexpected error occurred while listing recipes")),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
