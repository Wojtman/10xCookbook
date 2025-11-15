import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface SessionEphemeralBannerProps {
  isAnonymous: boolean;
  onDismiss?: () => void;
}

const STORAGE_KEY = "10xCookbook.recipeCreate.sessionBannerDismissed";

export function SessionEphemeralBanner({ isAnonymous, onDismiss }: SessionEphemeralBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setDismissed(true);
    }
  }, []);

  if (!isAnonymous || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "true");
    }
    onDismiss?.();
  };

  return (
    <div className="rounded-md border border-dashed border-[rgba(148,110,60,0.4)] bg-[rgba(248,231,193,0.85)] px-5 py-4 text-sm text-ink-soft shadow-book">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-ink">You are working in a temporary session.</p>
          <p className="max-w-prose text-sm text-ink-soft">
            Recipes you create here live only in this browser. Register or sign in to keep them forever.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
