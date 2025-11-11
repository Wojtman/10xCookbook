import { Button } from '@/components/ui/button';

interface SpreadNavigationProps {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function SpreadNavigation({ page, hasPrev, hasNext, onPrev, onNext }: SpreadNavigationProps) {
  return (
    <nav
      aria-label="Recipe spread navigation"
      className="flex items-center justify-between border-t border-neutral-200 bg-white px-6 py-4"
    >
      <Button type="button" variant="outline" onClick={onPrev} disabled={!hasPrev}>
        Previous page
      </Button>
      <span className="text-sm font-medium text-neutral-600">Page {page}</span>
      <Button type="button" variant="outline" onClick={onNext} disabled={!hasNext}>
        Next page
      </Button>
    </nav>
  );
}

