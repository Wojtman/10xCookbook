import type { APIRoute } from 'astro';
import { ZodError } from 'zod';

import { getOpenRouterService } from '../../../lib/services/openrouter.factory';
import { OpenRouterServiceError } from '../../../lib/services/openrouter.service';
import {
  OpenRouterChatRequestSchema,
  type OpenRouterChatRequestInput,
} from '../../../lib/validation/openrouter.validator';
import { buildErrorResponse } from '../../../lib/utils/error-response';
import type { ServiceError } from '../../../lib/openrouter/types';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

interface ApiErrorBody
  extends ReturnType<typeof buildErrorResponse> {
  request_id?: string;
  provider_request_id?: string;
  retry_after?: number;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return createErrorResponse(400, 'invalid_json', 'Request body must be valid JSON', {
      requestId,
    });
  }

  let payload: OpenRouterChatRequestInput;
  try {
    payload = OpenRouterChatRequestSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.issues.map((issue) =>
        issue.path.join('.') || issue.message,
      );
      return createErrorResponse(
        400,
        'validation_error',
        'OpenRouter chat request failed validation.',
        {
          requestId,
          fields,
        },
      );
    }

    return createErrorResponse(
      400,
      'validation_error',
      'OpenRouter chat request failed validation.',
      { requestId },
    );
  }

  let service: OpenRouterService;
  try {
    service = getOpenRouterService();
  } catch (error) {
    console.error('Failed to initialise OpenRouterService:', error);
    return createErrorResponse(
      500,
      'openrouter_configuration_error',
      'OpenRouter service is not available.',
      { requestId },
    );
  }

  const {
    schema,
    timeout_ms: timeoutMs,
    idempotency_key: idempotencyKey,
    ...rest
  } = payload;

  const chatOptions = {
    ...rest,
    timeoutMs,
    idempotencyKey,
  };

  try {
    if (schema) {
      const { strict, ...definition } = schema;
      const result = await service.chatStructured({
        ...chatOptions,
        schema: {
          ...definition,
          strict: strict ?? true,
        },
      });

      return new Response(
        JSON.stringify({
          result,
        }),
        {
          status: 200,
          headers: JSON_HEADERS,
        },
      );
    }

    const result = await service.chat(chatOptions);

    return new Response(
      JSON.stringify({
        result,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    );
  } catch (error) {
    if (error instanceof OpenRouterServiceError) {
      return toServiceErrorResponse(error, requestId);
    }

    console.error('Unexpected error fulfilling OpenRouter chat request:', error);
    return createErrorResponse(
      500,
      'internal_server_error',
      'An unexpected error occurred while processing the OpenRouter request.',
      { requestId },
    );
  }
};

function toServiceErrorResponse(
  error: OpenRouterServiceError,
  requestId: string,
): Response {
  const { details } = error;
  const status = determineStatus(details);
  const errorCode = mapErrorCode(details.code);
  const body: ApiErrorBody = {
    ...buildErrorResponse(errorCode, details.message),
    request_id: requestId,
  };

  if (details.requestId) {
    body.provider_request_id = details.requestId;
  }

  const headers: Record<string, string> = { ...JSON_HEADERS };

  if (typeof details.retryAfterMs === 'number') {
    const retryAfterSeconds = Math.ceil(details.retryAfterMs / 1000);
    if (retryAfterSeconds > 0) {
      headers['Retry-After'] = retryAfterSeconds.toString();
      body.retry_after = retryAfterSeconds;
    }
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function determineStatus(details: ServiceError): number {
  if (details.status) {
    return details.status;
  }

  const fallback = STATUS_BY_CODE[details.code];
  return fallback ?? (details.code === 'UNKNOWN' ? 500 : 502);
}

const STATUS_BY_CODE: Partial<Record<ServiceError['code'], number>> =
  {
    INVALID_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    PRECONDITION_FAILED: 412,
    TOKEN_LIMIT: 400,
    RATE_LIMITED: 429,
    UNSUPPORTED_FEATURE: 400,
    SCHEMA_MISMATCH: 502,
    PARSE_ERROR: 502,
    SERVER_ERROR: 502,
    NETWORK_ERROR: 503,
    TIMEOUT: 504,
    ABORTED: 499,
  };

function mapErrorCode(code: ServiceError['code']): string {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'validation_error';
    case 'UNAUTHORIZED':
      return 'unauthorized';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'NOT_FOUND':
      return 'not_found';
    case 'CONFLICT':
      return 'conflict';
    case 'PRECONDITION_FAILED':
      return 'precondition_failed';
    case 'RATE_LIMITED':
      return 'rate_limit_exceeded';
    case 'SCHEMA_MISMATCH':
      return 'schema_mismatch';
    case 'UNSUPPORTED_FEATURE':
      return 'unsupported_feature';
    case 'TOKEN_LIMIT':
      return 'token_limit';
    case 'TIMEOUT':
      return 'timeout';
    case 'NETWORK_ERROR':
      return 'network_error';
    case 'SERVER_ERROR':
      return 'openrouter_error';
    case 'PARSE_ERROR':
      return 'parse_error';
    case 'ABORTED':
      return 'aborted';
    default:
      return 'openrouter_error';
  }
}

function createErrorResponse(
  status: number,
  error: string,
  message: string,
  options: { requestId: string; fields?: string[] },
): Response {
  const body: ApiErrorBody = {
    ...buildErrorResponse(error, message, options.fields),
    request_id: options.requestId,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}


