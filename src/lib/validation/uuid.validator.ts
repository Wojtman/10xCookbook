/**
 * UUID format validation utilities
 * 
 * Validates UUID v4 format used for resource IDs throughout the application
 */

/**
 * Validates whether a string matches the UUID v4 format
 * UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where y is one of: 8, 9, A, B
 * 
 * @param value - String to validate as UUID
 * @returns true if the value is a valid UUID v4, false otherwise
 * 
 * @example
 * ```typescript
 * isValidUUID('a1b2c3d4-e5f6-4890-a1b2-c3d4e5f6a1b2') // true
 * isValidUUID('invalid-uuid') // false
 * isValidUUID('a1b2c3d4-e5f6-7890-a1b2-c3d4e5f6a1b2') // false (not v4)
 * ```
 */
export function isValidUUID(value: string): boolean {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(value);
}

/**
 * Validates whether a string matches any UUID format (v1, v4, etc.)
 * Use this if you need more lenient validation
 * 
 * @param value - String to validate as UUID
 * @returns true if the value is a valid UUID in any version, false otherwise
 */
export function isValidUUIDAny(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
