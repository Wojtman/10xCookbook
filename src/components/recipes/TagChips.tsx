import type { TagDTO } from "@/types";

interface TagChipsProps {
  tags: TagDTO[];
  emptyLabel?: string;
}

export function TagChips({ tags, emptyLabel = "No tags yet." }: TagChipsProps) {
  if (!tags || tags.length === 0) {
    return <span className="text-xs text-ink-soft">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const label = tag.label?.trim() || tag.slug || "Tag";
        const icon = tag.icon?.trim();
        const fallback = label.charAt(0)?.toUpperCase() ?? "?";

        return (
          <span
            key={tag.id}
            className="book-tag inline-flex h-9 w-9 select-none items-center justify-center rounded-full text-base transition-transform hover:-translate-y-[1px]"
            title={label}
            aria-label={label}
            role="img"
          >
            <span className="select-none">{icon && icon.length > 0 ? icon : fallback}</span>
          </span>
        );
      })}
    </div>
  );
}
