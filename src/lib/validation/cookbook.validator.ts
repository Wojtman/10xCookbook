import { z } from "zod";

/**
 * Validation schemas for cookbook API endpoints
 *
 * These schemas ensure input data integrity and provide clear validation errors
 * for all cookbook-related operations.
 */

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Schema for validating cookbook list query parameters
 * Supports sorting by created_at, updated_at, or title with asc/desc order
 */
export const CookbookListQuerySchema = z.object({
  sort: z.enum(["created_at", "updated_at", "title"]).optional().default("created_at"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CookbookListQueryInput = z.infer<typeof CookbookListQuerySchema>;

// ============================================================================
// COMMAND VALIDATION
// ============================================================================

/**
 * Schema for creating a new cookbook
 * - title: required, 1-100 characters, trimmed
 * - is_default: optional boolean, defaults to false
 */
export const CreateCookbookSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title must not exceed 100 characters"),
  is_default: z.boolean().optional().default(false),
});

export type CreateCookbookInput = z.infer<typeof CreateCookbookSchema>;

/**
 * Schema for updating an existing cookbook
 * - All fields are optional (partial update)
 * - At least one field must be provided
 * - title: if provided, must be 1-100 characters, trimmed
 * - is_default: optional boolean
 */
export const UpdateCookbookSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title must not be empty")
      .max(100, "Title must not exceed 100 characters")
      .optional(),
    is_default: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateCookbookInput = z.infer<typeof UpdateCookbookSchema>;

// ============================================================================
// PARAMETER VALIDATION
// ============================================================================

/**
 * Schema for validating UUID parameters (cookbook ID)
 * Ensures the ID is a valid UUID v4 format
 */
export const UUIDParamSchema = z.string().uuid({
  message: "Invalid cookbook ID format",
});

export type UUIDParam = z.infer<typeof UUIDParamSchema>;
