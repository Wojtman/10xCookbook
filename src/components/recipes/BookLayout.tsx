import type { ReactNode } from 'react';

interface BookLayoutProps {
  banner?: ReactNode;
  sidebar?: ReactNode;
  spread?: ReactNode;
  toasts?: ReactNode;
}

export function BookLayout({ banner, sidebar, spread, toasts }: BookLayoutProps) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-neutral-50 text-neutral-900">
      {banner && <div className="border-b border-neutral-200 bg-white px-6 py-4">{banner}</div>}
      <div className="flex flex-1 flex-col md:grid md:grid-cols-[256px_1fr]">
        <aside className="border-b border-neutral-200 bg-white md:border-b-0 md:border-r md:border-neutral-200">
          {sidebar}
        </aside>
        <main className="flex flex-1 flex-col">{spread}</main>
      </div>
      {toasts}
    </div>
  );
}

