import { useState } from "react";

import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  redirectTo?: string;
  className?: string;
}

export function LogoutButton({ redirectTo = "/auth/login", className }: LogoutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = await resolveErrorMessage(response);
        throw new Error(message);
      }

      window.location.assign(redirectTo);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to sign out right now.";
      setError(message);
      setIsSigningOut(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <button
        type="button"
        className={cn(
          "rounded border border-ink/10 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink transition",
          "hover:bg-white/20 hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          "disabled:cursor-not-allowed disabled:opacity-70"
        )}
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}

async function resolveErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) {
      return data.error;
    }
  } catch {
    // Swallow JSON parsing errors to fall back to default message below.
  }

  switch (response.status) {
    case 401:
    case 403:
      return "Your session is no longer valid. Please sign in again.";
    default:
      return "Failed to sign out. Please try again.";
  }
}
