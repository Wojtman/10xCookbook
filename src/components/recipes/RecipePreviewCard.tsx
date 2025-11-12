import { useMemo, useState } from 'react';

import type { RecipePreviewVM } from '@/lib/types/recipePreview';
import { SkeletonLoader } from './SkeletonLoader';
import { TagChips } from './TagChips';

interface RecipePreviewCardProps {
  recipe?: RecipePreviewVM;
  side: 'left' | 'right';
  loading?: boolean;
}

export function RecipePreviewCard({ recipe, side, loading }: RecipePreviewCardProps) {
  const [imageErrored, setImageErrored] = useState(false);

  const headerAlignment = side === 'left' ? 'items-start text-left' : 'items-end text-right';
  const contentOrientation = side === 'right' ? 'lg:flex-row-reverse' : '';
  const placeholderLabel = side === 'left' ? 'Recipe placeholder (page 1)' : 'Recipe placeholder (page 2)';

  const imageAlt = useMemo(() => {
    if (!recipe) {
      return '';
    }
    if (recipe.imageAltText && recipe.imageAltText.trim().length > 0) {
      return recipe.imageAltText;
    }
    return `Photo of ${recipe.title}`;
  }, [recipe]);

  if (loading) {
    return (
      <article className="book-page-pane flex flex-1 flex-col px-6 py-8 md:px-8 md:py-10">
        <SkeletonLoader variant="card" />
      </article>
    );
  }

  if (!recipe) {
    return (
      <article className="book-page-pane flex flex-1 flex-col px-6 py-8 md:px-8 md:py-10">
        <div className="book-placeholder flex h-full flex-col items-center justify-center gap-3 rounded-lg p-8 text-center">
          <h3 className="text-base font-semibold text-ink">{placeholderLabel}</h3>
          <p className="text-sm text-ink-soft">
            Select a recipe from the menu to populate this page.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="book-page-pane flex flex-1 flex-col gap-6 px-6 py-8 md:px-8 md:py-10">
      <header className={`flex flex-wrap items-start justify-between gap-4 ${headerAlignment} ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <div className={`max-w-xl ${side === 'right' ? 'text-right' : ''}`}>
          <h2 className="text-2xl font-semibold text-ink">{recipe.title}</h2>
          {recipe.prepTimeMinutes ? (
            <p className="text-sm text-ink-soft">Prep time: {recipe.prepTimeMinutes} minutes</p>
          ) : null}
        </div>
        <div className="flex">
          <TagChips tags={recipe.tags} />
        </div>
      </header>

      <div className={`flex flex-col gap-6 lg:flex-row ${contentOrientation}`}>
        <div className="flex-1 space-y-4">
          <h3 className="text-lg font-semibold text-ink">Preparation Description</h3>
          <div className="h-[36rem] overflow-y-auto whitespace-pre-wrap rounded-md border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)] p-4 text-sm leading-relaxed text-ink-soft shadow-inner">
            {recipe.preparationDescription || 'No preparation description provided.'}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="overflow-hidden rounded-lg border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)]">
            {recipe.imageUrl && !imageErrored ? (
              <img
                src={recipe.imageUrl}
                alt={imageAlt}
                className="h-48 w-full object-cover"
                onError={() => setImageErrored(true)}
              />
            ) : (
              <div className="book-placeholder flex h-48 items-center justify-center rounded-none text-sm">
                Image unavailable
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-ink">Ingredients</h3>
            <ol className="mt-2 h-96 space-y-2 overflow-y-auto rounded-md border border-[rgba(148,110,60,0.25)] bg-[rgba(255,248,227,0.85)] p-3 text-sm text-ink-soft shadow-inner">
              {recipe.ingredients.length === 0 ? (
                <li className="italic text-ink-soft">No ingredients listed.</li>
              ) : (
                recipe.ingredients.map(ingredient => (
                  <li key={ingredient.id} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 flex-none rounded-full bg-[rgba(107,61,32,0.5)]" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-ink">{ingredient.name}</span>
                      {ingredient.quantity ? ` — ${ingredient.quantity}` : ''}
                      {ingredient.notes ? <span className="block text-xs text-ink-soft">{ingredient.notes}</span> : null}
                    </span>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      </div>
    </article>
  );
}

