import type { APIRoute } from 'astro';
import {
  deriveClientFingerprint,
} from '../../../lib/validation/session.validator';
import { SessionService, SessionServiceError } from '../../../lib/services/session.service';
import {
  RateLimitExceededError,
  RateLimitServiceError,
} from '../../../lib/services/rateLimit.service';
import { buildErrorResponse } from '../../../lib/utils/error-response';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  const sessionService = new SessionService(supabase);

  try {
    const clientFingerprint = deriveClientFingerprint(request);

    const session = await sessionService.createAnonymousSession({
      clientFingerprint,
    });

    return new Response(JSON.stringify(session), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            'too_many_requests',
            'Anonymous session request limit exceeded. Please try again later.',
          ),
        ),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': error.retryAfterSeconds.toString(),
          },
        },
      );
    }

    if (error instanceof RateLimitServiceError) {
      console.error('Rate limiting failed during anonymous session creation', error);
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            'rate_limit_error',
            'Unable to evaluate anonymous session rate limit. Please try again.',
          ),
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (error instanceof SessionServiceError) {
      console.error('Failed to create anonymous session', error);
      return new Response(
        JSON.stringify(
          buildErrorResponse(
            'session_creation_failed',
            'Unable to create anonymous session at this time. Please try again later.',
          ),
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    console.error('Unexpected error creating anonymous session', error);
    return new Response(
      JSON.stringify(
        buildErrorResponse(
          'internal_error',
          'An unexpected error occurred while creating an anonymous session.',
        ),
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};


