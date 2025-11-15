import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TagDTO } from "@/types";

interface TagDropdownProps {
  availableTags: TagDTO[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
}

export function TagDropdown({ availableTags, selectedTagIds, onToggle }: TagDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedTags = useMemo(
    () =>
      availableTags
        .filter((tag) => selectedTagIds.includes(tag.id))
        .map((tag) => ({
          id: tag.id,
          label: tag.label,
          icon: tag.icon,
        })),
    [availableTags, selectedTagIds]
  );

  const toggleTag = (tagId: string) => {
    onToggle(tagId);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-w-[160px] justify-between"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          Tags
          {selectedTags.length > 0 ? (
            <span className="rounded-full bg-[rgba(72,44,20,0.1)] px-2 py-0.5 text-[11px] text-ink">
              {selectedTags.length}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="text-lg leading-none text-ink-soft">
          ▾
        </span>
      </Button>

      {open ? (
        <div className="absolute z-20 mt-2 w-56 rounded-md border border-[rgba(72,44,20,0.18)] bg-[rgba(255,253,246,0.98)] p-3 shadow-lg">
          <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto pr-1">
            {availableTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  type="button"
                  key={tag.id}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                    isSelected
                      ? "border-[rgba(72,44,20,0.6)] bg-[rgba(72,44,20,0.15)] text-ink"
                      : "border-[rgba(72,44,20,0.12)] bg-[rgba(255,252,244,0.6)] text-ink-soft hover:border-[rgba(72,44,20,0.3)] hover:text-ink"
                  }`}
                  onClick={() => toggleTag(tag.id)}
                  title={tag.label}
                >
                  <span aria-hidden="true" className="text-base">
                    {tag.icon ?? "🏷️"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-center text-xs text-ink-soft">
            Hover icons to read labels. Click to toggle selection.
          </div>
        </div>
      ) : null}

      {selectedTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-soft">
          {selectedTags.map((tag) => (
            <span key={tag.id} className="flex items-center gap-1 rounded-full bg-[rgba(72,44,20,0.1)] px-2 py-1">
              <span aria-hidden="true">{tag.icon ?? "🏷️"}</span>
              <span>{tag.label}</span>
              <button
                type="button"
                className="ml-1 text-[10px] uppercase tracking-[0.2em] text-ink-faint"
                onClick={() => toggleTag(tag.id)}
                aria-label={`Remove ${tag.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
