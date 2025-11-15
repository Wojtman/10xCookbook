import { Button } from "@/components/ui/button";

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
      className="book-wood-panel mt-auto flex items-center justify-between gap-4 shadow-book"
    >
      <Button type="button" size="lg" onClick={onPrev} disabled={!hasPrev}>
        Previous page
      </Button>
      <span className="text-sm font-semibold uppercase tracking-[0.2em]">Page {page}</span>
      <Button type="button" size="lg" onClick={onNext} disabled={!hasNext}>
        Next page
      </Button>
    </nav>
  );
}
