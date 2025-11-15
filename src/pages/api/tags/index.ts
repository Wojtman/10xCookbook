import type { APIRoute } from "astro";
import { fetchAllTags, TagServiceError } from "../../../lib/services/tag.service";
import { createErrorResponse, createInternalErrorResponse } from "../../../lib/utils/error-response";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const requestId = crypto.randomUUID();

  try {
    const result = await fetchAllTags(locals.supabase);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof TagServiceError) {
      console.error(`[Tags#getAll] Supabase error (${requestId}):`, error.cause ?? error);
      return createInternalErrorResponse(requestId);
    }

    console.error(`[Tags#getAll] Unexpected error (${requestId}):`, error);
    return createInternalErrorResponse(requestId);
  }
};
