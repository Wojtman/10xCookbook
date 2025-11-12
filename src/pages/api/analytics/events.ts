import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import {
  AnalyticsEventSchema,
  isEventDataWithinSizeLimit,
  isValidEventDataStructure,
  cleanEventData,
  mapZodIssuesToFields,
} from '../../../lib/validation/analytics.validator';
import {
  logAnalyticsEvent,
  AnalyticsServiceError,
} from '../../../lib/services/analytics.service';
import {
  createErrorResponse,
  createInternalErrorResponse,
} from '../../../lib/utils/error-response';

export const prerender = false;

/**
 * POST /analytics/events
 *
 * Accepts analytics events from both anonymous sessions and authenticated users.
 * Validates session_id and event_type before inserting into Supabase analytics_events table.
 *
 * @returns 201 Created with AnalyticsEventResponseDTO on success
 * @returns 400 Bad Request for validation errors
 * @returns 401 Unauthorized for authentication failures
 * @returns 500 Internal Server Error for service failures
 */
/**
 * Structured logger for analytics events with namespace and context
 */
const logger = {
  info: (message: string, context?: Record<string, any>) => {
    console.log(`[Analytics#POST] ${message}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: Record<string, any>) => {
    console.warn(`[Analytics#POST] ${message}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    const errorInfo = {
      ...(error && {
        error_type: error.name,
        error_message: error.message,
        error_cause: error.cause?.message,
      }),
      ...context,
    };
    console.error(`[Analytics#POST] ${message}`, JSON.stringify(errorInfo));
  },
};

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Structured context for logging throughout the request lifecycle
  const logContext = {
    request_id: requestId,
    method: 'POST',
    path: '/analytics/events',
  };

  // =========================================================================
  // 1. PARSE REQUEST BODY
  // =========================================================================

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.error('JSON parsing failed', error, { ...logContext, reason: 'invalid_json' });
    return createErrorResponse(
      400,
      'validation_error',
      'Invalid JSON in request body',
    );
  }

  // =========================================================================
  // 2. VALIDATE REQUEST PAYLOAD
  // =========================================================================

  let validatedData;
  try {
    validatedData = AnalyticsEventSchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      const fields = mapZodIssuesToFields(error.errors);
      logger.error('Schema validation failed', error, {
        ...logContext,
        fields,
        error_count: error.errors.length,
      });
      return createErrorResponse(
        400,
        'validation_error',
        'Request body failed validation',
        fields,
      );
    }
    throw error;
  }

  // =========================================================================
  // 3. VALIDATE EVENT_DATA STRUCTURE
  // =========================================================================

  if (!isValidEventDataStructure(validatedData.event_data)) {
    logger.error('Event data structure validation failed', null, {
      ...logContext,
      reason: 'non_serializable_types',
    });
    return createErrorResponse(
      400,
      'validation_error',
      'event_data contains invalid values (non-serializable types like functions)',
      ['event_data'],
    );
  }

  // =========================================================================
  // 4. CLEAN EVENT_DATA & CHECK SIZE LIMIT
  // =========================================================================

  const cleanedEventData = cleanEventData(validatedData.event_data);

  if (!isEventDataWithinSizeLimit(cleanedEventData ?? undefined)) {
    logger.error('Event data exceeds size limit', null, {
      ...logContext,
      reason: 'payload_too_large',
      event_data_size: JSON.stringify(cleanedEventData).length,
    });
    return createErrorResponse(
      400,
      'validation_error',
      'event_data payload exceeds maximum size (10 KB)',
      ['event_data'],
    );
  }

  // Update validated data with cleaned event_data
  validatedData.event_data = cleanedEventData ?? undefined;

  // =========================================================================
  // 5. GET AUTHENTICATED USER (IF AVAILABLE)
  // =========================================================================

  let userId: string | null = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await locals.supabase.auth.getUser();

    if (userError) {
      // Log the error but continue as anonymous flow
      logger.warn('Failed to retrieve authenticated user (continuing as anonymous)', {
        ...logContext,
        error_type: userError.name,
      });
    } else if (user) {
      logger.info('User authenticated', {
        ...logContext,
        user_id: user.id,
      });
      userId = user.id;
    }
  } catch (error) {
    logger.warn('Unexpected error during user retrieval (continuing as anonymous)', error, logContext);
    // Continue as anonymous - not critical to fail the entire request
  }

  // =========================================================================
  // 6. LOG ANALYTICS EVENT
  // =========================================================================

  try {
    const result = await logAnalyticsEvent({
      supabase: locals.supabase,
      userId,
      command: validatedData,
    });

    const processingTime = Date.now() - startTime;
    logger.info('Event logged successfully', {
      ...logContext,
      event_id: result.event_id,
      session_id: validatedData.session_id,
      event_type: validatedData.event_type,
      user_id: userId,
      has_event_data: !!cleanedEventData,
      event_data_size: cleanedEventData ? JSON.stringify(cleanedEventData).length : 0,
      processing_time_ms: processingTime,
      status: 'success',
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      const processingTime = Date.now() - startTime;
      logger.error('Service error during event logging', error, {
        ...logContext,
        session_id: validatedData.session_id,
        event_type: validatedData.event_type,
        processing_time_ms: processingTime,
        error_category: 'service_error',
      });
      return createInternalErrorResponse(requestId);
    }

    const processingTime = Date.now() - startTime;
    logger.error('Unexpected error during event logging', error, {
      ...logContext,
      session_id: validatedData.session_id,
      event_type: validatedData.event_type,
      processing_time_ms: processingTime,
      error_category: 'unexpected_error',
    });
    return createInternalErrorResponse(requestId);
  }
};

