import { randomUUID } from 'node:crypto';

import type { APIRoute } from 'astro';
import { z } from 'zod';

import {
  uploadRecipeImage,
  ImageUploadValidationError,
  ImageUploadRateLimitError,
  ImageUploadProcessingError,
  ImageUploadStorageError,
  ImageUploadConfigurationError,
  ImageUploadRateLimitServiceError,
} from '../../../lib/services/imageUpload.service';
import { buildErrorResponse } from '../../../lib/utils/error-response';

const SessionIdSchema = z
  .string()
  .trim()
  .min(1, 'session_id cannot be empty')
  .max(128, 'session_id exceeds maximum length');

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = randomUUID();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error('Failed to parse multipart form data for image upload:', error);
    return createJsonResponse(
      buildErrorResponse(
        'invalid_multipart',
        'Request must be multipart/form-data with a valid image file.',
        ['file'],
      ),
      400,
    );
  }

  const filePart = formData.get('file');
  if (!filePart || typeof (filePart as File).arrayBuffer !== 'function') {
    return createJsonResponse(
      buildErrorResponse('file_missing', 'Image file is required.', ['file']),
      400,
    );
  }

  const rawSessionId = formData.get('session_id');
  const parsedSession = (() => {
    if (rawSessionId == null || rawSessionId === '') {
      return { success: true, data: null as string | null };
    }

    if (typeof rawSessionId !== 'string') {
      return {
        success: false as const,
        error: 'session_id must be a string value',
      };
    }

    const result = SessionIdSchema.safeParse(rawSessionId);
    if (!result.success) {
      return {
        success: false as const,
        error: result.error.errors[0]?.message ?? 'Invalid session_id value',
      };
    }

    return { success: true, data: result.data };
  })();

  if (!parsedSession.success) {
    return createJsonResponse(
      buildErrorResponse(
        'validation_error',
        parsedSession.error,
        ['session_id'],
      ),
      400,
    );
  }

  const {
    data: { user },
    error: authError,
  } = await locals.supabase.auth.getUser();

  if (authError) {
    console.error('Failed to retrieve Supabase user for image upload:', authError);

    const status = typeof authError.status === 'number' ? authError.status : 500;
    const errorCode = status === 401 ? 'unauthorized' : 'auth_error';

    return createJsonResponse(
      {
        ...buildErrorResponse(
          errorCode,
          status === 401
            ? 'Authentication required to perform this action.'
            : 'Unable to verify authentication status.',
        ),
        request_id: requestId,
      },
      status,
    );
  }

  if (!user && !parsedSession.data) {
    return createJsonResponse(
      buildErrorResponse(
        'validation_error',
        'session_id is required for anonymous uploads.',
        ['session_id'],
      ),
      400,
    );
  }

  const analyticsSessionId =
    parsedSession.data ?? user?.id ?? `req_${requestId}`;

  try {
    const uploadResult = await uploadRecipeImage({
      supabase: locals.supabase,
      file: filePart as File,
      identifiers: {
        userId: user?.id ?? null,
        sessionId: parsedSession.data,
      },
      analyticsSessionId,
    });

    return new Response(JSON.stringify(uploadResult), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return handleUploadError(error, requestId);
  }
};

function handleUploadError(error: unknown, requestId: string): Response {
  if (error instanceof ImageUploadValidationError) {
    return createJsonResponse(
      buildErrorResponse(error.code, error.message, error.fields),
      error.status,
    );
  }

  if (error instanceof ImageUploadRateLimitError) {
    return new Response(
      JSON.stringify({
        ...buildErrorResponse(error.code, error.message),
        retry_after: error.retryAfterSeconds,
      }),
      {
        status: error.status,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(error.retryAfterSeconds),
        },
      },
    );
  }

  if (
    error instanceof ImageUploadProcessingError ||
    error instanceof ImageUploadStorageError ||
    error instanceof ImageUploadConfigurationError ||
    error instanceof ImageUploadRateLimitServiceError
  ) {
    console.error('Image upload service failure:', error);
    return createJsonResponse(
      {
        ...buildErrorResponse(error.code, error.message),
        request_id: requestId,
      },
      500,
    );
  }

  console.error('Unexpected error during image upload:', error);
  return createJsonResponse(
    {
      ...buildErrorResponse(
        'internal_server_error',
        'An unexpected error occurred while uploading the image.',
      ),
      request_id: requestId,
    },
    500,
  );
}

function createJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

