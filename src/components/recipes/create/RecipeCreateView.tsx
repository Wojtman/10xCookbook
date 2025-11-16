import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { BookLayout } from "@/components/recipes/BookLayout";
import { ToastHost } from "@/components/recipes/ToastHost";
import { useCookbookSelection } from "@/lib/hooks/useCookbookSelection";
import { VALIDATION_CONSTANTS } from "@/types";

import {
  AIDraftPreview,
  EditModeHeader,
  RawTextSection,
  RecipeForm,
  RegistrationPromptModal,
  SessionEphemeralBanner,
} from "./components";
import { useAIParse, useRecipeForm, useRegistrationPrompt, useTagOptions, useImageUpload } from "./hooks";
import type { RawTextState, SaveRecipePayload, RecipeFormViewModel } from "./types";

const DRAFT_STORAGE_KEY = "10xCookbook.recipeCreate.draft";

export interface RecipeCreateViewProps {
  /**
   * Cookbook identifier provided by the route. The view will validate ownership
   * and resolve additional cookbook metadata before allowing recipe creation.
   */
  initialCookbookId?: string | null;
  /**
   * Optional user identifier injected by the server-rendered route. Primarily
   * used to bootstrap analytics/session context without additional auth calls.
   */
  initialUserId?: string | null;
  /**
   * Anonymous session identifier, if available. When absent, the view will
   * prompt users to create one before AI-assisted flows are available.
   */
  initialSessionId?: string | null;
  /**
   * Analytics session identifier seed provided by the server. When omitted, the
   * view will generate a client-side identifier.
   */
  initialAnalyticsSessionId?: string | null;
}

export function RecipeCreateView({
  initialCookbookId,
  initialUserId,
  initialSessionId,
  initialAnalyticsSessionId,
}: RecipeCreateViewProps) {
  const {
    cookbookId,
    cookbook,
    userId,
    isAnonymous,
    isLoading,
    error: cookbookError,
  } = useCookbookSelection(initialCookbookId ?? undefined);

  const [rawTextState, setRawTextState] = useState<RawTextState>({
    value: "",
    charCount: 0,
  });
  const hasHydratedDraft = useRef(false);
  const autoImageAltRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recipeForm = useRecipeForm();
  const { setImage, hydrate } = recipeForm;
  const tagOptions = useTagOptions();
  const registrationPrompt = useRegistrationPrompt({ isAnonymous });
  const isAiParseEnabled = false;
  const imageUpload = useImageUpload({
    sessionId: initialSessionId ?? undefined,
    analyticsSessionId: initialAnalyticsSessionId ?? undefined,
    onUploadComplete: (image) => {
      setImage(image);
    },
  });

  const aiParse = useAIParse({
    sessionId: initialSessionId ?? undefined,
    analyticsSessionId: initialAnalyticsSessionId ?? undefined,
    onSuccess: (result) => {
      recipeForm.applyAiResult(result);
      if (isAnonymous) {
        registrationPrompt.trackAiSuccess();
      }
    },
  });

  const handleRawTextChange = useCallback((value: string) => {
    const trimmed = value.slice(0, VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH);
    setRawTextState({
      value: trimmed,
      charCount: trimmed.length,
    });
  }, []);

  const handleParse = useCallback(() => {
    void aiParse.parse(rawTextState.value);
  }, [aiParse, rawTextState.value]);

  const handleTagToggle = useCallback(
    (tagId: string) => {
      const current = recipeForm.state.tagIds;
      const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
      recipeForm.updateField("tagIds", next);
    },
    [recipeForm]
  );

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const processImageFile = useCallback(
    (file: File) => {
      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const titleFallback = recipeForm.state.title.trim();
      const suggestedAlt = baseName || titleFallback || "Recipe image";
      const currentAlt = recipeForm.state.imageAltText.trim();

      if (!currentAlt || currentAlt === autoImageAltRef.current) {
        recipeForm.updateField("imageAltText", suggestedAlt);
        autoImageAltRef.current = suggestedAlt;
      } else {
        autoImageAltRef.current = currentAlt;
      }

      void imageUpload.upload(file);
    },
    [imageUpload, recipeForm]
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processImageFile(file);
      }
      event.target.value = "";
    },
    [processImageFile]
  );

  const handleImageRemove = useCallback(() => {
    imageUpload.remove();
    setImage(null);
    recipeForm.updateField("imageAltText", "");
    autoImageAltRef.current = "";
  }, [imageUpload, recipeForm, setImage]);

  useEffect(() => {
    if (!isAnonymous || hasHydratedDraft.current || typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          rawText?: string;
          form?: RecipeFormViewModel;
        } | null;

        if (parsed?.rawText && typeof parsed.rawText === "string") {
          const trimmed = parsed.rawText.slice(0, VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH);
          setRawTextState({
            value: trimmed,
            charCount: trimmed.length,
          });
        }

        if (parsed?.form && typeof parsed.form === "object") {
          hydrate(parsed.form);
        }
      }
    } catch (error) {
      console.error("Failed to hydrate anonymous recipe draft", error);
    } finally {
      hasHydratedDraft.current = true;
    }
  }, [isAnonymous, hydrate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isAnonymous) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [isAnonymous]);

  useEffect(() => {
    if (!isAnonymous || typeof window === "undefined" || !hasHydratedDraft.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const hasContent =
        rawTextState.value.trim().length > 0 ||
        recipeForm.state.title.trim().length > 0 ||
        recipeForm.state.preparationDescription.trim().length > 0 ||
        recipeForm.state.ingredients.some((ingredient) => ingredient.name.trim().length > 0);

      if (!hasContent) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      const payload = {
        rawText: rawTextState.value,
        form: recipeForm.state,
        updatedAt: Date.now(),
      };

      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.error("Failed to persist anonymous recipe draft", error);
      }
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAnonymous, rawTextState.value, recipeForm.state]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const handleDismissRegistration = useCallback(() => {
    registrationPrompt.dismiss();
  }, [registrationPrompt]);

  const handleRemindLater = useCallback(() => {
    registrationPrompt.remindLater();
  }, [registrationPrompt]);

  const handleCancel = useCallback(() => {
    const redirectUrl = new URL("/recipes", window.location.origin);
    if (cookbookId) {
      redirectUrl.searchParams.set("cookbookId", cookbookId);
    }
    window.location.href = redirectUrl.toString();
  }, [cookbookId]);

  const buildSavePayload = useCallback((): SaveRecipePayload => {
    const trimmedTitle = recipeForm.state.title.trim();
    const trimmedDescription = recipeForm.state.preparationDescription.trim();
    const altText = recipeForm.state.imageAltText.trim() || trimmedTitle;

    const ingredients = recipeForm.state.ingredients
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        quantity: item.quantity?.trim() ?? null,
        notes: item.notes?.trim() ?? null,
      }))
      .filter((item) => item.name.length > 0)
      .map((item, index) => ({
        display_order: index,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        ingredient_id: item.ingredient_id ?? null,
      }));

    return {
      title: trimmedTitle,
      preparation_description: trimmedDescription,
      prep_time_minutes: recipeForm.state.prepTimeMinutes ?? null,
      image_url: recipeForm.state.image?.image_url ?? null,
      image_alt_text: altText,
      display_order: recipeForm.state.displayOrder,
      ingredients,
      tag_ids: recipeForm.state.tagIds,
      is_ai_assisted: recipeForm.state.isAiAssisted,
    };
  }, [recipeForm.state]);

  const handleSubmit = useCallback(async () => {
    if (!cookbookId) {
      setSaveError("Select a cookbook before saving this recipe.");
      return;
    }

    setSaveError(undefined);
    setIsSaving(true);
    recipeForm.setValidationErrors({});

    try {
      const payload = buildSavePayload();
      const response = await fetch(`/api/cookbooks/${cookbookId}/recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = "Failed to save recipe. Please try again.";
        try {
          const errorBody = await response.json();
          if (errorBody?.message) {
            message = errorBody.message;
          }
          if (Array.isArray(errorBody?.fields)) {
            const fieldErrors = errorBody.fields.reduce<Record<string, string>>((acc, fieldName) => {
              acc[fieldName] = "This field requires your attention.";
              return acc;
            }, {});
            recipeForm.setValidationErrors(fieldErrors);
          }
        } catch {
          // swallow parsing errors
        }
        setSaveError(message);
        setIsSaving(false);
        return;
      }

      const result = await response.json();

      registrationPrompt.trackLocalRecipeCreated();

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }

      const recipeId = result?.id;
      const redirectUrl = new URL("/recipes", window.location.origin);
      redirectUrl.searchParams.set("cookbookId", cookbookId);
      if (recipeId) {
        redirectUrl.searchParams.set("highlight", recipeId);
      }
      window.location.href = redirectUrl.toString();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unexpected error while saving recipe.");
      setIsSaving(false);
    }
  }, [buildSavePayload, cookbookId, registrationPrompt, recipeForm]);

  const leftColumnContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-6">
        <SessionEphemeralBanner isAnonymous={isAnonymous} />
        <EditModeHeader cookbookTitle={cookbook?.title} />
        {isLoading ? <p className="text-sm text-ink-soft">Loading cookbook details…</p> : null}
        {isAiParseEnabled ? (
          <RawTextSection
            rawText={rawTextState.value}
            charCount={rawTextState.charCount}
            maxChars={VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH}
            parseStatus={aiParse.status}
            parseError={aiParse.error}
            isParseDisabled={isLoading}
            onRawTextChange={handleRawTextChange}
            onParse={handleParse}
            onCancelParse={aiParse.cancel}
          />
        ) : null}
        <RecipeForm
          mode="create"
          formState={recipeForm.state}
          validationState={recipeForm.validation}
          availableTags={tagOptions.tags}
          isSaving={isSaving}
          isSaveDisabled={
            recipeForm.isSaveDisabled || aiParse.status === "loading" || imageUpload.uploading || !cookbookId
          }
          imageUploading={imageUpload.uploading}
          imageError={imageUpload.error}
          saveError={saveError}
          onTriggerImageSelect={openImagePicker}
          onFieldChange={recipeForm.updateField}
          onIngredientChange={recipeForm.updateIngredient}
          onAddIngredient={recipeForm.addIngredient}
          onRemoveIngredient={recipeForm.removeIngredient}
          onToggleTag={handleTagToggle}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onRemoveImage={handleImageRemove}
          onReorderIngredients={recipeForm.reorderIngredients}
          isDirty={recipeForm.isDirty}
        />
      </div>
    );
  }, [
    aiParse.cancel,
    aiParse.error,
    aiParse.status,
    cookbook?.title,
    handleParse,
    handleRawTextChange,
    handleSubmit,
    handleCancel,
    handleTagToggle,
    isAnonymous,
    isLoading,
    cookbookId,
    rawTextState.charCount,
    rawTextState.value,
    saveError,
    isSaving,
    recipeForm.addIngredient,
    recipeForm.isSaveDisabled,
    recipeForm.removeIngredient,
    recipeForm.state,
    recipeForm.updateField,
    recipeForm.updateIngredient,
    recipeForm.reorderIngredients,
    recipeForm.isDirty,
    recipeForm.validation,
    tagOptions.tags,
    imageUpload.error,
    imageUpload.uploading,
    openImagePicker,
    handleImageRemove,
    isAiParseEnabled,
  ]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileInputChange}
      />
      <BookLayout
        spread={
          <div className="flex h-full flex-1 flex-col gap-6 px-6 py-6 md:px-10 md:py-8">
            <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="flex flex-col gap-6 overflow-y-auto pr-0 xl:pr-4">{leftColumnContent}</div>
              <div className="book-page-surface flex flex-col overflow-hidden border border-[rgba(72,44,20,0.15)] bg-[rgba(255,253,244,0.9)] p-6 shadow-inner">
                <AIDraftPreview
                  status={aiParse.status}
                  error={aiParse.error}
                  formState={recipeForm.state}
                  availableTags={tagOptions.tags}
                  selectedTagIds={recipeForm.state.tagIds}
                  onToggleTag={handleTagToggle}
                  onTriggerImageSelect={openImagePicker}
                  onImageDrop={processImageFile}
                  imageUploading={imageUpload.uploading}
                />
              </div>
            </div>
            {cookbookError ? (
              <p className="text-sm text-[rgba(143,58,32,0.85)]" role="alert">
                {cookbookError}
              </p>
            ) : null}
          </div>
        }
        toasts={<ToastHost />}
      />
      <RegistrationPromptModal
        visible={registrationPrompt.visible}
        onRegister={handleDismissRegistration}
        onDismiss={handleDismissRegistration}
        onRemindLater={handleRemindLater}
      />
    </>
  );
}

export default RecipeCreateView;
