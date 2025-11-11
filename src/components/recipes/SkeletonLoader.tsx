import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  variant: 'sidebar' | 'card';
  count?: number;
  className?: string;
}

export function SkeletonLoader({ variant, count = 1, className }: SkeletonLoaderProps) {
  if (variant === 'sidebar') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-md bg-neutral-100" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-neutral-100" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-4 animate-pulse rounded bg-neutral-100" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
    </div>
  );
}

