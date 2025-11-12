import type { KeyboardEvent } from 'react';

import type { SidebarRecipeListItemVM } from '@/lib/types/recipe-preview';

interface RecipeListItemProps {
  item: SidebarRecipeListItemVM;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

export function RecipeListItem({ item, selected, onSelect, index }: RecipeListItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <li
      id={item.id}
      role="option"
      aria-selected={selected}
      data-index={index}
      className="outline-none focus-visible:ring-2 focus-visible:ring-[rgba(200,161,93,0.65)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      <div
        tabIndex={selected ? 0 : -1}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        data-selected={selected ? 'true' : 'false'}
        className="book-framed flex cursor-pointer flex-col gap-1 text-left text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(248,232,196,0.7)] focus-visible:outline-offset-2"
      >
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        <p className="text-xs text-ink-soft">
          {item.ingredientCount} ingredient{item.ingredientCount === 1 ? '' : 's'} • {item.tags.length} tag
          {item.tags.length === 1 ? '' : 's'}
        </p>
      </div>
    </li>
  );
}

