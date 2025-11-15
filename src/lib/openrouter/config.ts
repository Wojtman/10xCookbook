import type { ModelParameters } from "./types";

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl?: string;
  siteUrl?: string;
  appTitle?: string;
  defaultModel?: string;
  defaultParameters?: Partial<ModelParameters>;
  timeoutMs?: number;
}

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}

function readEnv(key: string): string | undefined {
  if (typeof process !== "undefined") {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const metaEnv = import.meta.env as Record<string, string | undefined>;
    const value = metaEnv[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function loadOpenRouterConfig(): OpenRouterConfig {
  const apiKey = readEnv("OPENROUTER_API_KEY");

  if (!apiKey) {
    throw new OpenRouterConfigError("OPENROUTER_API_KEY is not configured in the environment.");
  }

  const baseUrl = readEnv("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1";
  const siteUrl = readEnv("OPENROUTER_SITE_URL");
  const appTitle = readEnv("OPENROUTER_APP_TITLE");
  const defaultModel = readEnv("OPENROUTER_DEFAULT_MODEL");
  const timeoutRaw = readEnv("OPENROUTER_TIMEOUT_MS");
  let timeoutMs: number | undefined;

  if (typeof timeoutRaw === "string" && timeoutRaw.trim().length > 0) {
    timeoutMs = Number.parseInt(timeoutRaw, 10);
    if (Number.isNaN(timeoutMs)) {
      throw new OpenRouterConfigError(`OPENROUTER_TIMEOUT_MS must be a valid integer. Received: ${timeoutRaw}`);
    }
  }

  return {
    apiKey,
    baseUrl,
    siteUrl,
    appTitle,
    defaultModel,
    timeoutMs,
  };
}
