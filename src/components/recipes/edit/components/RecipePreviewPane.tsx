import { useMemo } from "react";

import type { AIParseResponseDTO, RecipeDetailDTO, TagDTO } from "@/types";

import type { PreviewSource } from "../types";

interface RecipePreviewPaneProps {
  recipe?: RecipeDetailDTO | null;
  draft: AIParseResponseDTO | null;
  source: PreviewSource;
  onSourceChange(next: PreviewSource): void;
  aiStatus: "idle" | "loading" | "success" | "timeout" | "error";
  tags: TagDTO[];
}

export function RecipePreviewPane({ recipe, draft, source, onSourceChange, aiStatus, tags }: RecipePreviewPaneProps) {
  const tagIndex = useMemo(() => {
    return new Map(tags.map((tag) => [tag.slug, tag]));
  }, [tags]);

  const draftTags = useMemo(() => {
    if (!draft) {
      return [];
    }
    return draft.suggested_tags.map((slug) => tagIndex.get(slug)).filter((tag): tag is TagDTO => Boolean(tag));
  }, [draft, tagIndex]);

  const renderTag = (tag: TagDTO, key?: string) => {
    const label = tag.label ?? tag.slug ?? "Tag";
    const icon = tag.icon;
    return (
      <span
        key={key ?? tag.id}
        className="inline-flex items-center gap-1 rounded-full border border-[rgba(72,44,20,0.2)] bg-[rgba(255,252,244,0.85)] px-3 py-1 text-xs text-ink-soft"
      >
        <span aria-hidden="true">{icon ?? "🏷️"}</span>
        <span>{label}</span>
      </span>
    );
  };

  const renderIngredients = (items: { name: string; quantity?: string | null; notes?: string | null }[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-[rgba(72,44,20,0.6)]">No ingredients available.</p>;
    }
    return (
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-start gap-2 text-sm text-[rgba(72,44,20,0.78)]">
            <span className="mt-1 size-1.5 flex-none rounded-full bg-[rgba(72,44,20,0.45)]" aria-hidden="true" />
            <span>
              <span className="font-medium text-[rgba(72,44,20,0.92)]">{item.name}</span>
              {item.quantity ? <span className="text-[rgba(72,44,20,0.7)]"> — {item.quantity}</span> : null}
              {item.notes ? <span className="block text-xs italic text-[rgba(72,44,20,0.6)]">{item.notes}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  const isDraftAvailable = Boolean(draft);

  return (
    <aside className="book-page-surface relative flex flex-col overflow-hidden border border-[rgba(72,44,20,0.15)] bg-[rgba(255,253,244,0.9)] p-6 shadow-inner">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(72,44,20,0.15)] pb-4">
        <div className="flex items-center gap-2">
          <ToggleButton
            active={source === "current"}
            onClick={() => onSourceChange("current")}
            label="Current Recipe"
          />
          <ToggleButton
            active={source === "aiDraft"}
            onClick={() => onSourceChange("aiDraft")}
            label="AI Draft"
            disabled={!isDraftAvailable}
          />
        </div>
        <span className="rounded-full bg-[rgba(72,44,20,0.12)] px-3 py-1 text-xs font-medium text-[rgba(72,44,20,0.7)]">
          {source === "aiDraft"
            ? aiStatus === "loading"
              ? "Parsing with AI…"
              : isDraftAvailable
                ? "AI suggestions ready"
                : "Run AI parse to generate draft"
            : "Showing latest saved recipe"}
        </span>
      </header>

      <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-[rgba(72,44,20,0.1)] bg-white/80 p-5">
        {source === "aiDraft" ? (
          draft ? (
            <DraftContent draft={draft} tags={draftTags} renderIngredients={renderIngredients} renderTag={renderTag} />
          ) : (
            <EmptyState
              title="No AI draft yet"
              description="Paste raw recipe text and run Parse with AI to generate a structured draft."
            />
          )
        ) : recipe ? (
          <RecipeContent recipe={recipe} renderIngredients={renderIngredients} renderTag={renderTag} />
        ) : (
          <EmptyState
            title="Recipe data unavailable"
            description="We could not load the saved recipe details. Try reloading the page after saving."
          />
        )}
      </div>
      {source === "aiDraft" && aiStatus === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(28,19,10,0.25)] text-center text-sm font-medium uppercase tracking-[0.18em] text-[rgba(255,248,227,0.95)] backdrop-blur-[2px]">
          Parsing with AI…
          <span className="text-xs normal-case tracking-normal text-[rgba(255,248,227,0.75)]">
            Live preview will resume shortly
          </span>
        </div>
      ) : null}
    </aside>
  );
}

function ToggleButton({
  active,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] transition ${
        active
          ? "border border-[rgba(72,44,20,0.4)] bg-[rgba(72,44,20,0.15)] text-[rgba(72,44,20,0.92)]"
          : "border border-transparent bg-[rgba(72,44,20,0.08)] text-[rgba(72,44,20,0.6)] hover:border-[rgba(72,44,20,0.25)] hover:text-[rgba(72,44,20,0.9)]"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {label}
    </button>
  );
}

function RecipeContent({
  recipe,
  renderIngredients,
  renderTag,
}: {
  recipe: RecipeDetailDTO;
  renderIngredients: (items: { name: string; quantity?: string | null; notes?: string | null }[]) => React.ReactNode;
  renderTag: (tag: TagDTO) => React.ReactNode;
}) {
  return (
    <article className="space-y-5 text-[rgba(72,44,20,0.82)]">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-[rgba(72,44,20,0.95)]">{recipe.title}</h2>
        {recipe.prep_time_minutes != null ? (
          <p className="text-sm text-[rgba(72,44,20,0.65)]">Prep time: {recipe.prep_time_minutes} minutes</p>
        ) : null}
        {recipe.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">{recipe.tags.map((tag) => renderTag(tag))}</div>
        ) : null}
      </header>
      {recipe.image_url ? (
        <figure className="overflow-hidden rounded-lg border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)]">
          <img src={recipe.image_url} alt={recipe.image_alt_text ?? recipe.title} className="w-full object-cover" />
        </figure>
      ) : null}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[rgba(72,44,20,0.9)]">Preparation</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[rgba(72,44,20,0.75)]">
          {recipe.preparation_description}
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[rgba(72,44,20,0.9)]">Ingredients</h3>
        {renderIngredients(
          recipe.ingredients.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            notes: item.notes,
          }))
        )}
      </section>
    </article>
  );
}

function DraftContent({
  draft,
  tags,
  renderIngredients,
  renderTag,
}: {
  draft: AIParseResponseDTO;
  tags: TagDTO[];
  renderIngredients: (items: { name: string; quantity?: string | null; notes?: string | null }[]) => React.ReactNode;
  renderTag: (tag: TagDTO, key?: string) => React.ReactNode;
}) {
  return (
    <article className="space-y-5 text-[rgba(72,44,20,0.82)]">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-[rgba(72,44,20,0.95)]">{draft.title || "AI suggested title"}</h2>
        {draft.prep_time_minutes != null ? (
          <p className="text-sm text-[rgba(72,44,20,0.65)]">Suggested prep time: {draft.prep_time_minutes} minutes</p>
        ) : null}
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => renderTag(tag, `draft-${tag.id}`))}</div>
        ) : draft.suggested_tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.suggested_tags.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgba(72,44,20,0.25)] bg-transparent px-3 py-1 text-xs text-[rgba(72,44,20,0.6)]"
              >
                {slug}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[rgba(72,44,20,0.9)]">Preparation</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[rgba(72,44,20,0.75)]">
          {draft.preparation_description || "AI did not provide preparation instructions."}
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[rgba(72,44,20,0.9)]">Ingredients</h3>
        {renderIngredients(
          draft.ingredients.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            notes: item.notes,
          }))
        )}
      </section>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[rgba(72,44,20,0.65)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</p>
      <p className="max-w-xs text-sm leading-relaxed">{description}</p>
    </div>
  );
}

export default RecipePreviewPane;
