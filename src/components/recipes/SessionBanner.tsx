import { Children, type PropsWithChildren, type ReactNode } from "react";

export interface SessionBannerProps {
  visible: boolean;
  message?: string;
}

/**
 * Temporary session banner placeholder.
 * TODO: Replace with full design implementation in a later step.
 */
const DEFAULT_SESSION_MESSAGE = "You are viewing recipes in a temporary session. Sign in to save changes.";

function hasRenderableChildren(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (child === null || child === undefined) {
      return false;
    }
    if (typeof child === "boolean") {
      return false;
    }
    if (typeof child === "string") {
      return child.trim().length > 0;
    }
    return true;
  });
}

export function SessionBanner({ visible, message, children }: PropsWithChildren<SessionBannerProps>) {
  const resolvedMessage = message ?? DEFAULT_SESSION_MESSAGE;
  const trimmedMessage = resolvedMessage.trim();
  const hasMessage = trimmedMessage.length > 0;
  const hasChildren = hasRenderableChildren(children);

  if (!visible || (!hasMessage && !hasChildren)) {
    return null;
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="book-page-pane border border-dashed border-[rgba(148,110,60,0.35)] bg-[rgba(248,231,193,0.75)] px-6 py-4 text-sm text-ink-soft shadow-book md:px-8"
    >
      {hasMessage ? <p>{trimmedMessage}</p> : null}
      {hasChildren ? <div className="flex flex-wrap gap-3">{Children.toArray(children)}</div> : null}
    </section>
  );
}
