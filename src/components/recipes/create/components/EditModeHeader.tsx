import { Button } from '@/components/ui/button';

interface EditModeHeaderProps {
  cookbookTitle?: string;
  onBack?: () => void;
}

export function EditModeHeader({ cookbookTitle, onBack }: EditModeHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[rgba(72,44,20,0.2)] pb-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2">
          <span className="rounded-full bg-[rgba(72,44,20,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Edit Mode
          </span>
          {cookbookTitle ? (
            <span className="text-xs text-ink-soft">Adding to {cookbookTitle}</span>
          ) : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Create a New Recipe</h1>
          <p className="text-sm text-ink-soft">Paste raw text, let AI help, then refine the details before saving.</p>
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


