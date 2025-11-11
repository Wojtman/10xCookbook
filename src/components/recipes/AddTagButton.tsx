import { useId } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AddTagButtonProps {
  recipeId: string;
  isAnonymous: boolean;
  onAddTag: (recipeId: string) => void;
}

export function AddTagButton({ recipeId, isAnonymous, onAddTag }: AddTagButtonProps) {
  const tooltipId = useId();

  const handleClick = () => {
    if (isAnonymous) {
      return;
    }

    onAddTag(recipeId);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={handleClick}
        disabled={isAnonymous}
        aria-describedby={isAnonymous ? tooltipId : undefined}
        title={isAnonymous ? 'Sign in to add tags to this recipe.' : undefined}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add tag
      </Button>
      {isAnonymous && (
        <p id={tooltipId} role="tooltip" className="sr-only">
          Sign in to add tags
        </p>
      )}
    </div>
  );
}

