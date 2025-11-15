import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { VALIDATION_CONSTANTS } from "@/types";

import type { AIParseError, AIParseStatus, UseAIParseArgs, UseAIParseResult } from "../types";
import type { AIParseResponseDTO } from "@/types";

const MAX_TEXT_LENGTH = VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH;

interface ApiErrorResponse {
  error?: string;
  message?: string;
  timeout_ms?: number;
  retry_after?: number;
  fields?: string[];
}

export function useAIParse({
  sessionId,
  analyticsSessionId,
  onSuccess,
  onError,
}: UseAIParseArgs = {}): UseAIParseResult {
  const [status, setStatus] = useState<AIParseStatus>("idle");
  const [error, setError] = useState<AIParseError | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState<number | undefined>(undefined);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestId = useRef(0);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus("idle");
    }
  }, []);

  const parse = useCallback<UseAIParseResult["parse"]>(
    async (rawText) => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        const validationError: AIParseError = {
          code: "validation_error",
          message: "Please provide recipe text before parsing.",
        };
        setError(validationError);
        setStatus("error");
        onError?.(validationError);
        return null;
      }

      const payload: Record<string, unknown> = {
        raw_text: trimmed.slice(0, MAX_TEXT_LENGTH),
      };

      const sessionIdentifier = sessionId ?? analyticsSessionId ?? undefined;
      if (sessionIdentifier) {
        payload.session_id = sessionIdentifier;
      }

      cancel();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestId = ++activeRequestId.current;

      setStatus("loading");
      setError(undefined);
      setElapsedMs(undefined);

      const startedAt = performance.now ? performance.now() : Date.now();

      try {
        const response = await fetch("/api/ai/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (activeRequestId.current !== requestId) {
          return null;
        }

        const endedAt = performance.now ? performance.now() : Date.now();
        const duration = Math.max(0, Math.round(endedAt - startedAt));
        setElapsedMs(duration);

        if (response.ok) {
          const result = (await response.json()) as AIParseResponseDTO;
          setStatus("success");
          setError(undefined);
          onSuccess?.(result);
          return result;
        }

        const errorBody = (await safeParseJson<ApiErrorResponse>(response)) ?? {};

        if (response.status === 408 || errorBody.error === "parse_timeout") {
          const timeoutError: AIParseError = {
            code: "timeout",
            message: errorBody.message ?? "AI parsing timed out. Try reducing the amount of text and retry.",
          };
          setStatus("timeout");
          setError(timeoutError);
          onError?.(timeoutError);
          return null;
        }

        const errorCode =
          errorBody.error ??
          (response.status === 429
            ? "rate_limit_exceeded"
            : response.status === 400
              ? "validation_error"
              : "parse_error");

        const message =
          errorBody.message ??
          (errorCode === "rate_limit_exceeded"
            ? "Too many AI parse requests. Please wait a moment before trying again."
            : errorCode === "validation_error"
              ? "Recipe text failed validation. Please review the content and try again."
              : "Unable to parse recipe text at this time. Please try again later.");

        const apiError: AIParseError = {
          code: errorCode,
          message,
        };

        setStatus("error");
        setError(apiError);
        onError?.(apiError);
        return null;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }

        const unknownError: AIParseError = {
          code: "parse_error",
          message: err instanceof Error ? err.message : "Failed to parse recipe with AI.",
        };

        setStatus("error");
        setError(unknownError);
        onError?.(unknownError);
        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [analyticsSessionId, cancel, onError, onSuccess, sessionId]
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return useMemo(
    () => ({
      status,
      error,
      elapsedMs,
      parse,
      cancel,
    }),
    [cancel, elapsedMs, error, parse, status]
  );
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
