import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  RecipeListItemDTO,
  RecipeDetailDTO,
  RecipeListResponseDTO,
  RecipeListQueryParams,
  CreateRecipeCommand,
  UpdateRecipeCommand,
  ReorderRecipesCommand,
  ReorderRecipesResponseDTO,
  PaginationDTO,
  TagDTO,
  RecipeIngredientDTO,
} from "../../types";

/**
 * Service class for managing recipe database operations
 *
 * Handles all CRUD operations for recipes with proper error handling,
 * authorization checks, and RLS (Row Level Security) enforcement through Supabase.
 */
export class RecipeService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Verify that a cookbook exists and belongs to the specified user
   *
   * @param cookbookId - The cookbook's UUID
   * @param userId - The authenticated user's ID
   * @returns true if cookbook exists and user owns it, false otherwise
   * @throws Error if database query fails
   */
  private async verifyCookbookOwnership(cookbookId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("cookbooks")
      .select("id")
      .eq("id", cookbookId)
      .eq("user_id", userId)
      .single();

    if (error) {
      // PGRST116 means no rows found
      if (error.code === "PGRST116") {
        return false;
      }
      throw new Error(`Failed to verify cookbook ownership: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Verify that a recipe exists and its parent cookbook belongs to the user
   *
   * @param recipeId - The recipe's UUID
   * @param userId - The authenticated user's ID
   * @returns The cookbook_id if recipe exists and user owns it, null otherwise
   * @throws Error if database query fails
   */
  private async verifyRecipeOwnership(recipeId: string, userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("recipes")
      .select("cookbook_id, cookbooks!inner(user_id)")
      .eq("id", recipeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to verify recipe ownership: ${error.message}`);
    }

    // Check if the cookbook's user_id matches the authenticated user
    const cookbook = data.cookbooks as any;
    if (cookbook.user_id !== userId) {
      return null;
    }

    return data.cookbook_id;
  }

  /**
   * Get the next display order for a new recipe in a cookbook
   *
   * @param cookbookId - The cookbook's UUID
   * @returns The next available display order (max + 1, or 0 if no recipes)
   */
  private async getNextDisplayOrder(cookbookId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("recipes")
      .select("display_order")
      .eq("cookbook_id", cookbookId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No recipes found - start at 0
      if (error.code === "PGRST116") {
        return 0;
      }
      throw new Error(`Failed to get next display order: ${error.message}`);
    }

    return (data?.display_order ?? -1) + 1;
  }

  /**
   * List recipes for a specific cookbook with pagination, filtering, and sorting
   *
   * @param cookbookId - The cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @param queryParams - Pagination, sorting, and filtering parameters
   * @returns Paginated list of recipes with metadata
   * @throws Error if database query fails or user doesn't own cookbook
   */
  async listRecipes(
    cookbookId: string,
    userId: string,
    queryParams: RecipeListQueryParams = {}
  ): Promise<RecipeListResponseDTO> {
    // Verify cookbook ownership
    const hasAccess = await this.verifyCookbookOwnership(cookbookId, userId);
    if (!hasAccess) {
      throw new Error("Recipes not found");
    }

    const {
      page = 1,
      limit = 20,
      sort = "display_order",
      order = "asc",
      tags,
      search,
      prep_time_min,
      prep_time_max,
    } = queryParams;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Build base query
    let query = this.supabase
      .from("recipes")
      .select(
        `
        *,
        recipe_ingredients(id),
        recipe_tags!inner(tag_id, tags(*))
      `,
        { count: "exact" }
      )
      .eq("cookbook_id", cookbookId);

    // Apply tag filtering if provided
    if (tags) {
      // Split comma-separated tags and trim
      const tagSlugs = tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (tagSlugs.length > 0) {
        // Get tag IDs from slugs
        const { data: tagData } = await this.supabase.from("tags").select("id").in("slug", tagSlugs);

        if (tagData && tagData.length > 0) {
          const tagIds = tagData.map((t) => t.id);

          // Get recipe IDs that have these tags
          const { data: recipeTagData } = await this.supabase
            .from("recipe_tags")
            .select("recipe_id")
            .in("tag_id", tagIds);

          if (recipeTagData && recipeTagData.length > 0) {
            const recipeIds = recipeTagData.map((rt) => rt.recipe_id);
            query = query.in("id", recipeIds);
          } else {
            // No recipes found with these tags - return empty result
            query = query.in("id", []);
          }
        } else {
          // Invalid tag slugs - return empty result
          query = query.in("id", []);
        }
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,preparation_description.ilike.%${search}%`);
    }

    // Apply prep time filters
    if (prep_time_min !== undefined) {
      query = query.gte("prep_time_minutes", prep_time_min);
    }
    if (prep_time_max !== undefined) {
      query = query.lte("prep_time_minutes", prep_time_max);
    }

    // Apply sorting
    query = query.order(sort, { ascending: order === "asc" });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list recipes: ${error.message}`);
    }

    // Transform data to match RecipeListItemDTO
    const recipes: RecipeListItemDTO[] = (data || []).map((recipe: any) => {
      // Extract unique tags
      const uniqueTags = new Map<string, TagDTO>();
      if (recipe.recipe_tags) {
        recipe.recipe_tags.forEach((rt: any) => {
          if (rt.tags) {
            uniqueTags.set(rt.tags.id, rt.tags as TagDTO);
          }
        });
      }

      return {
        id: recipe.id,
        cookbook_id: recipe.cookbook_id,
        title: recipe.title,
        preparation_description: recipe.preparation_description,
        image_url: recipe.image_url,
        image_alt_text: recipe.image_alt_text,
        prep_time_minutes: recipe.prep_time_minutes,
        display_order: recipe.display_order,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
        ingredient_count: recipe.recipe_ingredients?.length ?? 0,
        tags: Array.from(uniqueTags.values()),
      };
    });

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const pagination: PaginationDTO = {
      page,
      limit,
      total: totalCount,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };

    return {
      recipes,
      pagination,
    };
  }

  /**
   * Get a single recipe by ID with full details including ingredients and tags
   *
   * @param recipeId - The recipe's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @returns The recipe with full details, or null if not found
   * @throws Error if database query fails
   */
  async getRecipeById(recipeId: string, userId: string): Promise<RecipeDetailDTO | null> {
    // Verify recipe ownership
    const cookbookId = await this.verifyRecipeOwnership(recipeId, userId);
    if (!cookbookId) {
      return null;
    }

    // Fetch recipe
    const { data: recipe, error: recipeError } = await this.supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .single();

    if (recipeError) {
      if (recipeError.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get recipe: ${recipeError.message}`);
    }

    // Fetch ingredients
    const { data: ingredients, error: ingredientsError } = await this.supabase
      .from("recipe_ingredients")
      .select("id, display_order, name, quantity, notes, ingredient_id")
      .eq("recipe_id", recipeId)
      .order("display_order", { ascending: true });

    if (ingredientsError) {
      throw new Error(`Failed to get recipe ingredients: ${ingredientsError.message}`);
    }

    // Fetch tags
    const { data: recipeTags, error: tagsError } = await this.supabase
      .from("recipe_tags")
      .select("tags(*)")
      .eq("recipe_id", recipeId);

    if (tagsError) {
      throw new Error(`Failed to get recipe tags: ${tagsError.message}`);
    }

    const tags: TagDTO[] = (recipeTags || []).map((rt: any) => rt.tags as TagDTO).filter(Boolean);

    return {
      ...recipe,
      ingredients: ingredients as RecipeIngredientDTO[],
      tags,
    };
  }

  /**
   * Create a new recipe with ingredients and tags
   *
   * @param cookbookId - The parent cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @param command - Recipe creation data
   * @returns The created recipe with full details
   * @throws Error if validation fails or database operation fails
   */
  async createRecipe(cookbookId: string, userId: string, command: CreateRecipeCommand): Promise<RecipeDetailDTO> {
    // Verify cookbook ownership
    const hasAccess = await this.verifyCookbookOwnership(cookbookId, userId);
    if (!hasAccess) {
      throw new Error("Recipes not found");
    }

    // Validate tag_ids exist
    if (command.tag_ids && command.tag_ids.length > 0) {
      const { data: existingTags, error: tagError } = await this.supabase
        .from("tags")
        .select("id")
        .in("id", command.tag_ids);

      if (tagError) {
        throw new Error(`Failed to validate tags: ${tagError.message}`);
      }

      if (!existingTags || existingTags.length !== command.tag_ids.length) {
        throw new Error("One or more tag IDs are invalid");
      }
    }

    // Validate ingredient_ids exist (if any are provided)
    const ingredientIdsToValidate = command.ingredients
      .map((i) => i.ingredient_id)
      .filter((id): id is string => id !== null && id !== undefined);

    if (ingredientIdsToValidate.length > 0) {
      const { data: existingIngredients, error: ingredientError } = await this.supabase
        .from("ingredients")
        .select("id")
        .in("id", ingredientIdsToValidate);

      if (ingredientError) {
        throw new Error(`Failed to validate ingredients: ${ingredientError.message}`);
      }

      if (!existingIngredients || existingIngredients.length !== ingredientIdsToValidate.length) {
        throw new Error("One or more ingredient IDs are invalid");
      }
    }

    // Get next display order if not provided
    const displayOrder = command.display_order ?? (await this.getNextDisplayOrder(cookbookId));

    // Insert recipe
    const { data: recipe, error: recipeError } = await this.supabase
      .from("recipes")
      .insert({
        cookbook_id: cookbookId,
        title: command.title,
        preparation_description: command.preparation_description,
        image_url: command.image_url,
        image_alt_text: command.image_alt_text,
        prep_time_minutes: command.prep_time_minutes,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (recipeError) {
      throw new Error(`Failed to create recipe: ${recipeError.message}`);
    }

    // Insert ingredients
    const ingredientsToInsert = command.ingredients.map((ing) => ({
      recipe_id: recipe.id,
      display_order: ing.display_order,
      name: ing.name,
      quantity: ing.quantity ?? null,
      notes: ing.notes ?? null,
      ingredient_id: ing.ingredient_id ?? null,
    }));

    const { data: insertedIngredients, error: ingredientsError } = await this.supabase
      .from("recipe_ingredients")
      .insert(ingredientsToInsert)
      .select("id, display_order, name, quantity, notes, ingredient_id");

    if (ingredientsError) {
      // Rollback: delete the recipe
      await this.supabase.from("recipes").delete().eq("id", recipe.id);
      throw new Error(`Failed to create recipe ingredients: ${ingredientsError.message}`);
    }

    // Insert tags if provided
    let tags: TagDTO[] = [];
    if (command.tag_ids && command.tag_ids.length > 0) {
      const tagsToInsert = command.tag_ids.map((tagId) => ({
        recipe_id: recipe.id,
        tag_id: tagId,
      }));

      const { error: tagsError } = await this.supabase.from("recipe_tags").insert(tagsToInsert);

      if (tagsError) {
        // Rollback: delete the recipe (cascade will handle ingredients)
        await this.supabase.from("recipes").delete().eq("id", recipe.id);
        throw new Error(`Failed to create recipe tags: ${tagsError.message}`);
      }

      // Fetch the tag details
      const { data: tagData } = await this.supabase.from("tags").select("*").in("id", command.tag_ids);

      tags = (tagData || []) as TagDTO[];
    }

    return {
      ...recipe,
      ingredients: insertedIngredients as RecipeIngredientDTO[],
      tags,
    };
  }

  /**
   * Update an existing recipe (partial update)
   *
   * @param recipeId - The recipe's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @param command - Recipe update data (partial)
   * @returns The updated recipe with full details
   * @throws Error if validation fails or database operation fails
   */
  async updateRecipe(recipeId: string, userId: string, command: UpdateRecipeCommand): Promise<RecipeDetailDTO> {
    // Verify recipe ownership
    const cookbookId = await this.verifyRecipeOwnership(recipeId, userId);
    if (!cookbookId) {
      throw new Error("Recipe not found or access denied");
    }

    // Validate tag_ids exist (if provided)
    if (command.tag_ids && command.tag_ids.length > 0) {
      const { data: existingTags, error: tagError } = await this.supabase
        .from("tags")
        .select("id")
        .in("id", command.tag_ids);

      if (tagError) {
        throw new Error(`Failed to validate tags: ${tagError.message}`);
      }

      if (!existingTags || existingTags.length !== command.tag_ids.length) {
        throw new Error("One or more tag IDs are invalid");
      }
    }

    // Validate ingredient_ids exist (if ingredients are being updated)
    if (command.ingredients) {
      const ingredientIdsToValidate = command.ingredients
        .map((i) => i.ingredient_id)
        .filter((id): id is string => id !== null && id !== undefined);

      if (ingredientIdsToValidate.length > 0) {
        const { data: existingIngredients, error: ingredientError } = await this.supabase
          .from("ingredients")
          .select("id")
          .in("id", ingredientIdsToValidate);

        if (ingredientError) {
          throw new Error(`Failed to validate ingredients: ${ingredientError.message}`);
        }

        if (!existingIngredients || existingIngredients.length !== ingredientIdsToValidate.length) {
          throw new Error("One or more ingredient IDs are invalid");
        }
      }
    }

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (command.title !== undefined) updateData.title = command.title;
    if (command.preparation_description !== undefined)
      updateData.preparation_description = command.preparation_description;
    if (command.image_url !== undefined) updateData.image_url = command.image_url;
    if (command.image_alt_text !== undefined) updateData.image_alt_text = command.image_alt_text;
    if (command.prep_time_minutes !== undefined) updateData.prep_time_minutes = command.prep_time_minutes;
    if (command.display_order !== undefined) updateData.display_order = command.display_order;

    // Update recipe if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { error: recipeError } = await this.supabase.from("recipes").update(updateData).eq("id", recipeId);

      if (recipeError) {
        throw new Error(`Failed to update recipe: ${recipeError.message}`);
      }
    }

    // Update ingredients if provided (replace all)
    if (command.ingredients) {
      // Delete existing ingredients
      const { error: deleteError } = await this.supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);

      if (deleteError) {
        throw new Error(`Failed to delete existing ingredients: ${deleteError.message}`);
      }

      // Insert new ingredients
      const ingredientsToInsert = command.ingredients.map((ing) => ({
        recipe_id: recipeId,
        display_order: ing.display_order,
        name: ing.name,
        quantity: ing.quantity ?? null,
        notes: ing.notes ?? null,
        ingredient_id: ing.ingredient_id ?? null,
      }));

      const { error: ingredientsError } = await this.supabase.from("recipe_ingredients").insert(ingredientsToInsert);

      if (ingredientsError) {
        throw new Error(`Failed to update recipe ingredients: ${ingredientsError.message}`);
      }
    }

    // Update tags if provided (replace all)
    if (command.tag_ids !== undefined) {
      // Delete existing tags
      const { error: deleteTagsError } = await this.supabase.from("recipe_tags").delete().eq("recipe_id", recipeId);

      if (deleteTagsError) {
        throw new Error(`Failed to delete existing tags: ${deleteTagsError.message}`);
      }

      // Insert new tags if any provided
      if (command.tag_ids.length > 0) {
        const tagsToInsert = command.tag_ids.map((tagId) => ({
          recipe_id: recipeId,
          tag_id: tagId,
        }));

        const { error: tagsError } = await this.supabase.from("recipe_tags").insert(tagsToInsert);

        if (tagsError) {
          throw new Error(`Failed to update recipe tags: ${tagsError.message}`);
        }
      }
    }

    // Fetch and return updated recipe
    const updatedRecipe = await this.getRecipeById(recipeId, userId);
    if (!updatedRecipe) {
      throw new Error("Failed to fetch updated recipe");
    }

    return updatedRecipe;
  }

  /**
   * Delete a recipe and all associated data (ingredients, tags)
   *
   * @param recipeId - The recipe's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @throws Error if recipe not found or database operation fails
   */
  async deleteRecipe(recipeId: string, userId: string): Promise<void> {
    // Verify recipe ownership
    const cookbookId = await this.verifyRecipeOwnership(recipeId, userId);
    if (!cookbookId) {
      throw new Error("Recipe not found or access denied");
    }

    // Delete recipe (cascade will handle ingredients and tags)
    const { error } = await this.supabase.from("recipes").delete().eq("id", recipeId);

    if (error) {
      throw new Error(`Failed to delete recipe: ${error.message}`);
    }
  }

  /**
   * Batch update display order for multiple recipes
   *
   * @param cookbookId - The parent cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @param command - Reorder command with recipe IDs and new display orders
   * @returns Number of recipes updated
   * @throws Error if validation fails or database operation fails
   */
  async reorderRecipes(
    cookbookId: string,
    userId: string,
    command: ReorderRecipesCommand
  ): Promise<ReorderRecipesResponseDTO> {
    // Verify cookbook ownership
    const hasAccess = await this.verifyCookbookOwnership(cookbookId, userId);
    if (!hasAccess) {
      throw new Error("Recipes not found");
    }

    // Verify all recipe IDs belong to this cookbook
    const recipeIds = command.recipes.map((r) => r.id);
    const { data: recipes, error: recipesError } = await this.supabase
      .from("recipes")
      .select("id")
      .eq("cookbook_id", cookbookId)
      .in("id", recipeIds);

    if (recipesError) {
      throw new Error(`Failed to verify recipes: ${recipesError.message}`);
    }

    if (!recipes || recipes.length !== recipeIds.length) {
      throw new Error("One or more recipe IDs do not belong to this cookbook");
    }

    // Update each recipe's display order
    let updatedCount = 0;
    for (const recipe of command.recipes) {
      const { error } = await this.supabase
        .from("recipes")
        .update({ display_order: recipe.display_order })
        .eq("id", recipe.id);

      if (error) {
        throw new Error(`Failed to update recipe ${recipe.id}: ${error.message}`);
      }

      updatedCount++;
    }

    return {
      updated: updatedCount,
    };
  }
}
