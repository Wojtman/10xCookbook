import { z } from "zod";
import { isValidAnalyticsEventType } from "../../types";

/**
 * Validation schema and utilities for the analytics events endpoint.
 *
 * Ensures incoming payloads meet requirements for:
 * - session_id: required, trimmed string (1-255 characters)
 * - event_type: must be from the predefined AnalyticsEventType union
 * - event_data: optional JSON object with size cap (≤10 KB serialized)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_SESSION_ID_LENGTH = 1;
const MAX_SESSION_ID_LENGTH = 255;
const MAX_EVENT_DATA_SIZE_BYTES = 10 * 1024; // 10 KB

// ============================================================================
// SCHEMA
// ============================================================================

/**
 * Zod schema for validating analytics event requests.
 * - session_id: required, trimmed string, 1-255 characters
 * - event_type: required, must be valid AnalyticsEventType
 * - event_data: optional, must be plain object (not null, array, or primitive)
 * - Rejects unknown top-level fields via .strict()
 */
export const AnalyticsEventSchema = z
  .object({
    session_id: z
      .string({
        required_error: "session_id is required",
        invalid_type_error: "session_id must be a string",
      })
      .trim()
      .min(MIN_SESSION_ID_LENGTH, "session_id must not be empty")
      .max(MAX_SESSION_ID_LENGTH, `session_id must not exceed ${MAX_SESSION_ID_LENGTH} characters`),

    event_type: z
      .string({
        required_error: "event_type is required",
        invalid_type_error: "event_type must be a string",
      })
      .refine(isValidAnalyticsEventType, "event_type must be a valid analytics event type"),

    event_data: z
      .record(z.any())
      .optional()
      .refine((val) => val === undefined || typeof val === "object", "event_data must be a plain object or omitted"),
  })
  .strict()
  .transform((data) => ({
    ...data,
    session_id: data.session_id.trim(),
  }));

export type AnalyticsEventInput = z.infer<typeof AnalyticsEventSchema>;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validates that event_data payload does not exceed maximum serialized size.
 *
 * @param eventData - Optional event metadata object
 * @returns True if event_data is valid or undefined; false if exceeds size limit
 */
export function isEventDataWithinSizeLimit(eventData: Record<string, any> | undefined): boolean {
  if (!eventData) {
    return true;
  }

  try {
    const serialized = JSON.stringify(eventData);
    return serialized.length <= MAX_EVENT_DATA_SIZE_BYTES;
  } catch {
    // If serialization fails, consider it invalid
    return false;
  }
}

/**
 * Removes empty event_data objects to keep rows lightweight and storage costs predictable.
 * Returns null/undefined for completely empty objects, otherwise returns the cleaned object.
 *
 * @param eventData - Optional event metadata object
 * @returns Cleaned event_data (with empty arrays/objects removed) or null if all removed
 */
export function cleanEventData(eventData: Record<string, any> | undefined): Record<string, any> | null {
  if (!eventData) {
    return null;
  }

  // Recursively remove falsy or empty values
  const cleaned = Object.entries(eventData).reduce(
    (acc, [key, value]) => {
      // Skip null, undefined, empty strings, empty arrays, empty objects
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
      ) {
        return acc;
      }

      // Recursively clean nested objects
      if (typeof value === "object" && !Array.isArray(value)) {
        const nested = cleanEventData(value);
        if (nested !== null) {
          acc[key] = nested;
        }
      } else {
        acc[key] = value;
      }

      return acc;
    },
    {} as Record<string, any>
  );

  // Return null if result is empty after cleaning
  return Object.keys(cleaned).length === 0 ? null : cleaned;
}

/**
 * Validates the structure of event_data at insertion time.
 * Ensures all values are JSON-serializable and of expected types.
 *
 * @param eventData - Event metadata to validate
 * @returns True if valid for persistence; false otherwise
 */
export function isValidEventDataStructure(eventData: Record<string, any> | undefined | null): boolean {
  if (!eventData) {
    return true;
  }

  try {
    // Attempt serialization to ensure all values are JSON-compatible
    JSON.stringify(eventData);

    // Validate structure: no functions, symbols, or circular references
    const isValidValue = (value: any): boolean => {
      const type = typeof value;

      // Disallow functions and symbols
      if (type === "function" || type === "symbol") {
        return false;
      }

      // Allow primitives (string, number, boolean) and null
      if (value === null || type !== "object") {
        return type === "string" || type === "number" || type === "boolean";
      }

      // Recursively validate object/array values
      if (Array.isArray(value)) {
        return value.every(isValidValue);
      }

      return Object.values(value).every(isValidValue);
    };

    return isValidValue(eventData);
  } catch {
    return false;
  }
}

/**
 * Converts Zod validation errors to an array of field paths for error responses.
 *
 * @param errors - Zod error list
 * @returns Array of field path strings
 */
export function mapZodIssuesToFields(errors: z.ZodIssue[]): string[] {
  return errors.map((err) => err.path.join(".") || err.message);
}
