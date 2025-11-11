import type { PropsWithChildren } from 'react';

export interface SessionBannerProps {
  visible: boolean;
  message?: string;
}

/**
 * Temporary session banner placeholder.
 * TODO: Replace with full design implementation in a later step.
 */
export function SessionBanner({ visible, message, children }: PropsWithChildren<SessionBannerProps>) {
  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-dashed border-orange-300 bg-orange-50 px-4 py-2 text-sm text-orange-900"
    >
      <p>{message ?? 'You are viewing recipes in a temporary session. Sign in to save changes.'}</p>
      {children}
    </div>
  );
}

