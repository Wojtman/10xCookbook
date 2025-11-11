/**
 * DTO (Data Transfer Object) and Command Model Types for 10xCookbook API
 * 
 * This file contains all TypeScript type definitions for API requests and responses.
 * All types are derived from the database schema to ensure type safety and consistency.
 * 
 * Generated based on:
 * - Database schema: src/db/database.types.ts
 * - API plan: .ai/api-plan.md
 */

import type { Tables, TablesInsert, TablesUpdate } from './db/database.types';

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next?: boolean;
  has_prev?: boolean;
}

/**
 * Standard error response format
 */
export interface ErrorResponseDTO {
  error: string;
  message: string;
  fields?: string[];
  timestamp?: string;
  request_id?: string;
}

// ============================================================================
// TAG TYPES
// ============================================================================

/**
 * Tag DTO - represents a single tag with all metadata
 * Direct mapping from tags table
 */
export type TagDTO = Tables<'tags'>;

// ============================================================================
// INGREDIENT TYPES
// ============================================================================

/**
 * Global ingredient catalog entry (read-only for users)
 * Direct mapping from ingredients table
 */
export type IngredientCatalogDTO = Tables<'ingredients'>;

/**
 * Recipe ingredient DTO - ingredient as it appears in a recipe
 * Based on recipe_ingredients table with internal fields omitted
 */
export type RecipeIngredientDTO = Omit<
  Tables<'recipe_ingredients'>,
  'recipe_id' | 'created_at' | 'updated_at'
>;

/**
 * Input for creating/updating recipe ingredients
 * Used in recipe creation/update commands
 */
export interface RecipeIngredientInput {
  display_order: number;
  name: string;
  quantity?: string | null;
  notes?: string | null;
  ingredient_id?: string | null; // Reference to global catalog
}

// ============================================================================
// COOKBOOK TYPES
// ============================================================================

/**
 * Cookbook DTO - single cookbook with computed recipe count
 * Based on cookbooks table with additional metadata
 */
export interface CookbookDTO extends Tables<'cookbooks'> {
  recipe_count: number;
}

/**
 * Cookbook list response
 */
export interface CookbookListResponseDTO {
  cookbooks: CookbookDTO[];
  total: number;
}

/**
 * Query parameters for listing cookbooks
 */
export interface CookbookListQueryParams {
  sort?: 'created_at' | 'updated_at' | 'title';
  order?: 'asc' | 'desc';
}

/**
 * Command to create a new cookbook
 * Based on TablesInsert with auto-generated fields omitted
 */
export type CreateCookbookCommand = Omit<
  TablesInsert<'cookbooks'>,
  'id' | 'created_at' | 'updated_at' | 'user_id'
>;

/**
 * Command to update an existing cookbook
 * Partial update supported - all fields optional except those being changed
 */
export type UpdateCookbookCommand = Partial<
  Omit<TablesUpdate<'cookbooks'>, 'id' | 'created_at' | 'updated_at' | 'user_id'>
>;

// ============================================================================
// RECIPE TYPES
// ============================================================================

/**
 * Recipe list item DTO - recipe as shown in list view
 * Based on recipes table with tags and computed ingredient count
 */
export interface RecipeListItemDTO extends Tables<'recipes'> {
  ingredient_count: number;
  tags: TagDTO[];
}

/**
 * Recipe detail DTO - full recipe with all ingredients and tags
 * Based on recipes table with full related data
 */
export interface RecipeDetailDTO extends Tables<'recipes'> {
  ingredients: RecipeIngredientDTO[];
  tags: TagDTO[];
}

/**
 * Recipe list response with pagination
 */
export interface RecipeListResponseDTO {
  recipes: RecipeListItemDTO[];
  pagination: PaginationDTO;
}

/**
 * Query parameters for listing recipes
 */
export interface RecipeListQueryParams {
  page?: number;
  limit?: number;
  sort?: 'display_order' | 'created_at' | 'updated_at' | 'title' | 'prep_time_minutes';
  order?: 'asc' | 'desc';
  tags?: string; // Comma-separated tag slugs
  search?: string; // Full-text search
  prep_time_min?: number;
  prep_time_max?: number;
}

/**
 * Command to create a new recipe
 * Based on TablesInsert with nested ingredients and tags
 */
export interface CreateRecipeCommand
  extends Omit<
    TablesInsert<'recipes'>,
    'id' | 'created_at' | 'updated_at'
  > {
  ingredients: RecipeIngredientInput[];
  tag_ids?: string[];
}

/**
 * Command to update an existing recipe
 * Partial update supported - all fields optional
 */
export interface UpdateRecipeCommand
  extends Partial<
    Omit<TablesUpdate<'recipes'>, 'id' | 'created_at' | 'updated_at'>
  > {
  ingredients?: RecipeIngredientInput[];
  tag_ids?: string[];
}

/**
 * Single recipe reorder item
 */
export interface RecipeReorderItem {
  id: string;
  display_order: number;
}

/**
 * Command to batch reorder recipes
 */
export interface ReorderRecipesCommand {
  recipes: RecipeReorderItem[];
}

/**
 * Response for reorder operation
 */
export interface ReorderRecipesResponseDTO {
  updated: number;
}

// ============================================================================
// AI PARSING TYPES
// ============================================================================

/**
 * Suggested ingredient from AI parsing
 * Structure matches RecipeIngredientInput for easy recipe creation
 */
export interface AISuggestedIngredient {
  display_order: number;
  name: string;
  quantity?: string;
  notes?: string;
}

/**
 * Command to request AI recipe parsing
 */
export interface AIParseCommand {
  raw_text: string;
  session_id?: string; // Required for anonymous users
}

/**
 * AI parsing response
 * Contains structured recipe data ready for creation
 */
export interface AIParseResponseDTO {
  title: string;
  preparation_description: string;
  prep_time_minutes?: number;
  ingredients: AISuggestedIngredient[];
  suggested_tags: string[]; // Array of tag slugs
  parsing_duration_ms: number;
}

// ============================================================================
// IMAGE UPLOAD TYPES
// ============================================================================

/**
 * Image upload response
 * Contains metadata about uploaded and processed image
 */
export interface ImageUploadResponseDTO {
  image_url: string;
  width: number;
  height: number;
  size_bytes: number;
  format: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Valid analytics event types
 * Matches event_type enum from API plan
 */
export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'recipe_parse_requested'
  | 'recipe_parse_success'
  | 'recipe_parse_timeout'
  | 'recipe_parse_error'
  | 'recipe_save'
  | 'recipe_edit'
  | 'recipe_delete'
  | 'registration_complete'
  | 'login_success';

/**
 * Command to log an analytics event
 * Based on TablesInsert with optional event_data
 */
export interface LogAnalyticsEventCommand {
  session_id: string;
  event_type: AnalyticsEventType;
  event_data?: Record<string, any>;
}

/**
 * Analytics event response
 */
export interface AnalyticsEventResponseDTO {
  event_id: string;
  created_at: string;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Anonymous session response
 */
export interface SessionResponseDTO {
  session_id: string;
  expires_at: string;
  message: string;
}

/**
 * Command to migrate anonymous recipes to authenticated account
 */
export interface MigrateRecipesCommand {
  session_id: string;
  target_cookbook_id?: string; // Optional - uses default if omitted
}

/**
 * Recipe migration response
 */
export interface MigrationResponseDTO {
  migrated_recipes: number;
  target_cookbook_id: string;
  message: string;
}

// ============================================================================
// INGREDIENT SEARCH TYPES (Future Enhancement)
// ============================================================================

/**
 * Query parameters for ingredient catalog search
 */
export interface IngredientSearchQueryParams {
  q: string; // Search query (min 2 characters)
  limit?: number; // Max results (default: 10, max: 50)
}

/**
 * Ingredient search response
 */
export interface IngredientSearchResponseDTO {
  ingredients: IngredientCatalogDTO[];
  total: number;
}

// ============================================================================
// AUTHENTICATION TYPES (Supabase Auth)
// ============================================================================

/**
 * User registration command
 * Supabase Auth handles this, but included for completeness
 */
export interface RegisterUserCommand {
  email: string;
  password: string;
}

/**
 * User login command
 */
export interface LoginUserCommand {
  email: string;
  password: string;
}

// ============================================================================
// TYPE GUARDS AND VALIDATORS
// ============================================================================

/**
 * Type guard to check if a value is a valid analytics event type
 */
export function isValidAnalyticsEventType(value: string): value is AnalyticsEventType {
  const validTypes: AnalyticsEventType[] = [
    'session_start',
    'session_end',
    'recipe_parse_requested',
    'recipe_parse_success',
    'recipe_parse_timeout',
    'recipe_parse_error',
    'recipe_save',
    'recipe_edit',
    'recipe_delete',
    'registration_complete',
    'login_success',
  ];
  return validTypes.includes(value as AnalyticsEventType);
}

/**
 * Type guard to check if an object is a valid CreateRecipeCommand
 */
export function isCreateRecipeCommand(obj: any): obj is CreateRecipeCommand {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.title === 'string' &&
    typeof obj.preparation_description === 'string' &&
    Array.isArray(obj.ingredients) &&
    obj.ingredients.every(
      (ing: any) =>
        typeof ing.name === 'string' &&
        typeof ing.display_order === 'number'
    )
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Validation constants from API plan
 */
export const VALIDATION_CONSTANTS = {
  RECIPE: {
    MAX_DESCRIPTION_LENGTH: 5000,
    MAX_INGREDIENTS: 50,
  },
  IMAGE: {
    MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
    MAX_DIMENSIONS: 1024,
    ALLOWED_FORMATS: ['png', 'jpeg', 'jpg', 'webp'] as const,
  },
  AI_PARSE: {
    MAX_TEXT_LENGTH: 50000,
    TIMEOUT_MS: 10000,
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  RATE_LIMITS: {
    AI_PARSE_PER_MINUTE: 10,
    IMAGE_UPLOAD_PER_HOUR: 20,
  },
} as const;

/**
 * Default sort orders for various list endpoints
 */
export const DEFAULT_SORT_ORDERS = {
  RECIPES: {
    sort: 'display_order' as const,
    order: 'asc' as const,
  },
  COOKBOOKS: {
    sort: 'created_at' as const,
    order: 'desc' as const,
  },
} as const;
