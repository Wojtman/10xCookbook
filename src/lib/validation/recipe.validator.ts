import { z } from 'zod';
import { VALIDATION_CONSTANTS } from '../../types';

/**
 * Validation schemas for recipe API endpoints
 * 
 * These schemas ensure input data integrity and provide clear validation errors
 * for all recipe-related operations.
 */

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Schema for validating recipe list query parameters
 * Supports pagination, sorting, tag filtering, search, and prep time filtering
 */
export const RecipeListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .optional()
    .default(VALIDATION_CONSTANTS.PAGINATION.DEFAULT_PAGE),
  
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(VALIDATION_CONSTANTS.PAGINATION.MAX_LIMIT, `Limit must not exceed ${VALIDATION_CONSTANTS.PAGINATION.MAX_LIMIT}`)
    .optional()
    .default(VALIDATION_CONSTANTS.PAGINATION.DEFAULT_LIMIT),
  
  sort: z.enum(['display_order', 'created_at', 'updated_at', 'title', 'prep_time_minutes'])
    .optional()
    .default('display_order'),
  
  order: z.enum(['asc', 'desc'])
    .optional()
    .default('asc'),
  
  tags: z.string()
    .optional(),
  
  search: z.string()
    .trim()
    .min(1, 'Search query must not be empty')
    .optional(),
  
  prep_time_min: z.coerce
    .number()
    .int()
    .min(0, 'Minimum prep time must be non-negative')
    .optional(),
  
  prep_time_max: z.coerce
    .number()
    .int()
    .min(0, 'Maximum prep time must be non-negative')
    .optional(),
}).refine(
  (data) => {
    if (data.prep_time_min !== undefined && data.prep_time_max !== undefined) {
      return data.prep_time_min <= data.prep_time_max;
    }
    return true;
  },
  {
    message: 'Minimum prep time must not exceed maximum prep time',
    path: ['prep_time_min'],
  }
);

export type RecipeListQueryInput = z.infer<typeof RecipeListQuerySchema>;

// ============================================================================
// INGREDIENT VALIDATION
// ============================================================================

/**
 * Schema for validating recipe ingredient input
 * Used in both create and update recipe commands
 */
export const RecipeIngredientInputSchema = z.object({
  display_order: z.number()
    .int()
    .min(0, 'Display order must be non-negative'),
  
  name: z.string()
    .trim()
    .min(1, 'Ingredient name is required')
    .max(200, 'Ingredient name must not exceed 200 characters'),
  
  quantity: z.string()
    .trim()
    .max(100, 'Quantity must not exceed 100 characters')
    .nullable()
    .optional(),
  
  notes: z.string()
    .trim()
    .max(500, 'Ingredient notes must not exceed 500 characters')
    .nullable()
    .optional(),
  
  ingredient_id: z.string()
    .uuid('Invalid ingredient ID format')
    .nullable()
    .optional(),
});

export type RecipeIngredientInputData = z.infer<typeof RecipeIngredientInputSchema>;

// ============================================================================
// COMMAND VALIDATION
// ============================================================================

/**
 * Schema for creating a new recipe
 * - cookbook_id: required UUID (validated separately as path param)
 * - title: required, trimmed, non-empty
 * - preparation_description: optional, max 5000 characters
 * - image_url: optional URL
 * - image_alt_text: optional, max 500 characters
 * - prep_time_minutes: optional, positive integer
 * - display_order: optional, non-negative integer (auto-assigned if omitted)
 * - ingredients: required array, max 50 items
 * - tag_ids: optional array of UUIDs
 */
export const CreateRecipeSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters'),
  
  preparation_description: z.string()
    .trim()
    .max(VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH, `Preparation description must not exceed ${VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH} characters`)
    .optional()
    .default(''),
  
  image_url: z.string()
    .url('Invalid image URL format')
    .nullable()
    .optional(),
  
  image_alt_text: z.string()
    .trim()
    .max(500, 'Image alt text must not exceed 500 characters')
    .nullable()
    .optional(),
  
  prep_time_minutes: z.number()
    .int()
    .min(1, 'Prep time must be at least 1 minute')
    .max(10000, 'Prep time must not exceed 10000 minutes')
    .nullable()
    .optional(),
  
  display_order: z.number()
    .int()
    .min(0, 'Display order must be non-negative')
    .optional(),
  
  ingredients: z.array(RecipeIngredientInputSchema)
    .min(1, 'At least one ingredient is required')
    .max(VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS, `Recipe must not exceed ${VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS} ingredients`),
  
  tag_ids: z.array(z.string().uuid('Invalid tag ID format'))
    .optional()
    .default([]),
}).refine(
  (data) => {
    // Ensure ingredient display_order values are unique
    const orders = data.ingredients.map(i => i.display_order);
    const uniqueOrders = new Set(orders);
    return orders.length === uniqueOrders.size;
  },
  {
    message: 'Ingredient display orders must be unique',
    path: ['ingredients'],
  }
);

export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>;

/**
 * Schema for updating an existing recipe
 * - All fields are optional (partial update)
 * - If ingredients are provided, they replace all existing ingredients
 * - If tag_ids are provided, they replace all existing tags
 * - At least one field must be provided
 */
export const UpdateRecipeSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title must not be empty')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  
  preparation_description: z.string()
    .trim()
    .max(VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH, `Preparation description must not exceed ${VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH} characters`)
    .optional(),
  
  image_url: z.string()
    .url('Invalid image URL format')
    .nullable()
    .optional(),
  
  image_alt_text: z.string()
    .trim()
    .max(500, 'Image alt text must not exceed 500 characters')
    .nullable()
    .optional(),
  
  prep_time_minutes: z.number()
    .int()
    .min(1, 'Prep time must be at least 1 minute')
    .max(10000, 'Prep time must not exceed 10000 minutes')
    .nullable()
    .optional(),
  
  display_order: z.number()
    .int()
    .min(0, 'Display order must be non-negative')
    .optional(),
  
  ingredients: z.array(RecipeIngredientInputSchema)
    .min(1, 'At least one ingredient is required if ingredients are being updated')
    .max(VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS, `Recipe must not exceed ${VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS} ingredients`)
    .optional(),
  
  tag_ids: z.array(z.string().uuid('Invalid tag ID format'))
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
).refine(
  (data) => {
    // Ensure ingredient display_order values are unique if ingredients are provided
    if (data.ingredients) {
      const orders = data.ingredients.map(i => i.display_order);
      const uniqueOrders = new Set(orders);
      return orders.length === uniqueOrders.size;
    }
    return true;
  },
  {
    message: 'Ingredient display orders must be unique',
    path: ['ingredients'],
  }
);

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeSchema>;

// ============================================================================
// REORDER VALIDATION
// ============================================================================

/**
 * Schema for a single recipe reorder item
 */
export const RecipeReorderItemSchema = z.object({
  id: z.string().uuid('Invalid recipe ID format'),
  display_order: z.number()
    .int()
    .min(0, 'Display order must be non-negative'),
});

export type RecipeReorderItemData = z.infer<typeof RecipeReorderItemSchema>;

/**
 * Schema for batch reordering recipes
 * - recipes: required array of recipe reorder items
 * - All recipe IDs must be unique
 */
export const ReorderRecipesSchema = z.object({
  recipes: z.array(RecipeReorderItemSchema)
    .min(1, 'At least one recipe must be provided for reordering'),
}).refine(
  (data) => {
    // Ensure recipe IDs are unique
    const ids = data.recipes.map(r => r.id);
    const uniqueIds = new Set(ids);
    return ids.length === uniqueIds.size;
  },
  {
    message: 'Recipe IDs must be unique',
    path: ['recipes'],
  }
);

export type ReorderRecipesInput = z.infer<typeof ReorderRecipesSchema>;

// ============================================================================
// PARAMETER VALIDATION
// ============================================================================

/**
 * Schema for validating UUID parameters (recipe ID, cookbook ID)
 * Ensures the ID is a valid UUID v4 format
 */
export const UUIDParamSchema = z.string().uuid({
  message: 'Invalid ID format',
});

export type UUIDParam = z.infer<typeof UUIDParamSchema>;
