import { useCallback, useMemo } from "react";

import { RecipeForm } from "@/components/recipes/create/components";
import type { IngredientItemViewModel, RecipeFormViewModel } from "@/components/recipes/create/types";
import type { ImageUploadResponseDTO } from "@/types";

import type { FormValidationState, IngredientFormItem, RecipeFormState, SaveState } from "../types";

interface RecipeEditFormProps {
  formState: RecipeFormState;
  validation: FormValidationState;
  saveState: SaveState;
  isSaving: boolean;
  isSaveDisabled: boolean;
  onFieldChange: <K extends keyof RecipeFormState>(field: K, value: RecipeFormState[K]) => void;
  onIngredientChange: (id: string, updates: Partial<IngredientFormItem>) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onReorderIngredients: (ids: string[]) => void;
  onSubmit: () => Promise<unknown>;
  onDiscard: () => void;
  onCancel?: () => void;
}

export function mapRecipeFormStateToViewModel(formState: RecipeFormState): RecipeFormViewModel {
  const image: ImageUploadResponseDTO | null = formState.image
    ? {
        image_url: formState.image.imageUrl,
        width: formState.image.width,
        height: formState.image.height,
        size_bytes: formState.image.sizeBytes,
        format: formState.image.format,
      }
    : null;

  return {
    title: formState.title,
    preparationDescription: formState.preparationDescription,
    prepTimeMinutes: formState.prepTimeMinutes ?? undefined,
    ingredients: formState.ingredients.map<IngredientItemViewModel>((ingredient) => ({
      id: ingredient.uuid,
      display_order: ingredient.displayOrder,
      name: ingredient.name,
      quantity: ingredient.quantity,
      notes: ingredient.notes,
      ingredient_id: ingredient.ingredientId ?? null,
    })),
    image,
    imageAltText: formState.imageAltText,
    tagIds: formState.tagIds,
    displayOrder: undefined,
    isAiAssisted: formState.aiDraft != null,
    aiSuggestedTagSlugs: formState.aiSuggestedTags,
  };
}

export function RecipeEditForm({
  formState,
  validation,
  saveState,
  isSaving,
  isSaveDisabled,
  onFieldChange,
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient,
  onReorderIngredients,
  onSubmit,
  onDiscard,
  onCancel,
}: RecipeEditFormProps) {
  const bridgedFormState = useMemo<RecipeFormViewModel>(() => mapRecipeFormStateToViewModel(formState), [formState]);

  const handleFieldChange = useCallback(
    (field: keyof RecipeFormViewModel, value: RecipeFormViewModel[keyof RecipeFormViewModel]) => {
      switch (field) {
        case "prepTimeMinutes": {
          const numericValue = value as RecipeFormViewModel["prepTimeMinutes"];
          onFieldChange("prepTimeMinutes", numericValue ?? null);
          return;
        }
        case "tagIds": {
          onFieldChange("tagIds", value as RecipeFormViewModel["tagIds"]);
          return;
        }
        case "preparationDescription": {
          onFieldChange("preparationDescription", value as RecipeFormViewModel["preparationDescription"]);
          return;
        }
        case "imageAltText": {
          onFieldChange("imageAltText", value as RecipeFormViewModel["imageAltText"]);
          return;
        }
        case "title": {
          onFieldChange("title", value as RecipeFormViewModel["title"]);
          return;
        }
        default:
          return;
      }
    },
    [onFieldChange]
  );

  const handleIngredientChange = useCallback(
    (id: string, updates: Partial<IngredientItemViewModel>) => {
      const mappedUpdates: Partial<IngredientFormItem> = {};
      if (updates.name !== undefined) {
        mappedUpdates.name = updates.name;
      }
      if (updates.quantity !== undefined) {
        mappedUpdates.quantity = updates.quantity ?? undefined;
      }
      if (updates.notes !== undefined) {
        mappedUpdates.notes = updates.notes ?? undefined;
      }
      if (updates.ingredient_id !== undefined) {
        mappedUpdates.ingredientId = updates.ingredient_id ?? null;
      }

      onIngredientChange(id, mappedUpdates);
    },
    [onIngredientChange]
  );

  const handleSubmit = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  return (
    <div className="flex flex-col gap-6">
      <RecipeForm
        mode="edit"
        formState={bridgedFormState}
        validationState={validation}
        isSaving={isSaving}
        isSaveDisabled={isSaveDisabled}
        saveError={saveState.error}
        onFieldChange={handleFieldChange}
        onIngredientChange={handleIngredientChange}
        onAddIngredient={onAddIngredient}
        onRemoveIngredient={onRemoveIngredient}
        onSubmit={handleSubmit}
        onReorderIngredients={onReorderIngredients}
        onDiscard={onDiscard}
        onCancel={onCancel}
        isDirty={formState.isDirty}
      />
    </div>
  );
}

export default RecipeEditForm;
