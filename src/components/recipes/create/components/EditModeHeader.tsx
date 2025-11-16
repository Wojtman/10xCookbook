import { Button } from "@/components/ui/button";

interface EditModeHeaderProps {
  cookbookTitle?: string;
  onBack?: () => void;
  variant?: "create" | "edit";
  title?: string;
  description?: string;
  badgeLabel?: string;
}

export function EditModeHeader({
  cookbookTitle,
  onBack,
  variant = "create",
  title,
  description,
  badgeLabel,
}: EditModeHeaderProps) {
  const resolvedBadge = badgeLabel ?? (variant === "edit" ? "Edit Mode" : "Create Mode");
  const resolvedTitle = title ?? (variant === "edit" ? "Edit Recipe" : "Create a New Recipe");
  const resolvedDescription = "";

  return (
    <header className="flex flex-col gap-4 border-b border-[rgba(72,44,20,0.2)] pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2">
          <span className="rounded-full bg-[rgba(72,44,20,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            {resolvedBadge}
          </span>
          {cookbookTitle ? <span className="text-xs text-ink-soft">Adding to {cookbookTitle}</span> : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink">{resolvedTitle}</h1>
          <p className="text-sm text-ink-soft">{resolvedDescription}</p>
        </div>
      </div>
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to cookbook
        </Button>
      ) : null}
    </header>
  );
}
