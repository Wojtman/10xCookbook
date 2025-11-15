import { useCallback, useMemo, useRef, type ChangeEvent } from "react";

import { BookLayout } from "@/components/recipes/BookLayout";
import { ToastHost } from "@/components/recipes/ToastHost";
import {
  AIDraftPreview,
  EditModeHeader,
  RawTextSection,
  SessionEphemeralBanner,
} from "@/components/recipes/create/components";
import { useAIParse, useImageUpload } from "@/components/recipes/create/hooks";
import { Button } from "@/components/ui/button";
import { VALIDATION_CONSTANTS, type ImageUploadResponseDTO } from "@/types";

import { RecipeEditForm } from "./components/RecipeEditForm";
import { mapRecipeFormStateToViewModel } from "./components/RecipeEditForm";
import { useRecipeEdit } from "./hooks/useRecipeEdit";

export interface RecipeEditPageProps {
  recipeId: string;
  sessionId?: string | null;
  analyticsSessionId?: string | null;
}

export function RecipeEditPage({ recipeId, sessionId, analyticsSessionId }: RecipeEditPageProps) {
  const controller = useRecipeEdit({ recipeId });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoImageAltRef = useRef<string>("");

  const handleRetry = useCallback(() => {
    void controller.refresh();
  }, [controller]);

  const handleUploadComplete = useCallback(
    (payload: ImageUploadResponseDTO) => {
      const fallbackAlt = controller.formState?.imageAltText ?? autoImageAltRef.current ?? "";
      controller.setImage({
        imageUrl: payload.image_url,
        width: payload.width,
        height: payload.height,
        sizeBytes: payload.size_bytes,
        format: payload.format,
        altText: fallbackAlt,
        uploading: false,
      });
    },
    [controller]
  );

  const handleUploadError = useCallback(
    (_message: string) => {
      const currentImage = controller.formState?.image;
      if (currentImage) {
        controller.setImage({
          ...currentImage,
          uploading: false,
        });
      } else {
        controller.setImage(null);
      }
    },
    [controller]
  );

  const imageUpload = useImageUpload({
    sessionId: sessionId ?? undefined,
    analyticsSessionId: analyticsSessionId ?? undefined,
    onUploadComplete: handleUploadComplete,
    onError: handleUploadError,
  });

  const aiParse = useAIParse({
    sessionId: sessionId ?? undefined,
    analyticsSessionId: analyticsSessionId ?? undefined,
    onSuccess: (result) => {
      controller.setAiDraft(result);
    },
    onError: (error) => {
      controller.setAiStatus(error.code === "timeout" ? "timeout" : "error", error.message);
    },
  });

  const handleRawTextChange = useCallback(
    (value: string) => {
      controller.setRawText(value);
    },
    [controller]
  );

  const handleParse = useCallback(async () => {
    if (!controller.formState) {
      return;
    }
    controller.setAiStatus("loading");
    const result = await aiParse.parse(controller.formState.rawText);
    if (!result && aiParse.status !== "success") {
      if (aiParse.status === "timeout") {
        controller.setAiStatus("timeout", aiParse.error?.message);
      } else if (aiParse.status === "error") {
        controller.setAiStatus("error", aiParse.error?.message);
      } else {
        controller.setAiStatus("idle");
      }
    }
  }, [aiParse, controller]);

  const handleCancelParse = useCallback(() => {
    aiParse.cancel();
    controller.setAiStatus("idle");
  }, [aiParse, controller]);

  const handleTriggerImageSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const processImageFile = useCallback(
    (file: File) => {
      if (!controller.formState) {
        return;
      }

      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const titleFallback = controller.formState.title.trim();
      const suggestedAlt = baseName || titleFallback || "Recipe image";
      const currentAlt = controller.formState.imageAltText.trim();

      if (!currentAlt || currentAlt === autoImageAltRef.current) {
        controller.updateField("imageAltText", suggestedAlt);
        autoImageAltRef.current = suggestedAlt;
      } else {
        autoImageAltRef.current = currentAlt;
      }

      const nextFormat = (file.type.split("/").pop() ?? "").toLowerCase();

      controller.setImage({
        imageUrl: controller.formState.image?.imageUrl ?? "",
        width: controller.formState.image?.width ?? 0,
        height: controller.formState.image?.height ?? 0,
        sizeBytes: file.size,
        format: nextFormat,
        altText: controller.formState.imageAltText || suggestedAlt,
        uploading: true,
      });

      void imageUpload.upload(file);
    },
    [controller, imageUpload]
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
    controller.setImage(null);
    controller.updateField("imageAltText", "");
    autoImageAltRef.current = "";
  }, [controller, imageUpload]);

  const isLoading = controller.status === "idle" || controller.status === "loading";
  const isReady = controller.status === "ready" && controller.formState != null;
  const isError = controller.status === "error";
  const formState = controller.formState;

  const availableTags = controller.data?.tags ?? [];
  const isSaving = controller.saveState.status === "saving";
  const saveDisabled = controller.isSaveDisabled || isSaving;
  const rawText = formState?.rawText ?? "";
  const charCount = rawText.length;
  const parseStatus = formState?.aiStatus ?? "idle";
  const viewModel = useMemo(() => (formState ? mapRecipeFormStateToViewModel(formState) : null), [formState]);
  const selectedTagIds = viewModel?.tagIds ?? [];
  const isAnonymousSession = false;

  const leftColumnContent =
    formState && viewModel ? (
      <div className="flex flex-col gap-6">
        <SessionEphemeralBanner isAnonymous={isAnonymousSession} />
        <EditModeHeader variant="edit" />
        <RawTextSection
          rawText={rawText}
          charCount={charCount}
          maxChars={VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH}
          parseStatus={parseStatus}
          parseError={aiParse.error}
          isParseDisabled={isSaving}
          onRawTextChange={handleRawTextChange}
          onParse={handleParse}
          onCancelParse={handleCancelParse}
        />
        <RecipeEditForm
          formState={formState}
          validation={controller.validation}
          tags={availableTags}
          saveState={controller.saveState}
          isSaving={isSaving}
          isSaveDisabled={saveDisabled}
          imageUploading={imageUpload.uploading}
          imageError={imageUpload.error}
          onFieldChange={controller.updateField}
          onIngredientChange={controller.updateIngredient}
          onAddIngredient={controller.addIngredient}
          onRemoveIngredient={controller.removeIngredient}
          onReorderIngredients={controller.reorderIngredients}
          onToggleTag={controller.toggleTag}
          onSubmit={controller.submitUpdates}
          onDiscard={controller.resetToLastSaved}
          onTriggerImageSelect={handleTriggerImageSelect}
          onRemoveImage={handleImageRemove}
        />
      </div>
    ) : null;

  const rightColumnContent =
    formState && viewModel ? (
      <div className="book-page-surface flex flex-col overflow-hidden border border-[rgba(72,44,20,0.15)] bg-[rgba(255,253,244,0.9)] p-6 shadow-inner">
        <AIDraftPreview
          status={aiParse.status}
          error={aiParse.error}
          formState={viewModel}
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onToggleTag={controller.toggleTag}
          onTriggerImageSelect={handleTriggerImageSelect}
          onImageDrop={processImageFile}
          imageUploading={imageUpload.uploading}
        />
      </div>
    ) : null;

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
            {isLoading ? <LoadingState /> : null}
            {isError ? (
              <ErrorState message={controller.error ?? "Unable to load recipe."} onRetry={handleRetry} />
            ) : null}
            {isReady ? (
              <div className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="flex flex-col gap-6 overflow-y-auto pr-0 xl:pr-4">{leftColumnContent}</div>
                {rightColumnContent}
              </div>
            ) : null}
            {!isLoading && !isReady && !isError ? (
              <p className="text-sm text-[rgba(72,44,20,0.65)]">Preparing editor…</p>
            ) : null}
          </div>
        }
        toasts={<ToastHost />}
      />
    </>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry(): void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-[rgba(143,58,32,0.35)] bg-[rgba(255,244,238,0.9)] p-6 text-[rgba(107,36,18,0.9)]">
      <div>
        <p className="text-base font-semibold">We couldn't load that recipe.</p>
        <p className="text-sm text-[rgba(107,36,18,0.78)]">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-lg border border-[rgba(72,44,20,0.12)] bg-white/80 p-6">
      <div className="h-4 w-32 rounded-full bg-[rgba(72,44,20,0.12)]" />
      <div className="h-10 w-1/2 rounded-md bg-[rgba(72,44,20,0.12)]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-14 rounded-md bg-[rgba(72,44,20,0.12)]" />
        <div className="h-14 rounded-md bg-[rgba(72,44,20,0.12)]" />
        <div className="h-14 rounded-md bg-[rgba(72,44,20,0.12)]" />
      </div>
      <div className="h-40 rounded-lg bg-[rgba(72,44,20,0.12)]" />
    </div>
  );
}

export default RecipeEditPage;
