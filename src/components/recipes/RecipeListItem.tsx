import type { KeyboardEvent, MouseEvent } from "react";

import type { SidebarRecipeListItemVM } from "@/lib/types/recipePreview";

interface RecipeListItemProps {
  item: SidebarRecipeListItemVM;
  selected: boolean;
  onSelect: () => void;
  index: number;
  onDelete: () => void | Promise<void>;
  deleting?: boolean;
}

export function RecipeListItem({ item, selected, onSelect, index, onDelete, deleting }: RecipeListItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const handleEditClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (typeof window !== "undefined") {
      window.location.href = `/recipes/${item.id}/edit`;
    }
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    void onDelete();
  };

  return (
    <li
      id={item.id}
      role="option"
      aria-selected={selected}
      data-index={index}
      className="outline-none focus-visible:ring-2 focus-visible:ring-[rgba(200,161,93,0.65)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      <div className="book-framed flex cursor-pointer flex-col gap-2 text-left text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(248,232,196,0.7)] focus-visible:outline-offset-2">
        <div
          role="button"
          tabIndex={selected ? 0 : -1}
          onClick={onSelect}
          onKeyDown={handleKeyDown}
          data-selected={selected ? "true" : "false"}
          className="flex flex-col gap-1"
        >
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          <p className="text-xs text-ink-soft">
            {item.ingredientCount} ingredient{item.ingredientCount === 1 ? "" : "s"} • {item.tags.length} tag
            {item.tags.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            Updated {new Date(item.updatedAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-[rgba(72,44,20,0.2)] bg-[rgba(255,250,235,0.95)] px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-[rgba(72,44,20,0.35)] hover:bg-[rgba(255,246,220,0.95)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(248,232,196,0.7)] focus-visible:outline-offset-2"
              onClick={handleEditClick}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-full border border-[rgba(146,42,24,0.25)] bg-[rgba(255,240,240,0.95)] px-3 py-1 text-xs font-medium text-[rgba(123,27,19,0.95)] transition-colors hover:border-[rgba(146,42,24,0.45)] hover:bg-[rgba(255,228,228,0.95)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(248,232,196,0.7)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleDeleteClick}
              disabled={Boolean(deleting)}
              aria-label={`Delete recipe ${item.title}`}
              aria-busy={deleting ? "true" : undefined}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
