import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { searchIngredients, IngredientServiceError } from "../../../lib/services/ingredient.service";
import { createErrorResponse, createInternalErrorResponse } from "../../../lib/utils/error-response";
import { parseIngredientSearchQuery } from "../../../lib/validation/ingredient.validator";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    const queryParams = parseIngredientSearchQuery(rawParams);

    const result = await searchIngredients(locals.supabase, queryParams);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.issues.map((issue) => issue.path.join(".")).filter((path) => path.length > 0);

      const message = error.issues.map((issue) => issue.message).join("; ");

      return createErrorResponse(400, "validation_error", message, fields.length > 0 ? fields : undefined);
    }

    if (error instanceof IngredientServiceError) {
      console.error(`[Ingredients#search] Supabase error (${requestId}):`, error.cause ?? error);
      return createInternalErrorResponse(requestId);
    }

    console.error(`[Ingredients#search] Unexpected error (${requestId}):`, error);
    return createInternalErrorResponse(requestId);
  }
};
