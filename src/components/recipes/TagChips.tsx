import type { TagDTO } from '@/types';

interface TagChipsProps {
  tags: TagDTO[];
  emptyLabel?: string;
}

export function TagChips({ tags, emptyLabel = 'No tags yet.' }: TagChipsProps) {
  if (!tags || tags.length === 0) {
    return <span className="text-xs text-neutral-400">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(tag => {
        const label = tag.label?.trim() || tag.slug || 'Tag';
        const icon = tag.icon?.trim();
        const fallback = label.charAt(0)?.toUpperCase() ?? '?';

        return (
          <span
            key={tag.id}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-base text-neutral-700 transition-colors hover:bg-neutral-200 select-none"
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

