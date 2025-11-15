/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RecipeService } from "../lib/services/recipe.service";
import type { Database } from "../db/database.types";
import type { CreateRecipeCommand, RecipeIngredientDTO, TagDTO } from "../types";

interface QueryResponse<T = unknown> {
  data?: T;
  error?: unknown;
  count?: number;
}

interface SupabaseMock {
  from: ReturnType<typeof vi.fn>;
}

function attachPromiseLike<T>(target: Record<string, any>, value: T) {
  target.then = (resolve: (v: T) => any, reject?: (reason: unknown) => any) =>
    Promise.resolve(value).then(resolve, reject);
  target.catch = (reject: (reason: unknown) => any) => Promise.resolve(value).catch(reject);
  target.finally = (cb: () => any) => Promise.resolve(value).finally(cb);
}

function createAwaitableBuilder<T>({ data, error, count }: QueryResponse<T>): Record<string, any> {
  const response = { data, error, count };
  const builder: Record<string, any> = {};

  const chain = () => builder;
  builder.select = vi.fn().mockImplementation(chain);
  builder.eq = vi.fn().mockImplementation(chain);
  builder.order = vi.fn().mockImplementation(chain);
  builder.limit = vi.fn().mockImplementation(chain);
  builder.range = vi.fn().mockImplementation(chain);
  builder.or = vi.fn().mockImplementation(chain);
  builder.gte = vi.fn().mockImplementation(chain);
  builder.lte = vi.fn().mockImplementation(chain);
  builder.in = vi.fn().mockImplementation(chain);
  builder.single = vi.fn().mockResolvedValue({ data, error });
  builder.insert = vi.fn();
  builder.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  builder.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  attachPromiseLike(builder, response);
  return builder;
}

describe("RecipeService", () => {
  let supabase: SupabaseMock;
  let service: RecipeService;

  beforeEach(() => {
    supabase = {
      from: vi.fn(),
    };
    service = new RecipeService(supabase as unknown as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when listing recipes without cookbook access", async () => {
    vi.spyOn(service as any, "verifyCookbookOwnership").mockResolvedValue(false);

    await expect(service.listRecipes("cookbook-1", "user-1", {})).rejects.toThrow(
      "Cookbook not found or access denied"
    );

    expect(supabase.from).not.toHaveBeenCalledWith("recipes");
  });

  it("creates a recipe with ingredients and tags, applying fallback display order", async () => {
    vi.spyOn(service as any, "verifyCookbookOwnership").mockResolvedValue(true);
    vi.spyOn(service as any, "getNextDisplayOrder").mockResolvedValue(7);

    const command: CreateRecipeCommand = {
      cookbook_id: "cookbook-1",
      title: "Test Recipe",
      preparation_description: "Mix everything.",
      image_url: "https://example.com/image.jpg",
      image_alt_text: "Example",
      prep_time_minutes: 45,
      ingredients: [
        {
          display_order: 0,
          name: "Salt",
        },
        {
          display_order: 1,
          name: "Pepper",
          quantity: "1 tsp",
          notes: "Freshly ground",
          ingredient_id: "ingredient-2",
        },
      ],
      tag_ids: ["tag-1", "tag-2"],
    };

    const insertedRecipe: Database["public"]["Tables"]["recipes"]["Row"] = {
      id: "recipe-123",
      cookbook_id: "cookbook-1",
      title: command.title,
      preparation_description: command.preparation_description,
      image_url: command.image_url ?? null,
      image_alt_text: command.image_alt_text ?? null,
      prep_time_minutes: command.prep_time_minutes ?? null,
      display_order: 7,
      created_at: "now",
      updated_at: "now",
    };

    const insertedIngredients: RecipeIngredientDTO[] = [
      {
        id: "ing-1",
        display_order: 0,
        name: "Salt",
        quantity: null,
        notes: null,
        ingredient_id: null,
      },
      {
        id: "ing-2",
        display_order: 1,
        name: "Pepper",
        quantity: "1 tsp",
        notes: "Freshly ground",
        ingredient_id: "ingredient-2",
      },
    ];

    const fullTags: TagDTO[] = [
      {
        id: "tag-1",
        label: "Spicy",
        slug: "spicy",
        description: null,
        icon: null,
        created_at: "now",
        updated_at: "now",
      },
      {
        id: "tag-2",
        label: "Quick",
        slug: "quick",
        description: null,
        icon: null,
        created_at: "now",
        updated_at: "now",
      },
    ];

    const tagsValidationBuilder = createAwaitableBuilder({
      data: command.tag_ids?.map((id) => ({ id })) ?? [],
    });

    const tagsFetchBuilder = createAwaitableBuilder({
      data: fullTags,
    });

    const ingredientsValidationBuilder = createAwaitableBuilder({
      data: command.ingredients
        .map((ingredient) => ingredient.ingredient_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id })),
    });

    const recipesBuilder = createAwaitableBuilder({ data: null });
    const recipesInsertSingle = vi.fn().mockResolvedValue({ data: insertedRecipe, error: null });
    recipesBuilder.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: recipesInsertSingle,
      }),
    });

    const recipeIngredientsBuilder = createAwaitableBuilder({ data: null });
    const ingredientsSelect = vi.fn().mockResolvedValue({ data: insertedIngredients, error: null });
    recipeIngredientsBuilder.insert = vi.fn().mockReturnValue({
      select: ingredientsSelect,
    });

    const recipeTagsBuilder = createAwaitableBuilder({ data: null });
    recipeTagsBuilder.insert = vi.fn().mockResolvedValue({ error: null });

    let tagSelectCount = 0;
    supabase.from.mockImplementation((table: string) => {
      switch (table) {
        case "tags":
          tagSelectCount += 1;
          return tagSelectCount === 1 ? tagsValidationBuilder : tagsFetchBuilder;
        case "ingredients":
          return ingredientsValidationBuilder;
        case "recipes":
          return recipesBuilder;
        case "recipe_ingredients":
          return recipeIngredientsBuilder;
        case "recipe_tags":
          return recipeTagsBuilder;
        default:
          throw new Error(`Unexpected table request: ${table}`);
      }
    });

    const result = await service.createRecipe("cookbook-1", "user-1", command);

    expect(result).toEqual({
      ...insertedRecipe,
      ingredients: insertedIngredients,
      tags: fullTags,
    });

    expect(recipesBuilder.insert).toHaveBeenCalledWith({
      cookbook_id: "cookbook-1",
      title: command.title,
      preparation_description: command.preparation_description,
      image_url: command.image_url,
      image_alt_text: command.image_alt_text,
      prep_time_minutes: command.prep_time_minutes,
      display_order: 7,
    });

    expect(recipeIngredientsBuilder.insert).toHaveBeenCalledWith([
      {
        recipe_id: insertedRecipe.id,
        display_order: 0,
        name: "Salt",
        quantity: null,
        notes: null,
        ingredient_id: null,
      },
      {
        recipe_id: insertedRecipe.id,
        display_order: 1,
        name: "Pepper",
        quantity: "1 tsp",
        notes: "Freshly ground",
        ingredient_id: "ingredient-2",
      },
    ]);

    expect(recipeTagsBuilder.insert).toHaveBeenCalledWith([
      { recipe_id: insertedRecipe.id, tag_id: "tag-1" },
      { recipe_id: insertedRecipe.id, tag_id: "tag-2" },
    ]);

    expect(tagsFetchBuilder.select).toHaveBeenCalledWith("*");
    expect(tagsFetchBuilder.in).toHaveBeenCalledWith("id", command.tag_ids);
  });

  it("rejects recipe creation when tag validation fails", async () => {
    vi.spyOn(service as any, "verifyCookbookOwnership").mockResolvedValue(true);

    const command: CreateRecipeCommand = {
      cookbook_id: "cookbook-1",
      title: "Invalid Tags",
      preparation_description: "Test",
      image_url: null,
      image_alt_text: null,
      prep_time_minutes: null,
      ingredients: [],
      tag_ids: ["tag-1", "tag-2"],
    };

    const tagsBuilder = createAwaitableBuilder({
      data: [{ id: "tag-1" }],
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === "tags") {
        return tagsBuilder;
      }
      throw new Error(`Unexpected table request: ${table}`);
    });

    await expect(service.createRecipe("cookbook-1", "user-1", command)).rejects.toThrow(
      "One or more tag IDs are invalid"
    );
  });

  it("rejects recipe creation when ingredient validation fails", async () => {
    vi.spyOn(service as any, "verifyCookbookOwnership").mockResolvedValue(true);

    const command: CreateRecipeCommand = {
      cookbook_id: "cookbook-1",
      title: "Invalid Ingredient",
      preparation_description: "Test",
      image_url: null,
      image_alt_text: null,
      prep_time_minutes: null,
      ingredients: [
        {
          display_order: 0,
          name: "Salt",
          ingredient_id: "missing-ingredient",
        },
      ],
      tag_ids: [],
    };

    const ingredientsBuilder = createAwaitableBuilder({ data: [] });

    supabase.from.mockImplementation((table: string) => {
      switch (table) {
        case "tags":
          return createAwaitableBuilder({ data: [] });
        case "ingredients":
          return ingredientsBuilder;
        default:
          throw new Error(`Unexpected table request: ${table}`);
      }
    });

    await expect(service.createRecipe("cookbook-1", "user-1", command)).rejects.toThrow(
      "One or more ingredient IDs are invalid"
    );
  });

  it("rolls back recipe creation when ingredient insert fails", async () => {
    vi.spyOn(service as any, "verifyCookbookOwnership").mockResolvedValue(true);
    vi.spyOn(service as any, "getNextDisplayOrder").mockResolvedValue(2);

    const command: CreateRecipeCommand = {
      cookbook_id: "cookbook-1",
      title: "Rollback",
      preparation_description: "Test",
      image_url: null,
      image_alt_text: null,
      prep_time_minutes: null,
      ingredients: [
        {
          display_order: 0,
          name: "Salt",
        },
      ],
      tag_ids: [],
    };

    const recipesBuilder = createAwaitableBuilder({ data: null });
    const recipesInsertSingle = vi.fn().mockResolvedValue({ data: { id: "recipe-rollback" }, error: null });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    recipesBuilder.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: recipesInsertSingle,
      }),
    });
    recipesBuilder.delete = vi.fn().mockReturnValue({ eq: deleteEq });

    const recipeIngredientsBuilder = createAwaitableBuilder({ data: null });
    const ingredientsSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Insert failed" },
    });
    recipeIngredientsBuilder.insert = vi.fn().mockReturnValue({ select: ingredientsSelect });

    supabase.from.mockImplementation((table: string) => {
      switch (table) {
        case "tags":
          return createAwaitableBuilder({ data: [] });
        case "ingredients":
          return createAwaitableBuilder({ data: [] });
        case "recipes":
          return recipesBuilder;
        case "recipe_ingredients":
          return recipeIngredientsBuilder;
        default:
          return createAwaitableBuilder({ data: [] });
      }
    });

    await expect(service.createRecipe("cookbook-1", "user-1", command)).rejects.toThrow(
      "Failed to create recipe ingredients: Insert failed"
    );

    expect(recipesBuilder.delete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "recipe-rollback");
  });

  it("returns null when fetching recipe without ownership", async () => {
    vi.spyOn(service as any, "verifyRecipeOwnership").mockResolvedValue(null);

    const result = await service.getRecipeById("recipe-1", "user-1");

    expect(result).toBeNull();
  });

  it("retrieves recipe details with ingredients and tags", async () => {
    vi.spyOn(service as any, "verifyRecipeOwnership").mockResolvedValue("cookbook-1");

    const recipeRecord = {
      id: "recipe-1",
      cookbook_id: "cookbook-1",
      title: "Loaded",
      preparation_description: "Cook it",
      image_url: null,
      image_alt_text: null,
      prep_time_minutes: 10,
      display_order: 1,
      created_at: "now",
      updated_at: "now",
    };

    const recipeBuilder = createAwaitableBuilder({ data: recipeRecord });
    recipeBuilder.select = vi.fn().mockReturnValue(recipeBuilder);
    recipeBuilder.eq = vi.fn().mockReturnValue(recipeBuilder);
    recipeBuilder.single = vi.fn().mockResolvedValue({ data: recipeRecord, error: null });

    const ingredientsRecords: RecipeIngredientDTO[] = [
      {
        id: "ing-1",
        display_order: 0,
        name: "Salt",
        quantity: null,
        notes: null,
        ingredient_id: null,
      },
    ];

    const ingredientsBuilder = createAwaitableBuilder({ data: ingredientsRecords });
    ingredientsBuilder.select = vi.fn().mockReturnValue(ingredientsBuilder);
    ingredientsBuilder.eq = vi.fn().mockReturnValue(ingredientsBuilder);
    ingredientsBuilder.order = vi.fn().mockReturnValue(ingredientsBuilder);

    const tagsRecords: { tags: TagDTO }[] = [
      {
        tags: {
          id: "tag-1",
          label: "Spicy",
          slug: "spicy",
          description: null,
          icon: null,
          created_at: "now",
          updated_at: "now",
        } satisfies TagDTO,
      },
    ];

    const tagsBuilder = createAwaitableBuilder({ data: tagsRecords });
    tagsBuilder.select = vi.fn().mockReturnValue(tagsBuilder);
    tagsBuilder.eq = vi.fn().mockReturnValue(tagsBuilder);

    supabase.from.mockImplementation((table: string) => {
      switch (table) {
        case "recipes":
          return recipeBuilder;
        case "recipe_ingredients":
          return ingredientsBuilder;
        case "recipe_tags":
          return tagsBuilder;
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const result = await service.getRecipeById("recipe-1", "user-1");

    expect(result).toEqual({
      ...recipeRecord,
      ingredients: ingredientsRecords,
      tags: tagsRecords.map((entry) => entry.tags),
    });
  });
});
