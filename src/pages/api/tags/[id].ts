import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import {
  fetchTagByIdentifier,
  TagNotFoundError,
  TagServiceError,
} from '../../../lib/services/tag.service';
import {
  TagIdentifierSchema,
  TagIdentifierInput,
} from '../../../lib/validation/tag.validator';
import {
  createErrorResponse,
  createInternalErrorResponse,
} from '../../../lib/utils/error-response';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const requestId = crypto.randomUUID();
  const identifier = params.id;

  let validatedId: TagIdentifierInput;
  try {
    validatedId = TagIdentifierSchema.parse(identifier);
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse(
        400,
        'validation_error',
        'id parameter failed validation',
        error.errors.map((err) => err.path.join('.') || err.message),
      );
    }
    throw error;
  }

  try {
    const tag = await fetchTagByIdentifier(locals.supabase, validatedId);

    return new Response(JSON.stringify(tag), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    if (error instanceof TagNotFoundError) {
      return createErrorResponse(404, 'not_found', 'Tag not found');
    }

    if (error instanceof TagServiceError) {
      console.error(`[Tags#getById] Supabase error (${requestId}):`, error.cause ?? error);
      return createInternalErrorResponse(requestId);
    }

    console.error(`[Tags#getById] Unexpected error (${requestId}):`, error);
    return createInternalErrorResponse(requestId);
  }
};


