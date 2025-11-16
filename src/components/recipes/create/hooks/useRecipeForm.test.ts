import { describe, expect, it } from "vitest";

import { __test__validateRecipeFormState } from "./useRecipeForm";
import type { RecipeFormViewModel } from "../types";

function buildForm(overrides: Partial<RecipeFormViewModel> = {}): RecipeFormViewModel {
  const base: RecipeFormViewModel = {
    title: "Test Recipe",
    preparationDescription: "Mix and bake.",
    prepTimeMinutes: undefined,
    ingredients: [
      {
        id: "ingredient-1",
        display_order: 0,
        name: "Flour",
        quantity: "1 cup",
        notes: "",
        ingredient_id: null,
      },
    ],
    image: null,
    imageAltText: "",
    tagIds: [],
    displayOrder: undefined,
    isAiAssisted: false,
    aiSuggestedTagSlugs: [],
  };

  return {
    ...base,
    ...overrides,
    ingredients: overrides.ingredients ?? base.ingredients.map((ingredient) => ({ ...ingredient })),
    tagIds: overrides.tagIds ?? [...base.tagIds],
  };
}

describe("useRecipeForm validation", () => {
  it("requires at least one tag", () => {
    const result = __test__validateRecipeFormState(buildForm({ tagIds: [] }));

    expect(result.isValid).toBe(false);
    expect(result.fields.tagIds).toBe("Select at least one tag.");
  });

  it("passes when minimum tag requirement is met", () => {
    const result = __test__validateRecipeFormState(buildForm({ tagIds: ["tag-1"] }));

    expect(result.fields.tagIds).toBeUndefined();
    expect(result.isValid).toBe(true);
  });
});
