import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { AIParseRequestSchema, sanitizeRawText } from "../../../lib/validation/ai.validator";
import { parseRecipeWithAI, AIParsingError } from "../../../lib/services/aiParsing.service";
import {
  ensureWithinRateLimit,
  RateLimitExceededError,
  RateLimitServiceError,
} from "../../../lib/services/rateLimit.service";
import { logAnalyticsEvent, AnalyticsServiceError } from "../../../lib/services/analytics.service";
import { VALIDATION_CONSTANTS } from "../../../types";
import type { LogAnalyticsEventCommand } from "../../../types";
import { buildErrorResponse } from "../../../lib/utils/error-response";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = crypto.randomUUID();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify(buildErrorResponse("invalid_json", "Invalid JSON in request body")), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: ReturnType<typeof AIParseRequestSchema.parse>;
  try {
    payload = AIParseRequestSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            "validation_error",
            "Request body failed validation",
            error.errors.map((err) => err.path.join(".") || err.message)
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

  const sanitizedRawText = sanitizeRawText(payload.raw_text);
  if (!sanitizedRawText) {
    return new Response(
      JSON.stringify(
        buildErrorResponse("validation_error", "raw_text must contain recipe content after sanitization", ["raw_text"])
      ),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await locals.supabase.auth.getUser();

  if (userError) {
    console.error("Failed to retrieve Supabase user for AI parse:", userError);
    return new Response(JSON.stringify(buildErrorResponse("auth_error", "Unable to verify authentication status")), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!user && !payload.session_id) {
    return new Response(
      JSON.stringify(
        buildErrorResponse("validation_error", "session_id is required for anonymous requests", ["session_id"])
      ),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const analyticsSessionId = payload.session_id ?? user?.id ?? requestId;

  try {
    await ensureWithinRateLimit({
      supabase: locals.supabase,
      identifier: user ? { userId: user.id } : { sessionId: payload.session_id ?? null },
      eventType: "recipe_parse_requested",
      maxRequests: VALIDATION_CONSTANTS.RATE_LIMITS.AI_PARSE_PER_MINUTE,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return new Response(
        JSON.stringify({
          ...buildErrorResponse("rate_limit_exceeded", "Too many AI parse requests. Please wait and try again."),
          retry_after: error.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    if (error instanceof RateLimitServiceError) {
      console.error("Rate limiter failed for AI parse request:", error);
      return new Response(
        JSON.stringify(
          buildErrorResponse("rate_limit_failed", "Unable to verify request limits. Please try again later.")
        ),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    throw error;
  }

  try {
    await logAnalyticsEvent({
      supabase: locals.supabase,
      userId: user?.id ?? null,
      command: {
        session_id: analyticsSessionId,
        event_type: "recipe_parse_requested",
        event_data: {
          request_id: requestId,
          text_length: sanitizedRawText.length,
        },
      },
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      console.error("Failed to log recipe_parse_requested event:", error);
      return new Response(
        JSON.stringify(buildErrorResponse("analytics_error", "Unable to process AI parse request at this time.")),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    throw error;
  }

  const startedAt = Date.now();

  try {
    const aiResponse = await parseRecipeWithAI({
      rawText: sanitizedRawText,
    });

    const parsingDuration = aiResponse.parsing_duration_ms ?? Date.now() - startedAt;

    const responsePayload = {
      ...aiResponse,
      parsing_duration_ms: parsingDuration,
    };

    try {
      await logAnalyticsEvent({
        supabase: locals.supabase,
        userId: user?.id ?? null,
        command: {
          session_id: analyticsSessionId,
          event_type: "recipe_parse_success",
          event_data: {
            request_id: requestId,
            duration_ms: parsingDuration,
            ingredient_count: responsePayload.ingredients.length,
          },
        },
      });
    } catch (error) {
      console.error("Failed to log recipe_parse_success event:", error);
    }

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof AIParsingError) {
      if (error.code === "timeout") {
        await safeLogAnalyticsEvent(locals.supabase, user?.id ?? null, {
          session_id: analyticsSessionId,
          event_type: "recipe_parse_timeout",
          event_data: {
            request_id: requestId,
            timeout_ms: VALIDATION_CONSTANTS.AI_PARSE.TIMEOUT_MS,
          },
        });

        return new Response(
          JSON.stringify({
            error: "parse_timeout",
            message: "AI parsing timed out. Please try again with shorter text.",
            timeout_ms: VALIDATION_CONSTANTS.AI_PARSE.TIMEOUT_MS,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 408,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await safeLogAnalyticsEvent(locals.supabase, user?.id ?? null, {
        session_id: analyticsSessionId,
        event_type: "recipe_parse_error",
        event_data: {
          request_id: requestId,
          error_code: error.code,
          status: error.status,
        },
      });

      return new Response(
        JSON.stringify(buildErrorResponse("parse_error", "AI parsing failed. Please try again later.")),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.error("Unexpected error during AI parsing:", error);
    return new Response(
      JSON.stringify({
        ...buildErrorResponse("internal_server_error", "An unexpected error occurred while parsing the recipe."),
        request_id: requestId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

async function safeLogAnalyticsEvent(
  supabase: App.Locals["supabase"],
  userId: string | null,
  command: LogAnalyticsEventCommand
): Promise<void> {
  try {
    await logAnalyticsEvent({
      supabase,
      userId,
      command,
    });
  } catch (error) {
    console.error("Non-critical analytics logging failure:", error);
  }
}
