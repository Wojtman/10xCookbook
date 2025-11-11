import { useMemo, useState } from 'react';

import type { RecipePreviewVM } from '@/lib/types/recipe-preview';
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
      <article className="flex flex-1 flex-col px-6 py-8">
        <SkeletonLoader variant="card" />
      </article>
    );
  }

  if (!recipe) {
    return (
      <article className="flex flex-1 flex-col px-6 py-8">
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center text-neutral-500">
          <h3 className="text-base font-semibold text-neutral-600">{placeholderLabel}</h3>
          <p className="text-sm text-neutral-500">
            Select a recipe from the menu to populate this page.
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className={`flex flex-wrap items-start justify-between gap-4 ${headerAlignment} ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <div className={`max-w-xl ${side === 'right' ? 'text-right' : ''}`}>
          <h2 className="text-2xl font-semibold text-neutral-900">{recipe.title}</h2>
          {recipe.prepTimeMinutes ? (
            <p className="text-sm text-neutral-500">Prep time: {recipe.prepTimeMinutes} minutes</p>
          ) : null}
        </div>
        <div className="flex">
          <TagChips tags={recipe.tags} />
        </div>
      </header>

      <div className={`flex flex-col gap-6 lg:flex-row ${contentOrientation}`}>
        <div className="flex-1 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-800">Description</h3>
          <div className="h-[36rem] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
            {recipe.description || 'No description provided.'}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {recipe.imageUrl && !imageErrored ? (
              <img
                src={recipe.imageUrl}
                alt={imageAlt}
                className="h-48 w-full object-cover"
                onError={() => setImageErrored(true)}
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-neutral-100 text-sm text-neutral-500">
                Image unavailable
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-neutral-800">Ingredients</h3>
            <ol className="mt-2 h-96 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
              {recipe.ingredients.length === 0 ? (
                <li className="italic text-neutral-500">No ingredients listed.</li>
              ) : (
                recipe.ingredients.map(ingredient => (
                  <li key={ingredient.id} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 flex-none rounded-full bg-neutral-400" aria-hidden="true" />
                    <span>
                      <span className="font-medium">{ingredient.name}</span>
                      {ingredient.quantity ? ` — ${ingredient.quantity}` : ''}
                      {ingredient.notes ? <span className="block text-xs text-neutral-500">{ingredient.notes}</span> : null}
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

