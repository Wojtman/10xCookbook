import type {
  ChatRequest,
  ChatResult,
  ChatStructuredRequest,
  JsonSchemaResponseFormat,
  JsonSchemaValidator,
  ModelParameters,
  OpenRouterChatBody,
  OpenRouterChatResponse,
  OpenRouterDeps,
  OpenRouterDefaults,
  LoggerLike,
  RetryStrategy,
  ServiceError,
  StreamDelta,
  StreamResult,
  StructuredResult,
} from "../openrouter/types";
import type { OpenRouterConfig } from "../openrouter/config";
import { OpenRouterConfigError } from "../openrouter/config";

const CHAT_COMPLETIONS_PATH = "/chat/completions";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
const RETRYABLE_ERROR_CODES = new Set<ServiceError["code"]>([
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "RATE_LIMITED",
  "TIMEOUT",
  "UNKNOWN",
]);

type HeadersInitRecord = Record<string, string>;

export class OpenRouterServiceError extends Error {
  constructor(
    public readonly details: ServiceError,
    cause?: unknown
  ) {
    super(details.message);
    this.name = "OpenRouterServiceError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: cause,
        enumerable: false,
        configurable: true,
        writable: false,
      });
    }
  }
}

class DefaultRetryStrategy implements RetryStrategy {
  public readonly maxAttempts: number;

  constructor(maxAttempts = DEFAULT_MAX_RETRY_ATTEMPTS) {
    this.maxAttempts = Math.max(1, maxAttempts);
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.maxAttempts - 1) {
      return false;
    }

    if (!error || typeof error !== "object") {
      return true;
    }

    const code = (error as ServiceError).code ?? "UNKNOWN";
    return RETRYABLE_ERROR_CODES.has(code);
  }

  backoffMs(attempt: number): number {
    const cappedAttempt = Math.min(attempt, 5);
    return Math.min(1000 * 2 ** cappedAttempt, 10_000);
  }
}

const defaultLogger: LoggerLike = (() => {
  const consoleLike = typeof console !== "undefined" ? console : undefined;

  return {
    info: (...args: unknown[]) => consoleLike?.info?.("[OpenRouterService]", ...args),
    warn: (...args: unknown[]) => consoleLike?.warn?.("[OpenRouterService]", ...args),
    error: (...args: unknown[]) => consoleLike?.error?.("[OpenRouterService]", ...args),
    debug: (...args: unknown[]) => consoleLike?.debug?.("[OpenRouterService]", ...args),
  };
})();

interface AbortControllerBundle {
  controller: AbortController;
  cleanup(): void;
}

export class OpenRouterService {
  private readonly config: OpenRouterConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: LoggerLike;
  private readonly retry: RetryStrategy;
  private readonly schemaValidator?: JsonSchemaValidator;
  private defaultsState: OpenRouterDefaults;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OpenRouterConfig, deps?: OpenRouterDeps) {
    if (!config?.apiKey?.trim()) {
      throw new OpenRouterConfigError("OpenRouterService requires a valid apiKey in the configuration.");
    }

    this.baseUrl = (config.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.config = {
      ...config,
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
    };

    const fetchCandidate = deps?.fetchImpl ?? globalThis.fetch;
    if (typeof fetchCandidate !== "function") {
      throw new OpenRouterConfigError("OpenRouterService requires a fetch implementation in the current runtime.");
    }

    this.fetchImpl = fetchCandidate;
    this.logger = deps?.logger ?? defaultLogger;
    this.retry = deps?.retry ?? new DefaultRetryStrategy();
    this.schemaValidator = deps?.schemaValidator;
    this.defaultsState = {
      model: config.defaultModel,
      parameters: config.defaultParameters ? { ...config.defaultParameters } : undefined,
    };
  }

  get defaults(): OpenRouterDefaults {
    return {
      model: this.defaultsState.model,
      parameters: this.defaultsState.parameters ? { ...this.defaultsState.parameters } : undefined,
    };
  }

  setDefaults(next: OpenRouterDefaults): void {
    if (!next) {
      return;
    }

    if (next.model) {
      this.defaultsState.model = next.model;
    }

    if (next.parameters) {
      this.defaultsState.parameters = { ...next.parameters };
    }
  }

  async chat(options: ChatRequest): Promise<ChatResult> {
    this._validateChatRequest(options);
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const body = this._buildBody(options);

    const response = await this._post({
      path: CHAT_COMPLETIONS_PATH,
      body,
      timeoutMs,
      idempotencyKey: options.idempotencyKey,
    });

    const json = await response.json().catch((error) => {
      throw this._wrapError(error, "Failed to parse OpenRouter response body as JSON.", "PARSE_ERROR");
    });

    return this._parseChatResponse(json, options.responseFormat);
  }

  async chatStructured<T>(options: ChatStructuredRequest<T>): Promise<StructuredResult<T>> {
    const { schema, ...rest } = options;
    const strict = schema.strict ?? true;

    const responseFormat: JsonSchemaResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: schema.name,
        schema: schema.schema,
        strict,
      },
    };

    const result = await this.chat({
      ...rest,
      responseFormat,
    });

    if (result.type !== "json") {
      throw new OpenRouterServiceError({
        code: "SCHEMA_MISMATCH",
        message: "Structured chat response did not include JSON payload.",
        details: result.raw,
      });
    }

    const parsedObject = result.object as T | undefined;
    if (parsedObject === undefined) {
      throw new OpenRouterServiceError({
        code: "PARSE_ERROR",
        message: "Structured chat response is missing the parsed JSON object.",
        details: result.raw,
      });
    }

    if (this.schemaValidator && strict) {
      const validation = this.schemaValidator.validate<T>(schema.schema, parsedObject);
      if (!validation.valid) {
        throw new OpenRouterServiceError({
          code: "SCHEMA_MISMATCH",
          message: "Structured chat response failed JSON schema validation.",
          details: validation.errors ?? [],
        });
      }
    }

    return {
      object: parsedObject,
      raw: result,
    };
  }

  async streamChat(
    options: ChatRequest,
    onDelta: (delta: StreamDelta) => void,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    if (typeof onDelta !== "function") {
      throw new OpenRouterServiceError({
        code: "INVALID_REQUEST",
        message: "streamChat requires an onDelta callback function.",
      });
    }

    this._validateChatRequest(options);
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const body = this._buildBody(options, true);

    await this._stream({
      path: CHAT_COMPLETIONS_PATH,
      body,
      timeoutMs,
      idempotencyKey: options.idempotencyKey,
      onDelta,
      responseFormat: options.responseFormat,
      signal,
    });

    return { done: true };
  }

  private _buildHeaders(idempotencyKey?: string): HeadersInitRecord {
    const headers: HeadersInitRecord = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };

    if (this.config.siteUrl) {
      headers["HTTP-Referer"] = this.config.siteUrl;
    }

    if (this.config.appTitle) {
      headers["X-Title"] = this.config.appTitle;
    }

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    return headers;
  }

  private _buildBody(options: ChatRequest, stream = false): OpenRouterChatBody {
    const { messages, model, parameters, metadata, responseFormat } = options;
    const resolvedModel = model ?? this.defaultsState.model;

    if (!resolvedModel) {
      throw new OpenRouterServiceError({
        code: "INVALID_REQUEST",
        message: "OpenRouter chat request requires a model. Provide a model or configure a default model.",
      });
    }

    const normalizedMessages = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const body: OpenRouterChatBody = {
      model: resolvedModel,
      messages: normalizedMessages,
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    if (metadata && typeof metadata === "object" && metadata !== null) {
      body.metadata = metadata;
    }

    const mergedParameters = this._mergeParameters(parameters);
    this._applyParameters(body, mergedParameters);

    if (stream) {
      body.stream = true;
    }

    return body;
  }

  private _mergeParameters(parameters?: Partial<ModelParameters>): Partial<ModelParameters> | undefined {
    if (!this.defaultsState.parameters && !parameters) {
      return undefined;
    }

    return {
      ...(this.defaultsState.parameters ?? {}),
      ...(parameters ?? {}),
    };
  }

  private _applyParameters(body: OpenRouterChatBody, parameters?: Partial<ModelParameters>): void {
    if (!parameters) {
      return;
    }

    const assignableKeys: (keyof ModelParameters)[] = [
      "temperature",
      "max_tokens",
      "top_p",
      "frequency_penalty",
      "presence_penalty",
      "stop",
      "repetition_penalty",
      "seed",
      "top_k",
    ];

    const bodyRecord = body as unknown as Record<string, unknown>;

    assignableKeys.forEach((key) => {
      const value = parameters[key];
      if (value !== undefined) {
        if (
          [
            "temperature",
            "max_tokens",
            "top_p",
            "frequency_penalty",
            "presence_penalty",
            "repetition_penalty",
            "seed",
            "top_k",
          ].includes(key as string) &&
          typeof value !== "number"
        ) {
          throw new OpenRouterServiceError({
            code: "INVALID_REQUEST",
            message: `Model parameter "${key}" must be a number.`,
          });
        }

        if (key === "stop") {
          const isValidStop =
            typeof value === "string" || (Array.isArray(value) && value.every((item) => typeof item === "string"));

          if (!isValidStop) {
            throw new OpenRouterServiceError({
              code: "INVALID_REQUEST",
              message: 'Model parameter "stop" must be a string or an array of strings.',
            });
          }
        }

        bodyRecord[key as string] = value;
      }
    });
  }

  private async _post(options: {
    path: string;
    body: OpenRouterChatBody;
    timeoutMs: number;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<Response> {
    const url = this._resolveUrl(options.path);
    const payload = JSON.stringify(options.body);
    const headers = this._buildHeaders(options.idempotencyKey);

    return this._executeWithRetry(async (_attempt) => {
      const { controller, cleanup } = this._createAbortController(options.timeoutMs, options.signal);

      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers,
          body: payload,
          signal: controller.signal,
        });

        if (response.ok) {
          return response;
        }

        const errorPayload = await this._safeParseResponse(response);
        const serviceError = this._mapError(response, errorPayload);

        throw new OpenRouterServiceError(serviceError);
      } finally {
        cleanup();
      }
    });
  }

  private async _stream(options: {
    path: string;
    body: OpenRouterChatBody;
    timeoutMs: number;
    idempotencyKey?: string;
    onDelta: (delta: StreamDelta) => void;
    responseFormat?: JsonSchemaResponseFormat;
    signal?: AbortSignal;
  }): Promise<void> {
    const url = this._resolveUrl(options.path);
    const payload = JSON.stringify(options.body);
    const headers = this._buildHeaders(options.idempotencyKey);
    let hasBegunStreaming = false;

    const fetchResult = await this._executeWithRetry(async (_attempt) => {
      const bundle = this._createAbortController(options.timeoutMs, options.signal);

      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers,
          body: payload,
          signal: bundle.controller.signal,
        });

        if (!response.ok) {
          const errorPayload = await this._safeParseResponse(response);
          throw new OpenRouterServiceError(this._mapError(response, errorPayload));
        }

        return { response, cleanup: bundle.cleanup };
      } catch (error) {
        bundle.cleanup();

        if (hasBegunStreaming) {
          throw this._wrapError(error, "Streaming connection interrupted after data was received.", "NETWORK_ERROR");
        }

        throw error;
      }
    });

    const { response, cleanup } = fetchResult;

    try {
      if (!response.body) {
        throw new OpenRouterServiceError({
          code: "UNSUPPORTED_FEATURE",
          message: "Streaming responses are not supported in this runtime.",
          status: 500,
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        hasBegunStreaming = true;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          this._processSseEvent(rawEvent, options.responseFormat, options.onDelta);
          separatorIndex = buffer.indexOf("\n\n");
        }
      }

      const remaining = buffer.trim();
      if (remaining) {
        this._processSseEvent(remaining, options.responseFormat, options.onDelta);
      }
    } catch (error) {
      const serviceError = this._normalizeError(error);
      options.onDelta({
        type: "error",
        content: serviceError.details.message,
        raw: serviceError.details,
      });
      throw serviceError;
    } finally {
      cleanup();
    }
  }

  private _processSseEvent(
    rawEvent: string,
    responseFormat: JsonSchemaResponseFormat | undefined,
    onDelta: (delta: StreamDelta) => void
  ): void {
    if (!rawEvent.startsWith("data:")) {
      return;
    }

    const message = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");

    if (!message || message === "[DONE]") {
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(message);
    } catch (error) {
      this.logger.warn?.("Failed to parse SSE chunk from OpenRouter.", error);
      onDelta({
        type: "error",
        content: "Malformed stream chunk from OpenRouter.",
        raw: message,
      });
      return;
    }

    const chunk = parsed as Partial<OpenRouterChatResponse>;
    const choices = chunk.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return;
    }

    const choice = choices[0] as unknown as {
      delta?: {
        content?: string | { text?: string }[];
        error?: string;
      };
      message?: {
        content?: string | { text?: string }[];
      };
    };

    const delta = choice.delta ?? choice.message;

    if (
      delta &&
      typeof delta === "object" &&
      "error" in delta &&
      typeof (delta as { error?: unknown }).error === "string"
    ) {
      onDelta({
        type: "error",
        content: (delta as { error: string }).error,
        raw: parsed,
      });
      return;
    }

    const content = this._extractContent(delta?.content);
    if (!content) {
      return;
    }

    const type: StreamDelta["type"] = responseFormat?.type === "json_schema" ? "json" : "text";

    onDelta({
      type,
      content,
      raw: parsed,
    });
  }

  private _parseChatResponse(json: unknown, responseFormat?: JsonSchemaResponseFormat): ChatResult {
    if (!json || typeof json !== "object") {
      throw new OpenRouterServiceError({
        code: "PARSE_ERROR",
        message: "OpenRouter response payload is not an object.",
        details: json,
      });
    }

    const chatResponse = json as OpenRouterChatResponse;

    if (!chatResponse.id || !chatResponse.model) {
      throw new OpenRouterServiceError({
        code: "PARSE_ERROR",
        message: "OpenRouter response is missing required identifiers.",
        details: json,
      });
    }

    const choice = Array.isArray(chatResponse.choices) ? chatResponse.choices[0] : undefined;

    if (!choice) {
      throw new OpenRouterServiceError({
        code: "PARSE_ERROR",
        message: "OpenRouter response did not include any choices.",
        details: json,
      });
    }

    const rawContent = this._extractContent(choice.message?.content);
    const expectsJson = responseFormat?.type === "json_schema";

    if (expectsJson) {
      if (!rawContent) {
        throw new OpenRouterServiceError({
          code: "PARSE_ERROR",
          message: "Structured response from OpenRouter was empty.",
          details: json,
        });
      }

      try {
        const parsedObject = JSON.parse(rawContent);

        return {
          id: chatResponse.id,
          model: chatResponse.model,
          created: chatResponse.created,
          usage: chatResponse.usage,
          type: "json",
          text: rawContent,
          object: parsedObject,
          raw: json,
        };
      } catch (error) {
        throw new OpenRouterServiceError(
          {
            code: "PARSE_ERROR",
            message: "Structured response from OpenRouter could not be parsed as JSON.",
            details: rawContent,
          },
          error
        );
      }
    }

    return {
      id: chatResponse.id,
      model: chatResponse.model,
      created: chatResponse.created,
      usage: chatResponse.usage,
      type: "text",
      text: rawContent ?? "",
      raw: json,
    };
  }

  private _extractContent(content: string | { text?: string }[] | undefined): string | undefined {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => part?.text ?? "")
        .join("")
        .trim();
    }

    return undefined;
  }

  private _resolveUrl(path: string): string {
    if (path.startsWith("http")) {
      return path;
    }

    return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private _safeParseResponse(response: Response): Promise<unknown> {
    const clone = response.clone();
    return clone.json().catch(() => clone.text().catch(() => undefined));
  }

  private _mapError(response: Response, payload: unknown): ServiceError {
    const status = response.status;
    const code = this._resolveErrorCode(status);
    const messageFromPayload = this._extractErrorMessage(payload);
    const requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("openrouter-request-id") ??
      response.headers.get("x-requestid") ??
      undefined;
    const retryAfterMs = this._parseRetryAfterHeader(response.headers.get("retry-after"));

    const message =
      messageFromPayload ?? this._defaultErrorMessage(code, status) ?? `OpenRouter responded with status ${status}.`;

    return {
      code,
      message,
      status,
      details: payload,
      requestId,
      retryAfterMs,
    };
  }

  private _resolveErrorCode(status: number): ServiceError["code"] {
    if (status === 400 || status === 422) {
      return "INVALID_REQUEST";
    }

    if (status === 401) {
      return "UNAUTHORIZED";
    }

    if (status === 403) {
      return "FORBIDDEN";
    }

    if (status === 404) {
      return "NOT_FOUND";
    }

    if (status === 409) {
      return "CONFLICT";
    }

    if (status === 412) {
      return "PRECONDITION_FAILED";
    }

    if (status === 408) {
      return "TIMEOUT";
    }

    if (status === 429) {
      return "RATE_LIMITED";
    }

    if (status >= 500 && status < 600) {
      return "SERVER_ERROR";
    }

    return "UNKNOWN";
  }

  private _defaultErrorMessage(code: ServiceError["code"], status: number): string | undefined {
    switch (code) {
      case "UNAUTHORIZED":
        return "Invalid OpenRouter API key or insufficient permissions.";
      case "FORBIDDEN":
        return "Access to the requested OpenRouter resource is forbidden.";
      case "INVALID_REQUEST":
        return "The OpenRouter request was invalid.";
      case "NOT_FOUND":
        return "Requested OpenRouter model or resource was not found.";
      case "CONFLICT":
        return "OpenRouter reported a request conflict.";
      case "PRECONDITION_FAILED":
        return "OpenRouter rejected the request due to unmet preconditions.";
      case "RATE_LIMITED":
        return "Too many requests sent to OpenRouter. Please retry later.";
      case "SERVER_ERROR":
        return "OpenRouter encountered an internal error.";
      case "TIMEOUT":
        return "OpenRouter request timed out.";
      default:
        return status >= 500 ? "Unexpected error from OpenRouter." : undefined;
    }
  }

  private _extractErrorMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    if ("error" in payload && payload.error) {
      const value = (payload as Record<string, unknown>).error;
      if (typeof value === "string") {
        return value;
      }

      if (
        value &&
        typeof value === "object" &&
        "message" in value &&
        typeof (value as Record<string, unknown>).message === "string"
      ) {
        return (value as Record<string, unknown>).message as string;
      }
    }

    if ("message" in payload && typeof (payload as Record<string, unknown>).message === "string") {
      return (payload as Record<string, unknown>).message as string;
    }

    return undefined;
  }

  private _parseRetryAfterHeader(headerValue: string | null): number | undefined {
    if (!headerValue) {
      return undefined;
    }

    const numeric = Number.parseFloat(headerValue);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric >= 0) {
      return numeric * 1000;
    }

    const dateTime = Date.parse(headerValue);
    if (!Number.isNaN(dateTime)) {
      const delta = dateTime - Date.now();
      if (delta > 0) {
        return delta;
      }
    }

    return undefined;
  }

  private _normalizeError(error: unknown): OpenRouterServiceError {
    if (error instanceof OpenRouterServiceError) {
      return error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return new OpenRouterServiceError({
        code: "ABORTED",
        message: "OpenRouter request was aborted.",
      });
    }

    if (error instanceof Error) {
      return new OpenRouterServiceError({
        code: "NETWORK_ERROR",
        message: error.message || "Network error while communicating with OpenRouter.",
        details: { name: error.name },
      });
    }

    return new OpenRouterServiceError({
      code: "UNKNOWN",
      message: "Unknown error while communicating with OpenRouter.",
      details: error,
    });
  }

  private _wrapError(error: unknown, message: string, code: ServiceError["code"]): OpenRouterServiceError {
    if (error instanceof OpenRouterServiceError) {
      return error;
    }

    return new OpenRouterServiceError(
      {
        code,
        message,
        details: error instanceof Error ? { name: error.name, message: error.message } : error,
      },
      error instanceof Error ? error : undefined
    );
  }

  private _shouldRetry(error: OpenRouterServiceError, attempt: number): boolean {
    const nonRetryableCodes: ServiceError["code"][] = [
      "INVALID_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "SCHEMA_MISMATCH",
      "PARSE_ERROR",
      "TOKEN_LIMIT",
      "CONFLICT",
      "PRECONDITION_FAILED",
      "ABORTED",
      "UNSUPPORTED_FEATURE",
    ];

    if (nonRetryableCodes.includes(error.details.code)) {
      return false;
    }

    const maxAttempts = this.retry.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
    if (attempt >= maxAttempts - 1) {
      return false;
    }

    try {
      return this.retry.shouldRetry(error.details, attempt);
    } catch (strategyError) {
      this.logger.warn?.("Retry strategy threw an error; falling back to default behaviour.", strategyError);
      return RETRYABLE_ERROR_CODES.has(error.details.code);
    }
  }

  private async _executeWithRetry<T>(operation: (attempt: number) => Promise<T>): Promise<T> {
    const maxAttempts = this.retry.maxAttempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
    let attempt = 0;
    let lastError: OpenRouterServiceError | undefined;

    while (attempt < maxAttempts) {
      try {
        return await operation(attempt);
      } catch (error) {
        const serviceError = this._normalizeError(error);
        lastError = serviceError;

        if (!this._shouldRetry(serviceError, attempt)) {
          throw serviceError;
        }

        const backoffMs = Math.max(0, this.retry.backoffMs(attempt));
        const nextAttempt = attempt + 2;
        const waitSuffix = backoffMs > 0 ? ` in ${backoffMs}ms` : "";
        this.logger.warn?.(
          `OpenRouter request failed (code: ${serviceError.details.code}). Retrying attempt ${nextAttempt}${waitSuffix}.`
        );

        if (backoffMs > 0) {
          await this._delay(backoffMs);
        }
      }

      attempt += 1;
    }

    throw (
      lastError ??
      new OpenRouterServiceError({
        code: "UNKNOWN",
        message: "Unknown error after retrying OpenRouter request.",
      })
    );
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private _createAbortController(timeoutMs: number | undefined, externalSignal?: AbortSignal): AbortControllerBundle {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let externalAbortHandler: (() => void) | undefined;

    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalAbortHandler = () => controller.abort();
        externalSignal.addEventListener("abort", externalAbortHandler, {
          once: true,
        });
      }
    }

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (externalSignal && externalAbortHandler) {
        externalSignal.removeEventListener("abort", externalAbortHandler);
      }
    };

    return { controller, cleanup };
  }

  private _validateChatRequest(options: ChatRequest): void {
    if (!Array.isArray(options.messages) || options.messages.length === 0) {
      throw new OpenRouterServiceError({
        code: "INVALID_REQUEST",
        message: "OpenRouter chat request requires at least one message.",
      });
    }

    for (const [index, message] of options.messages.entries()) {
      if (!message?.role || !["system", "user", "assistant"].includes(message.role)) {
        throw new OpenRouterServiceError({
          code: "INVALID_REQUEST",
          message: `Message at index ${index} has an unsupported role.`,
        });
      }

      if (typeof message.content !== "string" || message.content.trim().length === 0) {
        throw new OpenRouterServiceError({
          code: "INVALID_REQUEST",
          message: `Message at index ${index} must include non-empty content.`,
        });
      }
    }
  }
}
