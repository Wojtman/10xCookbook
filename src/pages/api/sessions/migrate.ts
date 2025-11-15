import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { buildErrorResponse } from "../../../lib/utils/error-response";
import {
  AnonymousRecipesNotFoundError,
  CookbookOwnershipError,
  SessionAlreadyMigratedError,
  SessionExpiredError,
  SessionMigrationConflictError,
  SessionNotFoundError,
  SessionService,
  SessionServiceError,
} from "../../../lib/services/session.service";
import { SessionMigrationSchema } from "../../../lib/validation/session.validator";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
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

  let payloadRaw: unknown;
  try {
    payloadRaw = await request.json();
  } catch {
    return new Response(JSON.stringify(buildErrorResponse("invalid_json", "Invalid JSON payload")), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { session_id: string; target_cookbook_id?: string };
  try {
    payload = SessionMigrationSchema.parse(payloadRaw);
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            "validation_error",
            "Invalid migration payload",
            error.errors.map((issue) => issue.path.join("."))
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

  const sessionService = new SessionService(locals.supabase);

  try {
    const result = await sessionService.migrateAnonymousSession({
      sessionToken: payload.session_id,
      targetCookbookId: payload.target_cookbook_id,
      userId: user.id,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return new Response(
        JSON.stringify(buildErrorResponse("session_not_found", "Anonymous session not found", ["session_id"])),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof SessionExpiredError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse("session_expired", "Anonymous session has expired. Please request a new session token.", [
            "session_id",
          ])
        ),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof SessionAlreadyMigratedError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse("already_migrated", "This anonymous session has already been migrated.", ["session_id"])
        ),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof AnonymousRecipesNotFoundError) {
      return new Response(
        JSON.stringify(buildErrorResponse("session_empty", "No anonymous recipes found to migrate for this session.")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof CookbookOwnershipError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse("cookbook_not_found", "Target cookbook was not found or you do not have access to it.", [
            "target_cookbook_id",
          ])
        ),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof SessionMigrationConflictError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            "migration_conflict",
            "This anonymous session is being migrated elsewhere. Please refresh and try again."
          )
        ),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof SessionServiceError) {
      console.error("Session migration failed", error);
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            "session_migration_failed",
            "Unable to migrate anonymous session at this time. Please try again later."
          )
        ),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.error("Unexpected error migrating anonymous session", error);
    return new Response(
      JSON.stringify(
        buildErrorResponse("internal_error", "An unexpected error occurred while migrating anonymous recipes.")
      ),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
