import type { OpenRouterConfig } from "./config";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  response_format?: unknown;
  repetition_penalty?: number;
  seed?: number;
  top_k?: number;
}

export type JsonSchemaObject = Record<string, unknown>;

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: JsonSchemaObject;
    strict?: boolean;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  parameters?: Partial<ModelParameters>;
  responseFormat?: JsonSchemaResponseFormat;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatChoice {
  index: number;
  message: {
    role: ChatRole;
    content: string | { type: string; text?: string }[];
  };
  finish_reason: string | null;
}

export interface OpenRouterChatBody {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  response_format?: JsonSchemaResponseFormat;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface OpenRouterChatResponse {
  id: string;
  model: string;
  created: number;
  choices: ChatChoice[];
  usage?: ChatUsage;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "PARSE_ERROR"
  | "SCHEMA_MISMATCH"
  | "UNSUPPORTED_FEATURE"
  | "TOKEN_LIMIT"
  | "UNKNOWN";

export interface ServiceError {
  code: ErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
  retryAfterMs?: number;
}

export interface RetryStrategy {
  maxAttempts?: number;
  shouldRetry(error: unknown, attempt: number): boolean;
  backoffMs(attempt: number): number;
}

export interface LoggerLike {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface JsonSchemaValidator {
  validate<T>(
    schema: JsonSchemaObject,
    payload: unknown
  ): {
    valid: boolean;
    errors?: string[];
  };
}

export interface OpenRouterDeps {
  fetchImpl?: typeof fetch;
  logger?: LoggerLike;
  retry?: RetryStrategy;
  schemaValidator?: JsonSchemaValidator;
}

export interface ChatResult {
  id: string;
  model: string;
  created: number;
  usage?: ChatUsage;
  type: "text" | "json";
  text?: string;
  object?: unknown;
  raw: unknown;
}

export interface ChatStructuredRequest<T> extends Omit<ChatRequest, "responseFormat"> {
  schema: {
    name: string;
    schema: JsonSchemaObject;
    strict?: boolean;
  };
}

export interface StructuredResult<T> {
  object: T;
  raw: ChatResult;
}

export interface StreamDeltaBase {
  raw?: unknown;
}

export interface StreamTextDelta extends StreamDeltaBase {
  type: "text";
  content: string;
}

export interface StreamJsonDelta extends StreamDeltaBase {
  type: "json";
  content: string;
}

export interface StreamErrorDelta extends StreamDeltaBase {
  type: "error";
  content: string;
}

export type StreamDelta = StreamTextDelta | StreamJsonDelta | StreamErrorDelta;

export interface StreamResult {
  done: true;
}

export interface OpenRouterDefaults {
  model?: string;
  parameters?: Partial<ModelParameters>;
}

export interface StreamOptions extends ChatRequest {
  signal?: AbortSignal;
}

export type { OpenRouterConfig };
