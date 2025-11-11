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
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div
        tabIndex={selected ? 0 : -1}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        className="flex cursor-pointer flex-col gap-1 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 aria-selected:border-primary aria-selected:bg-primary/5"
      >
        <p className="text-sm font-medium text-neutral-900">{item.title}</p>
        <p className="text-xs text-neutral-500">
          {item.ingredientCount} ingredient{item.ingredientCount === 1 ? '' : 's'} • {item.tags.length} tag
          {item.tags.length === 1 ? '' : 's'}
        </p>
      </div>
    </li>
  );
}

