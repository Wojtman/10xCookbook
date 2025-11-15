import type { ErrorResponseDTO } from "../../types";

/**
 * Creates a standardized error response for API endpoints
 *
 * @param status - HTTP status code (400, 401, 404, 500, etc.)
 * @param error - Error code identifier (e.g., 'validation_error', 'not_found')
 * @param message - User-friendly error message
 * @param fields - Optional array of field names that caused validation errors
 * @returns Response object with proper JSON formatting and headers
 *
 * @example
 * ```typescript
 * createErrorResponse(400, 'validation_error', 'Invalid cookbook ID format', ['id'])
 * ```
 */
export function createErrorResponse(status: number, error: string, message: string, fields?: string[]): Response {
  const body: ErrorResponseDTO = {
    error,
    message,
    ...(fields && { fields }),
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a standardized internal server error response
 * Includes a request ID for debugging purposes
 *
 * @param requestId - Unique request identifier for tracking
 * @returns Response object with 500 status code
 */
export function createInternalErrorResponse(requestId: string): Response {
  const body: ErrorResponseDTO = {
    error: "internal_server_error",
    message: "An unexpected error occurred. Please try again later.",
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };

  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds an error response DTO object (without wrapping in Response)
 * Useful for building error bodies before creating Response objects
 *
 * @param error - Error code identifier
 * @param message - User-friendly error message
 * @param fields - Optional array of field names that caused errors
 * @returns ErrorResponseDTO object
 */
export function buildErrorResponse(error: string, message: string, fields?: string[]): ErrorResponseDTO {
  return {
    error,
    message,
    ...(fields && { fields }),
    timestamp: new Date().toISOString(),
  };
}
