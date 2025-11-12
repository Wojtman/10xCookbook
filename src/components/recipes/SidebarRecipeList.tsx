import { useCallback, useRef } from 'react';

import type { KeyboardEvent } from 'react';

import * as ScrollArea from '@radix-ui/react-scroll-area';

import type { SidebarRecipeListItemVM } from '@/lib/types/recipe-preview';

import { EmptyState } from './EmptyState';
import { RecipeListItem } from './RecipeListItem';
import { SkeletonLoader } from './SkeletonLoader';

interface SidebarRecipeListProps {
  items: SidebarRecipeListItemVM[];
  selectedRecipeId?: string;
  onSelectRecipe: (recipeId: string, index: number) => void;
  loading?: boolean;
  error?: string;
}

export function SidebarRecipeList({ items, selectedRecipeId, onSelectRecipe, loading, error }: SidebarRecipeListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const selectByIndex = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        onSelectRecipe(item.id, index);
      }
    },
    [items, onSelectRecipe]
  );

  const focusItem = useCallback((index: number) => {
    const root = listRef.current;
    if (!root) {
      return;
    }
    const target = root.querySelector<HTMLElement>(`[role="option"][data-index="${index}"] > div`);
    target?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      if (loading || items.length === 0) {
        return;
      }

      const currentIndex = items.findIndex(item => item.id === selectedRecipeId);
      const lastIndex = items.length - 1;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex >= 0 ? Math.min(currentIndex + 1, lastIndex) : 0;
        focusItem(nextIndex);
        selectByIndex(nextIndex);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex >= 0 ? Math.max(currentIndex - 1, 0) : 0;
        focusItem(prevIndex);
        selectByIndex(prevIndex);
      } else if (event.key === 'Home') {
        event.preventDefault();
        focusItem(0);
        selectByIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        focusItem(lastIndex);
        selectByIndex(lastIndex);
      }
    },
    [focusItem, items, loading, selectByIndex, selectedRecipeId]
  );

  return (
    <div className="flex h-full flex-col">
      <header className="book-wood-panel shadow-book">
        <h2 className="book-burned-text text-sm">Recipes</h2>
      </header>
      <div className="flex-1">
        {loading ? (
          <div className="px-5 py-6">
            <SkeletonLoader variant="sidebar" count={6} />
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-sm text-ink-soft">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              title="No recipes found"
              description="Adjust your filters or add a new recipe to this cookbook."
            />
          </div>
        ) : (
          <ScrollArea.Root type="auto" className="book-scroll-area h-full">
            <ScrollArea.Viewport className="h-full">
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Recipe list"
                aria-activedescendant={selectedRecipeId}
                tabIndex={0}
                className="flex flex-col gap-2 px-5 py-5 outline-none"
                onKeyDown={handleKeyDown}
              >
                {items.map((item, index) => (
                  <RecipeListItem
                    key={item.id}
                    item={item}
                    selected={item.id === selectedRecipeId}
                    onSelect={() => onSelectRecipe(item.id, index)}
                    index={index}
                  />
                ))}
              </ul>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" className="book-scrollbar flex touch-none select-none">
              <ScrollArea.Thumb className="book-scroll-thumb relative flex-1" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        )}
      </div>
    </div>
  );
}

