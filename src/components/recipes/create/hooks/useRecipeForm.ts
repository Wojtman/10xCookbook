import { useCallback, useMemo, useRef, useState } from "react";

import { VALIDATION_CONSTANTS } from "@/types";

import type { AIParseResponseDTO, ImageUploadResponseDTO } from "@/types";
import type {
  FormValidationState,
  IngredientItemViewModel,
  RecipeFormViewModel,
  UseRecipeFormArgs,
  UseRecipeFormResult,
} from "../types";

const MAX_INGREDIENTS = VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS;
const MAX_DESCRIPTION_LENGTH = VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH;

function generateLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function createIngredientRow(displayOrder: number): IngredientItemViewModel {
  return {
    id: generateLocalId(),
    display_order: displayOrder,
    name: "",
    quantity: "",
    notes: "",
    ingredient_id: null,
    error: undefined,
  };
}

function normalizeIngredients(ingredients: IngredientItemViewModel[]): IngredientItemViewModel[] {
  return ingredients.map((item, index) => ({
    ...item,
    display_order: index,
  }));
}

function mapAiIngredients(result: AIParseResponseDTO): IngredientItemViewModel[] {
  const suggestions = Array.isArray(result.ingredients) ? result.ingredients : [];
  return normalizeIngredients(
    suggestions.slice(0, MAX_INGREDIENTS).map((suggestion) => ({
      id: generateLocalId(),
      display_order: suggestion.display_order ?? 0,
      name: suggestion.name ?? "",
      quantity: suggestion.quantity ?? "",
      notes: suggestion.notes ?? "",
      ingredient_id: null,
      error: undefined,
    }))
  );
}

function clampIngredients(ingredients: IngredientItemViewModel[]): IngredientItemViewModel[] {
  if (ingredients.length === 0) {
    return [createIngredientRow(0)];
  }
  return normalizeIngredients(ingredients.slice(0, MAX_INGREDIENTS));
}

function createInitialFormState(initialState?: Partial<RecipeFormViewModel>): RecipeFormViewModel {
  const sanitizedIngredients = clampIngredients(
    initialState?.ingredients && initialState.ingredients.length > 0
      ? initialState.ingredients
      : [createIngredientRow(0)]
  );

  return {
    title: initialState?.title ?? "",
    preparationDescription: initialState?.preparationDescription ?? "",
    prepTimeMinutes: initialState?.prepTimeMinutes,
    ingredients: sanitizedIngredients,
    image: initialState?.image ?? null,
    imageAltText: initialState?.imageAltText ?? "",
    tagIds: initialState?.tagIds ?? [],
    displayOrder: initialState?.displayOrder,
    isAiAssisted: initialState?.isAiAssisted ?? false,
    aiSuggestedTagSlugs: initialState?.aiSuggestedTagSlugs ?? [],
  };
}

function validateFormState(form: RecipeFormViewModel): FormValidationState {
  const fieldErrors: Record<string, string | undefined> = {};

  if (!form.title.trim()) {
    fieldErrors.title = "Title is required.";
  }

  const description = form.preparationDescription.trim();
  if (!description) {
    fieldErrors.preparationDescription = "Preparation description is required.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.preparationDescription = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (form.prepTimeMinutes != null) {
    if (!Number.isInteger(form.prepTimeMinutes) || form.prepTimeMinutes < 0) {
      fieldErrors.prepTimeMinutes = "Prep time must be a non-negative whole number.";
    }
  }

  if (form.image && !form.imageAltText.trim()) {
    fieldErrors.imageAltText = "Alt text is required when an image is provided.";
  }

  const trimmedIngredients = form.ingredients.map((item) => item.name.trim());
  const hasValidIngredient = trimmedIngredients.some((name) => name.length > 0);
  if (!hasValidIngredient) {
    fieldErrors.ingredients = "At least one ingredient with a name is required.";
  }

  form.ingredients.forEach((item) => {
    if (!item.name.trim()) {
      fieldErrors[`ingredients.${item.id}`] = "Ingredient name is required.";
    }
  });

  if (!Array.isArray(form.tagIds) || form.tagIds.length < VALIDATION_CONSTANTS.RECIPE.MIN_TAGS) {
    fieldErrors.tagIds =
      VALIDATION_CONSTANTS.RECIPE.MIN_TAGS === 1
        ? "Select at least one tag."
        : `Select at least ${VALIDATION_CONSTANTS.RECIPE.MIN_TAGS} tags.`;
  }

  const isValid = Object.values(fieldErrors).every((value) => value === undefined);

  return {
    fields: fieldErrors,
    isValid,
  };
}

export { validateFormState as __test__validateRecipeFormState };

export function useRecipeForm({ initialState }: UseRecipeFormArgs = {}): UseRecipeFormResult {
  const initial = useRef(createInitialFormState(initialState));
  const [formState, setFormState] = useState<RecipeFormViewModel>(initial.current);
  const [dirty, setDirty] = useState(false);
  const [externalErrors, setExternalErrors] = useState<Record<string, string | undefined>>({});
  const [hasAltOverride, setHasAltOverride] = useState<boolean>(() => {
    const initialAlt = initial.current.imageAltText?.trim();
    return Boolean(initialAlt);
  });

  const validation = useMemo<FormValidationState>(() => {
    const baseValidation = validateFormState(formState);

    const mergedFields: Record<string, string | undefined> = {
      ...baseValidation.fields,
    };

    for (const [key, value] of Object.entries(externalErrors)) {
      if (value) {
        mergedFields[key] = value;
      } else {
        delete mergedFields[key];
      }
    }

    const isValid =
      baseValidation.isValid && Object.values(externalErrors).every((value) => value == null || value === "");

    return {
      fields: mergedFields,
      isValid,
    };
  }, [externalErrors, formState]);

  const isSaveDisabled = useMemo(() => !validation.isValid, [validation.isValid]);

  const updateIngredients = useCallback((updater: (prev: IngredientItemViewModel[]) => IngredientItemViewModel[]) => {
    setFormState((prev) => {
      const nextIngredients = clampIngredients(updater(prev.ingredients));
      setDirty(true);
      return {
        ...prev,
        ingredients: nextIngredients,
      };
    });
  }, []);

  const updateField = useCallback<UseRecipeFormResult["updateField"]>(
    (field, value) => {
      setFormState((prev) => {
        const next: RecipeFormViewModel = {
          ...prev,
          [field]: value,
        } as RecipeFormViewModel;

        if (field === "title" && prev.image && !hasAltOverride) {
          const titleValue = typeof value === "string" ? value : "";
          if (!next.imageAltText.trim()) {
            next.imageAltText = titleValue.trim();
          }
        }

        if (field === "imageAltText") {
          const altValue = typeof value === "string" ? value : "";
          setHasAltOverride(altValue.trim().length > 0);
        }

        if (field === "tagIds" && Array.isArray(value)) {
          next.tagIds = Array.from(new Set(value));
        }

        if (field === "preparationDescription" && typeof value === "string") {
          const truncatedValue = value.slice(0, MAX_DESCRIPTION_LENGTH);
          if (truncatedValue !== value) {
            next.preparationDescription = truncatedValue;
          }
        }

        setDirty(true);
        return next;
      });
    },
    [hasAltOverride]
  );

  const updateIngredient = useCallback<UseRecipeFormResult["updateIngredient"]>(
    (id, updates) => {
      updateIngredients((prevIngredients) =>
        prevIngredients.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                error: updates.error ?? undefined,
              }
            : item
        )
      );
    },
    [updateIngredients]
  );

  const addIngredient = useCallback(() => {
    updateIngredients((prevIngredients) => {
      if (prevIngredients.length >= MAX_INGREDIENTS) {
        return prevIngredients;
      }
      const nextOrder = prevIngredients.length;
      return [...prevIngredients, createIngredientRow(nextOrder)];
    });
  }, [updateIngredients]);

  const removeIngredient = useCallback(
    (id: string) => {
      updateIngredients((prevIngredients) => prevIngredients.filter((item) => item.id !== id));
    },
    [updateIngredients]
  );

  const reorderIngredients = useCallback<UseRecipeFormResult["reorderIngredients"]>(
    (ids) => {
      updateIngredients((prevIngredients) => {
        const idIndexMap = new Map(ids.map((identifier, index) => [identifier, index]));
        const sorted = [...prevIngredients].sort((a, b) => {
          const aIndex = idIndexMap.has(a.id) ? (idIndexMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
          const bIndex = idIndexMap.has(b.id) ? (idIndexMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });
        return normalizeIngredients(sorted);
      });
    },
    [updateIngredients]
  );

  const setImage = useCallback<UseRecipeFormResult["setImage"]>(
    (image: ImageUploadResponseDTO | null) => {
      setFormState((prev) => {
        const next: RecipeFormViewModel = {
          ...prev,
          image,
        };

        if (image) {
          if (!hasAltOverride && !next.imageAltText.trim()) {
            next.imageAltText = prev.title.trim();
          }
        } else {
          next.imageAltText = "";
          setHasAltOverride(false);
        }

        setDirty(true);
        return next;
      });
    },
    [hasAltOverride]
  );

  const setValidationErrors = useCallback<UseRecipeFormResult["setValidationErrors"]>((errors) => {
    setExternalErrors(errors);
  }, []);

  const applyAiResult = useCallback<UseRecipeFormResult["applyAiResult"]>((result) => {
    if (!result) {
      return;
    }

    setFormState((prev) => {
      const next = { ...prev };

      const normalizedTitle = result.title?.trim();
      if (normalizedTitle && !prev.title.trim()) {
        next.title = normalizedTitle;
      }

      const normalizedDescription = result.preparation_description?.trim();
      if (normalizedDescription && !prev.preparationDescription.trim()) {
        next.preparationDescription = normalizedDescription.slice(0, MAX_DESCRIPTION_LENGTH);
      }

      if (result.prep_time_minutes && prev.prepTimeMinutes == null) {
        next.prepTimeMinutes = result.prep_time_minutes;
      }

      const suggestedIngredients = mapAiIngredients(result);
      const hasUserProvidedIngredients = prev.ingredients.some((item) => item.name.trim().length > 0);
      if (!hasUserProvidedIngredients && suggestedIngredients.length > 0) {
        next.ingredients = suggestedIngredients;
      }

      if (Array.isArray(result.suggested_tags)) {
        next.aiSuggestedTagSlugs = result.suggested_tags;
      }

      next.isAiAssisted = true;
      setDirty(true);
      return next;
    });
  }, []);

  const resetWithAi = useCallback<UseRecipeFormResult["resetWithAi"]>((result) => {
    if (!result) {
      return;
    }

    const nextState: RecipeFormViewModel = {
      title: result.title?.trim() ?? "",
      preparationDescription: result.preparation_description?.slice(0, MAX_DESCRIPTION_LENGTH) ?? "",
      prepTimeMinutes: result.prep_time_minutes ?? undefined,
      ingredients: mapAiIngredients(result),
      image: null,
      imageAltText: "",
      tagIds: [],
      displayOrder: undefined,
      isAiAssisted: true,
      aiSuggestedTagSlugs: Array.isArray(result.suggested_tags) ? result.suggested_tags : [],
    };

    setFormState(nextState);
    setHasAltOverride(false);
    setDirty(true);
  }, []);

  const reset = useCallback(() => {
    setFormState(initial.current);
    setExternalErrors({});
    setHasAltOverride(Boolean(initial.current.imageAltText?.trim()));
    setDirty(false);
  }, []);

  const hydrate = useCallback((state: RecipeFormViewModel) => {
    const nextState = createInitialFormState(state);
    setFormState(nextState);
    setExternalErrors({});
    setHasAltOverride(Boolean(nextState.imageAltText?.trim()));
    setDirty(true);
  }, []);

  return {
    state: formState,
    validation,
    isDirty: dirty,
    isSaveDisabled,
    updateField,
    updateIngredient,
    addIngredient,
    removeIngredient,
    reorderIngredients,
    setImage,
    setValidationErrors,
    applyAiResult,
    resetWithAi,
    reset,
    hydrate,
  };
}
