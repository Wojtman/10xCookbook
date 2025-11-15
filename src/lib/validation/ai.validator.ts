import { z } from "zod";
import { VALIDATION_CONSTANTS } from "../../types";

/**
 * Validation schema and sanitization utilities for the AI parse recipe endpoint.
 *
 * Ensures incoming payloads meet size and shape constraints before invoking the
 * AI parsing pipeline and provides helpers to defensively sanitize untrusted
 * recipe text submitted by users or anonymous sessions.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SESSION_ID_LENGTH = 255;

// Patterns for stripping common system metadata that could leak provider config
// or be used for prompt injection attempts.
const STRIP_LINE_PATTERNS = [
  /^system\s*:/i,
  /^assistant\s*:/i,
  /^user\s*:/i,
  /^model\s*:/i,
  /^openrouter\s*:/i,
] as const;

// ============================================================================
// SCHEMA
// ============================================================================

/**
 * Zod schema for validating AI parse requests.
 * - raw_text: required, trimmed, must be within configured length limits.
 * - session_id: optional, trimmed, required for anonymous callers (enforced in handler).
 * - Rejects any unknown keys to guard against payload pollution.
 */
export const AIParseRequestSchema = z
  .object({
    raw_text: z
      .string({
        required_error: "raw_text is required",
        invalid_type_error: "raw_text must be a string",
      })
      .trim()
      .min(1, "raw_text must not be empty")
      .max(
        VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH,
        `raw_text must not exceed ${VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH} characters`
      ),

    session_id: z
      .string({
        invalid_type_error: "session_id must be a string",
      })
      .trim()
      .min(1, "session_id must not be empty")
      .max(MAX_SESSION_ID_LENGTH, `session_id must not exceed ${MAX_SESSION_ID_LENGTH} characters`)
      .optional(),
  })
  .strict();

export type AIParseRequestInput = z.infer<typeof AIParseRequestSchema>;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sanitizes raw recipe text by removing high-risk metadata headers that could
 * leak system prompts or influence downstream AI requests.
 *
 * @param rawText - Untrusted raw recipe text from the client
 * @returns Sanitized recipe text safe for AI provider forwarding
 */
export function sanitizeRawText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !STRIP_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
}
