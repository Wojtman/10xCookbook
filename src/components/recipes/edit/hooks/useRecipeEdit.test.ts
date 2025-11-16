import { describe, expect, it } from "vitest";

import { __test__validateRecipeEditState } from "./useRecipeEdit";
import type { RecipeFormState } from "../types";

function buildFormState(overrides: Partial<RecipeFormState> = {}): RecipeFormState {
  const base: RecipeFormState = {
    id: "recipe-1",
    cookbookId: "cookbook-1",
    title: "Test Recipe",
    rawText: "Mix and bake.",
    preparationDescription: "Mix and bake.",
    prepTimeMinutes: 10,
    image: null,
    imageAltText: "",
    ingredients: [
      {
        uuid: "ingredient-1",
        displayOrder: 0,
        name: "Flour",
        quantity: "1 cup",
        notes: "",
        ingredientId: null,
      },
    ],
    tagIds: [],
    aiDraft: null,
    aiSuggestedTags: [],
    aiStatus: "idle",
    aiError: undefined,
    updatedAt: new Date().toISOString(),
    isDirty: true,
  };

  return {
    ...base,
    ...overrides,
    ingredients: overrides.ingredients ?? base.ingredients.map((ingredient) => ({ ...ingredient })),
    tagIds: overrides.tagIds ?? [...base.tagIds],
  };
}

describe("useRecipeEdit validation", () => {
  it("requires at least one tag", () => {
    const result = __test__validateRecipeEditState(buildFormState({ tagIds: [] }));

    expect(result.isValid).toBe(false);
    expect(result.fields.tagIds).toBe("Select at least one tag.");
  });

  it("allows saving when minimum tag requirement is met", () => {
    const result = __test__validateRecipeEditState(buildFormState({ tagIds: ["tag-1"] }));

    expect(result.fields.tagIds).toBeUndefined();
    expect(result.isValid).toBe(true);
  });
});
