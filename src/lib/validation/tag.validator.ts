import { z } from 'zod';

/**
 * Utilities for validating and working with tag identifiers exposed via the public API.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zod schema ensuring a tag identifier is present and sanitized.
 * Allows UUIDs or human-readable slugs which are validated downstream.
 */
export const TagIdentifierSchema = z
  .string({
    required_error: 'id is required',
    invalid_type_error: 'id must be a string',
  })
  .trim()
  .min(1, 'id must not be empty');

export type TagIdentifierInput = z.infer<typeof TagIdentifierSchema>;

/**
 * Checks if the provided identifier matches the UUID v4 format expected by Supabase rows.
 *
 * @param identifier - Tag identifier supplied by the client
 * @returns True if the identifier is a well-formed UUID, false otherwise
 */
export function isUuid(identifier: string): boolean {
  return UUID_REGEX.test(identifier);
}


