import type { APIRoute } from 'astro';
import { ZodError } from 'zod';

import { getOpenRouterService } from '../../../lib/services/openrouter.factory';
import { OpenRouterServiceError } from '../../../lib/services/openrouter.service';
import {
  OpenRouterChatRequestSchema,
  type OpenRouterChatRequestInput,
} from '../../../lib/validation/openrouter.validator';
import { buildErrorResponse } from '../../../lib/utils/error-response';
import type { JsonSchemaResponseFormat, ServiceError } from '../../../lib/openrouter/types';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
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
    return jsonErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.', requestId);
  }

  let payload: OpenRouterChatRequestInput;
  try {
    payload = OpenRouterChatRequestSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = error.issues.map((issue) =>
        issue.path.join('.') || issue.message,
      );
      return jsonErrorResponse(
        400,
        'validation_error',
        'OpenRouter stream request failed validation.',
        requestId,
        fields,
      );
    }

    return jsonErrorResponse(
      400,
      'validation_error',
      'OpenRouter stream request failed validation.',
      requestId,
    );
  }

  let serviceInstance: ReturnType<typeof getOpenRouterService>;
  try {
    serviceInstance = getOpenRouterService();
  } catch (error) {
    console.error('Failed to initialise OpenRouterService for streaming:', error);
    return jsonErrorResponse(
      500,
      'openrouter_configuration_error',
      'OpenRouter service is not available.',
      requestId,
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

  const responseFormat: JsonSchemaResponseFormat | undefined = schema
    ? {
        type: 'json_schema',
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          strict: schema.strict ?? true,
        },
      }
    : undefined;

  let serviceAbort: AbortController | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      serviceAbort = new AbortController();

      const sendEvent = (data: unknown, event?: string) => {
        const lines: string[] = [];
        if (event) {
          lines.push(`event: ${event}`);
        }
        lines.push(`data: ${JSON.stringify(data)}`);
        lines.push('');
        controller.enqueue(encoder.encode(lines.join('\n')));
      };

      sendEvent({ type: 'meta', request_id: requestId });

      serviceInstance
        .streamChat(
          {
            ...chatOptions,
            responseFormat,
          },
          (delta) => {
            if (delta.type === 'error') {
              sendEvent(
                {
                  type: 'error',
                  content: delta.content,
                  request_id: requestId,
                },
                'error',
              );
              return;
            }

            sendEvent({
              type: delta.type,
              content: delta.content,
            });
          },
          serviceAbort.signal,
        )
        .then(() => {
          sendEvent('[DONE]');
          serviceAbort = null;
          controller.close();
        })
        .catch((error) => {
          if (error instanceof OpenRouterServiceError) {
            const body = mapStreamServiceError(error.details, requestId);
            sendEvent(body, 'error');
            serviceAbort = null;
            controller.close();
            return;
          }

          console.error('Unexpected OpenRouter streaming error:', error);
          sendEvent(
            buildErrorResponse(
              'internal_server_error',
              'An unexpected error occurred while streaming from OpenRouter.',
            ),
            'error',
          );
          serviceAbort = null;
          controller.close();
        });
    },
    cancel() {
      serviceAbort?.abort();
      serviceAbort = null;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: SSE_HEADERS,
  });
};

function jsonErrorResponse(
  status: number,
  error: string,
  message: string,
  requestId: string,
  fields?: string[],
): Response {
  const body: ApiErrorBody = {
    ...buildErrorResponse(error, message, fields),
    request_id: requestId,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function mapStreamServiceError(
  details: ServiceError,
  requestId: string,
): ApiErrorBody {
  const mappedCode = mapErrorCode(details.code);
  const body: ApiErrorBody = {
    ...buildErrorResponse(mappedCode, details.message),
    request_id: requestId,
  };

  if (details.requestId) {
    body.provider_request_id = details.requestId;
  }

  if (typeof details.retryAfterMs === 'number') {
    const retryAfterSeconds = Math.ceil(details.retryAfterMs / 1000);
    if (retryAfterSeconds > 0) {
      body.retry_after = retryAfterSeconds;
    }
  }

  return body;
}

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


