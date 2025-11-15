import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import type { TagDTO } from "@/types";
import type { AIParseError, AIParseStatus, RecipeFormViewModel } from "../types";
import type { RecipePreviewVM } from "@/lib/types/recipePreview";

interface AIDraftPreviewProps {
  status: AIParseStatus;
  error?: AIParseError;
  formState: RecipeFormViewModel;
  availableTags: TagDTO[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onTriggerImageSelect: () => void;
  onImageDrop: (file: File) => void;
  imageUploading: boolean;
}

export function AIDraftPreview({
  status,
  error,
  formState,
  availableTags,
  selectedTagIds,
  onToggleTag,
  onTriggerImageSelect,
  onImageDrop,
  imageUploading,
}: AIDraftPreviewProps) {
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  const title = formState.title.trim() || "Untitled Recipe";
  const description =
    formState.preparationDescription.trim() ||
    "Start by describing how to prepare this dish. The preview updates as you type.";

  const selectedTags = useMemo(
    () => availableTags.filter((tag) => selectedTagIds.includes(tag.id)),
    [availableTags, selectedTagIds]
  );

  const previewIngredients = useMemo<RecipePreviewVM["ingredients"]>(() => {
    return formState.ingredients
      .filter((ingredient) => ingredient.name.trim().length > 0)
      .map((ingredient, index) => ({
        id: ingredient.id,
        display_order: index,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity?.trim() ?? null,
        notes: ingredient.notes?.trim() ?? null,
        recipe_id: "preview",
        created_at: "",
        updated_at: "",
        ingredient_id: ingredient.ingredient_id ?? null,
      }));
  }, [formState.ingredients]);

  const previewRecipe: RecipePreviewVM = useMemo(
    () => ({
      id: "preview",
      title,
      preparationDescription: description,
      imageUrl: formState.image?.image_url ?? null,
      imageAltText: formState.imageAltText.trim() || title,
      ingredients: previewIngredients,
      tags: selectedTags,
      prepTimeMinutes: formState.prepTimeMinutes ?? null,
    }),
    [
      description,
      formState.image?.image_url,
      formState.imageAltText,
      formState.prepTimeMinutes,
      previewIngredients,
      selectedTags,
      title,
    ]
  );

  const handlePlusClick = () => {
    setIsTagMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isTagMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setIsTagMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTagMenuOpen]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        onImageDrop(file);
      }
    },
    [onImageDrop]
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
  };

  const tagChipClass =
    "book-tag inline-flex h-9 w-9 items-center justify-center rounded-full text-base transition-transform hover:-translate-y-[1px]";

  return (
    <article className="relative flex h-full flex-col">
      {status === "loading" ? <PreviewScrim label="Parsing with AI…" /> : null}
      {error && status !== "loading" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-[rgba(248,232,196,0.88)] p-6 text-center text-[rgba(143,58,32,0.9)] shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">AI parse failed</p>
          <p className="text-sm leading-relaxed">{error.message}</p>
        </div>
      ) : null}

      <div className="book-page-pane flex flex-1 flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold text-ink">{previewRecipe.title}</h2>
            {previewRecipe.prepTimeMinutes ? (
              <p className="text-sm text-ink-soft">Prep time: {previewRecipe.prepTimeMinutes} minutes</p>
            ) : null}
          </div>
          <div className="relative flex items-center">
            <div className="flex flex-wrap items-center gap-2">
              {selectedTags.length > 0 ? (
                selectedTags.map((tag) => {
                  const label = tag.label?.trim() || tag.slug || "Tag";
                  const icon = tag.icon?.trim();
                  const fallback = label.charAt(0)?.toUpperCase() ?? "?";

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${tagChipClass} border border-[rgba(72,44,20,0.25)] bg-[rgba(72,44,20,0.08)] text-ink`}
                      title={`Remove ${label}`}
                      onClick={() => onToggleTag(tag.id)}
                    >
                      <span className="select-none">{icon && icon.length > 0 ? icon : fallback}</span>
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-ink-soft">No tags yet.</span>
              )}

              <button
                type="button"
                className={`${tagChipClass} border border-dashed border-[rgba(72,44,20,0.35)] bg-transparent text-lg text-ink-soft hover:text-ink`}
                onClick={handlePlusClick}
                aria-haspopup="true"
                aria-expanded={isTagMenuOpen}
                aria-label="Add tags"
              >
                +
              </button>
            </div>

            {isTagMenuOpen ? (
              <div
                ref={tagMenuRef}
                className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border border-[rgba(72,44,20,0.2)] bg-[rgba(255,253,246,0.98)] p-3 shadow-lg"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">Toggle Tags</p>
                <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto pr-1">
                  {availableTags.map((tag) => {
                    const label = tag.label?.trim() || tag.slug || "Tag";
                    const icon = tag.icon?.trim();
                    const fallback = label.charAt(0)?.toUpperCase() ?? "?";
                    const isSelected = selectedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`book-tag inline-flex h-9 w-9 items-center justify-center rounded-full text-base transition ${
                          isSelected
                            ? "bg-[rgba(72,44,20,0.15)] text-ink"
                            : "bg-[rgba(255,252,244,0.75)] text-ink-soft hover:bg-[rgba(248,232,196,0.4)] hover:text-ink"
                        }`}
                        title={label}
                        onClick={() => onToggleTag(tag.id)}
                      >
                        <span className="select-none">{icon && icon.length > 0 ? icon : fallback}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="book-divider grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-ink">Preparation Description</h3>
            <div className="h-[36rem] overflow-y-auto whitespace-pre-wrap rounded-md border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)] p-4 text-sm leading-relaxed text-ink-soft shadow-inner">
              {previewRecipe.preparationDescription}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div
              className="relative overflow-hidden rounded-lg border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)]"
              onClick={onTriggerImageSelect}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onTriggerImageSelect();
                }
              }}
            >
              {previewRecipe.imageUrl ? (
                <img
                  src={previewRecipe.imageUrl}
                  alt={previewRecipe.imageAltText ?? previewRecipe.title}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                  <span className="text-xs uppercase tracking-[0.18em] text-ink-faint">
                    Click or drop an image to upload
                  </span>
                </div>
              )}
              {imageUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(28,19,10,0.3)] text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(255,248,227,0.95)]">
                  Uploading…
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-ink">Ingredients</h3>
              <ol className="mt-2 h-96 space-y-2 overflow-y-auto rounded-md border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)] p-3 text-sm text-ink-soft shadow-inner">
                {previewRecipe.ingredients.length === 0 ? (
                  <li className="italic text-ink-soft">Add ingredients to see them here.</li>
                ) : (
                  previewRecipe.ingredients.map((ingredient, index) => (
                    <li key={ingredient.id} className="flex items-start gap-2">
                      <span
                        className="mt-1 size-1.5 flex-none rounded-full bg-[rgba(107,61,32,0.5)]"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="font-medium text-ink">{ingredient.name}</span>
                        {ingredient.quantity ? ` — ${ingredient.quantity}` : ""}
                        {ingredient.notes ? (
                          <span className="block text-xs text-ink-soft">{ingredient.notes}</span>
                        ) : null}
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

function PreviewScrim({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl bg-[rgba(28,19,10,0.25)] text-center text-sm font-medium uppercase tracking-[0.18em] text-[rgba(255,248,227,0.95)] backdrop-blur-[2px]">
      {label}
      <span className="text-xs normal-case tracking-normal text-[rgba(255,248,227,0.75)]">
        Live preview will resume shortly
      </span>
    </div>
  );
}
