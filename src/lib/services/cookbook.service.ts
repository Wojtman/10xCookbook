import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  CookbookDTO,
  CookbookListResponseDTO,
  CookbookListQueryParams,
  CreateCookbookCommand,
  UpdateCookbookCommand,
} from "../../types";

/**
 * Service class for managing cookbook database operations
 *
 * Handles all CRUD operations for cookbooks with proper error handling
 * and RLS (Row Level Security) enforcement through Supabase.
 */
export class CookbookService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * List all cookbooks for a specific user with optional sorting
   *
   * @param userId - The authenticated user's ID
   * @param queryParams - Optional sorting parameters (sort field and order)
   * @returns List of cookbooks with recipe counts and total count
   * @throws Error if database query fails
   */
  async listCookbooks(userId: string, queryParams: CookbookListQueryParams = {}): Promise<CookbookListResponseDTO> {
    const { sort = "created_at", order = "desc" } = queryParams;

    // Query cookbooks with recipe count using a left join and aggregation
    const { data, error, count } = await this.supabase
      .from("cookbooks")
      .select(
        `
        *,
        recipes:recipes(count)
      `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order(sort, { ascending: order === "asc" });

    if (error) {
      throw new Error(`Failed to list cookbooks: ${error.message}`);
    }

    // Transform the data to include recipe_count as a number
    const cookbooks: CookbookDTO[] = (data || []).map((cookbook: any) => ({
      ...cookbook,
      recipe_count: cookbook.recipes?.[0]?.count ?? 0,
      recipes: undefined, // Remove the temporary recipes field
    })) as unknown as CookbookDTO[];

    return {
      cookbooks,
      total: count ?? 0,
    };
  }

  /**
   * Get a single cookbook by ID with recipe count
   *
   * @param cookbookId - The cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @returns The cookbook with recipe count, or null if not found
   * @throws Error if database query fails
   */
  async getCookbookById(cookbookId: string, userId: string): Promise<CookbookDTO | null> {
    const { data, error } = await this.supabase
      .from("cookbooks")
      .select(
        `
        *,
        recipes:recipes(count)
      `
      )
      .eq("id", cookbookId)
      .eq("user_id", userId)
      .single();

    if (error) {
      // Supabase returns PGRST116 for no rows found
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get cookbook: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Transform the data to include recipe_count as a number
    const cookbook: CookbookDTO = {
      ...data,
      recipe_count: data.recipes?.[0]?.count ?? 0,
      recipes: undefined, // Remove the temporary recipes field
    } as unknown as CookbookDTO;

    return cookbook;
  }

  /**
   * Create a new cookbook for a user
   *
   * @param userId - The authenticated user's ID
   * @param command - The cookbook data to create
   * @returns The newly created cookbook with recipe count (0 for new cookbooks)
   * @throws Error if database operation fails or constraints are violated
   */
  async createCookbook(userId: string, command: CreateCookbookCommand): Promise<CookbookDTO> {
    // Insert the new cookbook
    const { data, error } = await this.supabase
      .from("cookbooks")
      .insert({
        user_id: userId,
        title: command.title,
        is_default: command.is_default ?? false,
      })
      .select()
      .single();

    if (error) {
      // Check for constraint violations
      if (error.code === "23505") {
        // Unique constraint violation
        if (error.message.includes("title")) {
          throw new Error("DUPLICATE_TITLE");
        }
        if (error.message.includes("default")) {
          throw new Error("MULTIPLE_DEFAULTS");
        }
      }
      throw new Error(`Failed to create cookbook: ${error.message}`);
    }

    if (!data) {
      throw new Error("Failed to create cookbook: No data returned");
    }

    // New cookbooks always have 0 recipes
    return {
      ...data,
      recipe_count: 0,
    };
  }

  /**
   * Update an existing cookbook
   *
   * @param cookbookId - The cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @param command - The fields to update (partial update supported)
   * @returns The updated cookbook with recipe count, or null if not found
   * @throws Error if database operation fails or constraints are violated
   */
  async updateCookbook(
    cookbookId: string,
    userId: string,
    command: UpdateCookbookCommand
  ): Promise<CookbookDTO | null> {
    // Build the update object (only include provided fields)
    const updateData: Record<string, any> = {};
    if (command.title !== undefined) {
      updateData.title = command.title;
    }
    if (command.is_default !== undefined) {
      updateData.is_default = command.is_default;
    }

    // Perform the update
    const { data, error } = await this.supabase
      .from("cookbooks")
      .update(updateData)
      .eq("id", cookbookId)
      .eq("user_id", userId)
      .select(
        `
        *,
        recipes:recipes(count)
      `
      )
      .single();

    if (error) {
      // Check for constraint violations
      if (error.code === "23505") {
        if (error.message.includes("title")) {
          throw new Error("DUPLICATE_TITLE");
        }
        if (error.message.includes("default")) {
          throw new Error("MULTIPLE_DEFAULTS");
        }
      }
      // No rows affected (not found or unauthorized)
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to update cookbook: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Transform the data to include recipe_count as a number
    const cookbook: CookbookDTO = {
      ...data,
      recipe_count: data.recipes?.[0]?.count ?? 0,
      recipes: undefined, // Remove the temporary recipes field
    } as unknown as CookbookDTO;

    return cookbook;
  }

  /**
   * Delete a cookbook and all its recipes (cascade)
   *
   * @param cookbookId - The cookbook's UUID
   * @param userId - The authenticated user's ID (for authorization)
   * @returns true if deleted, false if not found or unauthorized
   * @throws Error if database operation fails
   */
  async deleteCookbook(cookbookId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("cookbooks")
      .delete()
      .eq("id", cookbookId)
      .eq("user_id", userId)
      .select("id");

    if (error) {
      throw new Error(`Failed to delete cookbook: ${error.message}`);
    }

    // If no rows were deleted, the cookbook wasn't found or user lacks access
    return (data?.length ?? 0) > 0;
  }
}
