import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabaseClient } from "@/db/supabase.client";
import { RecipeService } from "@/lib/services/recipe.service";
import { fetchAllTags } from "@/lib/services/tag.service";

import type { AIParseResponseDTO, RecipeDetailDTO, RecipeIngredientDTO, TagDTO, UpdateRecipeCommand } from "@/types";
import { VALIDATION_CONSTANTS } from "@/types";

import {
  type IngredientFormItem,
  type ImageUploadState,
  type FormValidationState,
  type PreviewSource,
  type RecipeEditData,
  type RecipeEditSnapshot,
  type RecipeFormState,
  type SaveState,
  type TagOption,
} from "../types";

type RecipeEditStatus = "idle" | "loading" | "ready" | "error";

export interface UseRecipeEditOptions {
  recipeId: string;
}

export interface UseRecipeEditResult {
  status: RecipeEditStatus;
  error?: string;
  data?: RecipeEditData;
  formState: RecipeFormState | null;
  validation: FormValidationState;
  isSaveDisabled: boolean;
  tagOptions: TagOption[];
  saveState: SaveState;
  previewSource: PreviewSource;
  setPreviewSource(source: PreviewSource): void;
  refresh(): Promise<void>;
  updateField<TKey extends keyof RecipeFormState>(field: TKey, value: RecipeFormState[TKey]): void;
  updateIngredients(updater: (items: IngredientFormItem[]) => IngredientFormItem[]): void;
  toggleTag(tagId: string): void;
  setImage(image: ImageUploadState | null): void;
  setRawText(value: string): void;
  setAiDraft(draft: RecipeFormState["aiDraft"]): void;
  setAiStatus(status: RecipeFormState["aiStatus"], error?: string): void;
  updateIngredient(id: string, updates: Partial<IngredientFormItem>): void;
  addIngredient(): void;
  removeIngredient(id: string): void;
  reorderIngredients(ids: string[]): void;
  markClean(): void;
  resetToLastSaved(): void;
  submitUpdates(): Promise<RecipeDetailDTO | null>;
}

const MAX_DESCRIPTION_LENGTH = VALIDATION_CONSTANTS.RECIPE.MAX_DESCRIPTION_LENGTH;
const MAX_INGREDIENTS = VALIDATION_CONSTANTS.RECIPE.MAX_INGREDIENTS;

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown; message?: unknown } | null;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : null;

    if (message) {
      return message;
    }
  } catch (error) {
    console.error("[useRecipeEdit] Failed to parse error response", error);
  }

  return `Request failed with status ${response.status}`;
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyIngredient(displayOrder: number): IngredientFormItem {
  return {
    uuid: generateUuid(),
    displayOrder,
    name: "",
    quantity: "",
    notes: "",
    ingredientId: null,
  };
}

function normalizeIngredients(ingredients: IngredientFormItem[]): IngredientFormItem[] {
  const bounded = ingredients.slice(0, MAX_INGREDIENTS);
  if (bounded.length === 0) {
    return [createEmptyIngredient(0)];
  }
  return bounded.map((item, index) => ({
    ...item,
    displayOrder: index,
  }));
}

function mapIngredientToFormItem(ingredient: RecipeIngredientDTO): IngredientFormItem {
  return {
    uuid: generateUuid(),
    displayOrder: ingredient.display_order,
    name: ingredient.name ?? "",
    quantity: ingredient.quantity ?? undefined,
    notes: ingredient.notes ?? undefined,
    ingredientId: ingredient.ingredient_id ?? undefined,
  };
}

function mapAiDraftIngredients(draft: AIParseResponseDTO): IngredientFormItem[] {
  const suggestions = Array.isArray(draft.ingredients) ? draft.ingredients : [];
  const mapped = suggestions.slice(0, MAX_INGREDIENTS).map((item, index) => ({
    uuid: generateUuid(),
    displayOrder: index,
    name: item.name ?? "",
    quantity: item.quantity ?? undefined,
    notes: item.notes ?? undefined,
    ingredientId: null,
  }));
  return normalizeIngredients(mapped);
}

function inferImageFormat(url: string | null | undefined): string {
  if (!url) {
    return "";
  }
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/u.exec(url);
  if (!match) {
    return "";
  }
  return match[1]?.toLowerCase() ?? "";
}

function mapRecipeToFormState(recipe: RecipeDetailDTO): RecipeFormState {
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map(mapIngredientToFormItem)
    : [];

  const normalizedIngredients = normalizeIngredients(ingredients.length > 0 ? ingredients : [createEmptyIngredient(0)]);

  const imageUrl = recipe.image_url ?? null;
  const image: ImageUploadState | null = imageUrl
    ? {
        imageUrl,
        width: 0,
        height: 0,
        sizeBytes: 0,
        format: inferImageFormat(imageUrl),
        altText: recipe.image_alt_text ?? "",
        uploading: false,
      }
    : null;

  return {
    id: recipe.id,
    cookbookId: recipe.cookbook_id,
    title: recipe.title ?? "",
    rawText: recipe.preparation_description ?? "",
    preparationDescription: recipe.preparation_description ?? "",
    prepTimeMinutes: recipe.prep_time_minutes ?? null,
    image,
    imageAltText: recipe.image_alt_text ?? "",
    ingredients: normalizedIngredients,
    tagIds: Array.isArray(recipe.tags) ? recipe.tags.map((tag) => tag.id) : [],
    aiDraft: null,
    aiSuggestedTags: [],
    aiStatus: "idle",
    aiError: undefined,
    updatedAt: recipe.updated_at ?? new Date().toISOString(),
    isDirty: false,
  };
}

function cloneFormState(form: RecipeFormState): RecipeFormState {
  return {
    ...form,
    image: form.image ? { ...form.image } : null,
    ingredients: form.ingredients.map((item) => ({ ...item })),
    aiDraft: form.aiDraft ? { ...form.aiDraft } : null,
    aiSuggestedTags: [...form.aiSuggestedTags],
    tagIds: [...form.tagIds],
  };
}

function buildTagOptions(tags: TagDTO[], selectedIds: string[]): TagOption[] {
  const selectedSet = new Set(selectedIds);
  return tags.map<TagOption>((tag) => ({
    id: tag.id,
    slug: tag.slug,
    label: tag.label,
    icon: tag.icon,
    description: tag.description,
    selected: selectedSet.has(tag.id),
  }));
}

function buildUpdateCommand(form: RecipeFormState): UpdateRecipeCommand {
  const trimmedTitle = form.title.trim();
  const trimmedDescription = form.preparationDescription.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  const trimmedAltText = form.imageAltText.trim();

  const ingredients = form.ingredients
    .map((item, index) => ({
      display_order: index,
      name: item.name.trim(),
      quantity: item.quantity?.trim() || null,
      notes: item.notes?.trim() || null,
      ingredient_id: item.ingredientId ?? null,
    }))
    .filter((item) => item.name.length > 0);

  return {
    title: trimmedTitle,
    preparation_description: trimmedDescription,
    prep_time_minutes: typeof form.prepTimeMinutes === "number" ? form.prepTimeMinutes : null,
    image_url: form.image?.imageUrl ?? null,
    image_alt_text: trimmedAltText || null,
    ingredients,
    tag_ids: [...form.tagIds],
  };
}

function validateFormState(form: RecipeFormState): FormValidationState {
  const fields: Record<string, string | undefined> = {};

  if (!form.title.trim()) {
    fields.title = "Title is required.";
  }

  const description = form.preparationDescription.trim();
  if (!description) {
    fields.preparationDescription = "Preparation description is required.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fields.preparationDescription = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  const prepTime = form.prepTimeMinutes;
  if (prepTime != null) {
    if (!Number.isInteger(prepTime) || prepTime < 0) {
      fields.prepTimeMinutes = "Prep time must be a non-negative whole number.";
    }
  }

  if (form.image && !form.imageAltText.trim()) {
    fields.imageAltText = "Alt text is required when an image is provided.";
  }

  const hasValidIngredient = form.ingredients.some((ingredient) => ingredient.name.trim().length > 0);
  if (!hasValidIngredient) {
    fields.ingredients = "At least one ingredient with a name is required.";
  }

  form.ingredients.forEach((ingredient) => {
    if (!ingredient.name.trim()) {
      fields[`ingredients.${ingredient.uuid}`] = "Ingredient name is required.";
    }
  });

  const isValid = Object.values(fields).every((value) => value === undefined);

  return {
    fields,
    isValid,
  };
}

export function useRecipeEdit(options: UseRecipeEditOptions): UseRecipeEditResult {
  const { recipeId } = options;
  const [status, setStatus] = useState<RecipeEditStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [data, setData] = useState<RecipeEditData | undefined>(undefined);
  const [formState, setFormState] = useState<RecipeFormState | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [previewSource, setPreviewSource] = useState<PreviewSource>("current");

  const snapshotRef = useRef<RecipeEditSnapshot | null>(null);
  const isMountedRef = useRef(true);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applySnapshot = useCallback((snapshot: RecipeEditSnapshot) => {
    const form = cloneFormState(snapshot.form);
    form.isDirty = false;
    form.aiDraft = null;
    form.aiStatus = "idle";
    form.aiError = undefined;
    setFormState(form);
    snapshotRef.current = {
      recipe: snapshot.recipe,
      form: cloneFormState(form),
    };
  }, []);

  const initializeState = useCallback((recipe: RecipeDetailDTO, tags: TagDTO[]) => {
    const mappedForm = mapRecipeToFormState(recipe);
    const snapshot: RecipeEditSnapshot = {
      recipe,
      form: cloneFormState(mappedForm),
    };
    snapshotRef.current = snapshot;
    setData({ recipe, tags });
    setFormState(mappedForm);
    setSaveState({ status: "idle", lastSavedAt: mappedForm.updatedAt });
    setPreviewSource("current");
    setStatus("ready");
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++activeRequestRef.current;

    setStatus("loading");
    setError(undefined);

    try {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const userId = sessionData.session?.user?.id ?? null;

      if (!userId) {
        throw new Error("You must be signed in to edit recipes.");
      }

      const recipeService = new RecipeService(supabaseClient);

      const [recipe, tags] = await Promise.all([
        recipeService.getRecipeById(recipeId, userId),
        (async () => {
          try {
            const tagResult = await fetchAllTags(supabaseClient);
            return tagResult.tags ?? [];
          } catch (tagError) {
            console.error("[useRecipeEdit] Failed to load tags", tagError);
            return [] as TagDTO[];
          }
        })(),
      ]);

      if (!isMountedRef.current || activeRequestRef.current !== requestId) {
        return;
      }

      if (!recipe) {
        throw new Error("Recipe not found or you do not have access to it.");
      }

      initializeState(recipe, tags);
    } catch (err) {
      if (!isMountedRef.current || activeRequestRef.current !== requestId) {
        return;
      }

      setError(err instanceof Error ? err.message : "Failed to load recipe");
      setStatus("error");
    }
  }, [initializeState, recipeId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const validation = useMemo<FormValidationState>(() => {
    if (!formState) {
      return { fields: {}, isValid: false };
    }
    return validateFormState(formState);
  }, [formState]);

  const isSaveDisabled = !formState || !validation.isValid || !formState.isDirty;

  const updateField = useCallback<UseRecipeEditResult["updateField"]>((field, value) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const next = {
        ...prev,
        [field]: value,
      } as RecipeFormState;

      if (field === "preparationDescription" && typeof value === "string") {
        next.preparationDescription = value.slice(0, MAX_DESCRIPTION_LENGTH);
      }

      if (field === "tagIds" && Array.isArray(value)) {
        next.tagIds = Array.from(new Set(value));
      }

      next.isDirty = true;
      return next;
    });
  }, []);

  const updateIngredients = useCallback<UseRecipeEditResult["updateIngredients"]>((updater) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const nextItems = normalizeIngredients(updater(prev.ingredients));
      return {
        ...prev,
        ingredients: nextItems,
        isDirty: true,
      };
    });
  }, []);

  const toggleTag = useCallback<UseRecipeEditResult["toggleTag"]>((tagId) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const hasTag = prev.tagIds.includes(tagId);
      const nextTagIds = hasTag ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId];
      return {
        ...prev,
        tagIds: nextTagIds,
        isDirty: true,
      };
    });
  }, []);

  const setImage = useCallback<UseRecipeEditResult["setImage"]>((image) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const next: RecipeFormState = {
        ...prev,
        image: image ? { ...image } : null,
        imageAltText: image ? image.altText : "",
        isDirty: true,
      };
      return next;
    });
  }, []);

  const setRawText = useCallback<UseRecipeEditResult["setRawText"]>((value) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const trimmed = value.slice(0, VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH);
      return {
        ...prev,
        rawText: trimmed,
        isDirty: true,
      };
    });
  }, []);

  const setAiDraft = useCallback<UseRecipeEditResult["setAiDraft"]>((draft) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const next: RecipeFormState = {
        ...prev,
        aiDraft: draft ? { ...draft } : null,
        aiStatus: draft ? "success" : prev.aiStatus,
        aiError: draft ? undefined : prev.aiError,
      };

      if (!draft) {
        next.aiSuggestedTags = [];
        return next;
      }

      let hasChanges = false;

      const trimmedTitle = draft.title?.trim();
      if (trimmedTitle && !prev.title.trim()) {
        next.title = trimmedTitle;
        hasChanges = true;
      }

      const trimmedDescription = draft.preparation_description?.trim();
      if (trimmedDescription && !prev.preparationDescription.trim()) {
        next.preparationDescription = trimmedDescription.slice(0, MAX_DESCRIPTION_LENGTH);
        hasChanges = true;
      }

      if (typeof draft.prep_time_minutes === "number" && prev.prepTimeMinutes == null) {
        next.prepTimeMinutes = draft.prep_time_minutes;
        hasChanges = true;
      }

      const hasUserIngredients = prev.ingredients.some((ingredient) => ingredient.name.trim().length > 0);
      if (!hasUserIngredients) {
        const mappedIngredients = mapAiDraftIngredients(draft);
        if (mappedIngredients.length > 0) {
          next.ingredients = mappedIngredients;
          hasChanges = true;
        }
      }

      if (Array.isArray(draft.suggested_tags)) {
        next.aiSuggestedTags = draft.suggested_tags.slice(0);
      } else {
        next.aiSuggestedTags = [];
      }

      if (hasChanges) {
        next.isDirty = true;
      }

      return next;
    });
  }, []);

  const setAiStatus = useCallback<UseRecipeEditResult["setAiStatus"]>((statusValue, errorMessage) => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        aiStatus: statusValue,
        aiError: errorMessage,
      };
    });
  }, []);

  const updateIngredient = useCallback<UseRecipeEditResult["updateIngredient"]>(
    (id, updates) => {
      updateIngredients((prev) =>
        prev.map((item) =>
          item.uuid === id
            ? {
                ...item,
                ...updates,
              }
            : item
        )
      );
    },
    [updateIngredients]
  );

  const addIngredient = useCallback<UseRecipeEditResult["addIngredient"]>(() => {
    updateIngredients((prev) => {
      if (prev.length >= MAX_INGREDIENTS) {
        return prev;
      }
      return [...prev, createEmptyIngredient(prev.length)];
    });
  }, [updateIngredients]);

  const removeIngredient = useCallback<UseRecipeEditResult["removeIngredient"]>(
    (id) => {
      updateIngredients((prev) => prev.filter((item) => item.uuid !== id));
    },
    [updateIngredients]
  );

  const reorderIngredients = useCallback<UseRecipeEditResult["reorderIngredients"]>(
    (ids) => {
      updateIngredients((prev) => {
        const idToItem = new Map(prev.map((item) => [item.uuid, item]));
        const ordered = ids
          .map((identifier) => idToItem.get(identifier))
          .filter((item): item is IngredientFormItem => Boolean(item));
        const leftovers = prev.filter((item) => !ids.includes(item.uuid));
        return normalizeIngredients([...ordered, ...leftovers]);
      });
    },
    [updateIngredients]
  );

  const markClean = useCallback<UseRecipeEditResult["markClean"]>(() => {
    setFormState((prev) => {
      if (!prev) {
        return prev;
      }
      const next = {
        ...prev,
        isDirty: false,
      };
      if (snapshotRef.current) {
        snapshotRef.current.form = cloneFormState(next);
      }
      return next;
    });
  }, []);

  const resetToLastSaved = useCallback<UseRecipeEditResult["resetToLastSaved"]>(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) {
      return;
    }
    applySnapshot(snapshot);
    setPreviewSource("current");
  }, [applySnapshot]);

  const submitUpdates = useCallback<UseRecipeEditResult["submitUpdates"]>(async () => {
    if (!formState) {
      return null;
    }
    setSaveState({ status: "saving", error: undefined });
    try {
      const payload = buildUpdateCommand(formState);
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      const updatedRecipe = (await response.json()) as RecipeDetailDTO;
      if (!isMountedRef.current) {
        return updatedRecipe;
      }

      setSaveState({
        status: "success",
        error: undefined,
        lastSavedAt: updatedRecipe.updated_at ?? new Date().toISOString(),
      });

      const currentTags = data?.tags ?? [];
      initializeState(updatedRecipe, currentTags);

      return updatedRecipe;
    } catch (err) {
      if (!isMountedRef.current) {
        return null;
      }
      const message = err instanceof Error ? err.message : "Failed to save recipe changes";
      setSaveState({
        status: "error",
        error: message,
        lastSavedAt: formState.updatedAt,
      });
      throw err;
    }
  }, [data?.tags, formState, initializeState, recipeId]);

  const refresh = useCallback<UseRecipeEditResult["refresh"]>(async () => {
    await fetchData();
  }, [fetchData]);

  const tagOptions = useMemo(
    () => buildTagOptions(data?.tags ?? [], formState?.tagIds ?? []),
    [data?.tags, formState?.tagIds]
  );

  return {
    status,
    error,
    data,
    formState,
    tagOptions,
    saveState,
    previewSource,
    setPreviewSource,
    refresh,
    updateField,
    updateIngredients,
    updateIngredient,
    addIngredient,
    removeIngredient,
    reorderIngredients,
    toggleTag,
    setImage,
    setRawText,
    setAiDraft,
    setAiStatus,
    validation,
    isSaveDisabled,
    markClean,
    resetToLastSaved,
    submitUpdates,
  };
}
