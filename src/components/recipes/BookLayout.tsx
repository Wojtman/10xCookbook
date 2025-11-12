import type { ReactNode } from 'react';

interface BookLayoutProps {
  banner?: ReactNode;
  sidebar?: ReactNode;
  spread?: ReactNode;
  toasts?: ReactNode;
}

export function BookLayout({ banner, sidebar, spread, toasts }: BookLayoutProps) {
  return (
    <div className="book-shell flex min-h-screen flex-col gap-6">
      {banner}
      <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-[300px_1fr] md:gap-8">
        <aside className="book-page-surface flex flex-col overflow-hidden shadow-book">
          {sidebar}
        </aside>
        <main className="book-page-surface flex flex-1 flex-col overflow-hidden shadow-book">{spread}</main>
      </div>
      {toasts}
    </div>
  );
}

