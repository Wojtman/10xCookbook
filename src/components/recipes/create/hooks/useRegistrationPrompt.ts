import { useCallback, useEffect, useMemo, useState } from "react";

import type { UseRegistrationPromptArgs, UseRegistrationPromptResult } from "../types";

const STORAGE_PREFIX = "10xCookbook.registrationPrompt";
const STORAGE_KEYS = {
  dismissed: `${STORAGE_PREFIX}.dismissed`,
  aiCount: `${STORAGE_PREFIX}.aiSuccessCount`,
  localCount: `${STORAGE_PREFIX}.localRecipeCount`,
  remindAfter: `${STORAGE_PREFIX}.remindAfter`,
} as const;

const REMIND_LATER_WINDOW_MS = 24 * 60 * 60 * 1000;

function readBooleanFromStorage(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const value = window.localStorage.getItem(key);
  return value === "true";
}

function readNumberFromStorage(key: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const value = window.localStorage.getItem(key);
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readTimestampFromStorage(key: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(key);
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function writeStorage(key: string, value: string | number | null | undefined): void {
  if (typeof window === "undefined") {
    return;
  }
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, String(value));
}

function canShowPrompt({
  isAnonymous,
  hasDismissed,
  visible,
  remindAfter,
  aiSuccessCount,
  localRecipeCount,
}: {
  isAnonymous: boolean;
  hasDismissed: boolean;
  visible: boolean;
  remindAfter: number | null;
  aiSuccessCount: number;
  localRecipeCount: number;
}): boolean {
  if (!isAnonymous || hasDismissed || visible) {
    return false;
  }

  if (remindAfter && remindAfter > Date.now()) {
    return false;
  }

  if (aiSuccessCount >= 1) {
    return true;
  }

  if (localRecipeCount >= 2) {
    return true;
  }

  return false;
}

export function useRegistrationPrompt({ isAnonymous }: UseRegistrationPromptArgs): UseRegistrationPromptResult {
  const [visible, setVisible] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);
  const [aiSuccessCount, setAiSuccessCount] = useState(0);
  const [localRecipeCount, setLocalRecipeCount] = useState(0);
  const [remindAfter, setRemindAfter] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setHasDismissed(readBooleanFromStorage(STORAGE_KEYS.dismissed));
    setAiSuccessCount(readNumberFromStorage(STORAGE_KEYS.aiCount));
    setLocalRecipeCount(readNumberFromStorage(STORAGE_KEYS.localCount));
    setRemindAfter(readTimestampFromStorage(STORAGE_KEYS.remindAfter));
  }, []);

  const open = useCallback(() => {
    if (!isAnonymous || hasDismissed) {
      return;
    }
    setVisible(true);
  }, [hasDismissed, isAnonymous]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setHasDismissed(true);
    writeStorage(STORAGE_KEYS.dismissed, "true");
  }, []);

  const remindLater = useCallback(() => {
    setVisible(false);
    const nextReminder = Date.now() + REMIND_LATER_WINDOW_MS;
    setRemindAfter(nextReminder);
    writeStorage(STORAGE_KEYS.remindAfter, nextReminder);
  }, []);

  const trackAiSuccess = useCallback(() => {
    setAiSuccessCount((prev) => {
      const next = prev + 1;
      writeStorage(STORAGE_KEYS.aiCount, next);
      return next;
    });
  }, []);

  const trackLocalRecipeCreated = useCallback(() => {
    setLocalRecipeCount((prev) => {
      const next = prev + 1;
      writeStorage(STORAGE_KEYS.localCount, next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (
      canShowPrompt({
        isAnonymous,
        hasDismissed,
        visible,
        remindAfter,
        aiSuccessCount,
        localRecipeCount,
      })
    ) {
      setVisible(true);
    }
  }, [aiSuccessCount, hasDismissed, isAnonymous, localRecipeCount, remindAfter, visible]);

  return useMemo(
    () => ({
      visible: isAnonymous ? visible : false,
      hasDismissed: isAnonymous ? hasDismissed : true,
      open,
      dismiss,
      remindLater,
      trackAiSuccess,
      trackLocalRecipeCreated,
    }),
    [dismiss, hasDismissed, isAnonymous, open, remindLater, trackAiSuccess, trackLocalRecipeCreated, visible]
  );
}
