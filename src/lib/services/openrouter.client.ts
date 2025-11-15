import type {
  ChatMessage,
  ChatResult,
  JsonSchemaObject,
  ModelParameters,
  StreamDelta,
  StructuredResult,
} from "../openrouter/types";

interface ApiErrorResponse {
  error: string;
  message: string;
  fields?: string[];
  request_id?: string;
  retry_after?: number;
}

interface ApiChatResponse<T> {
  result: ChatResult | StructuredResult<T>;
}

export interface OpenRouterClientChatRequest<T = unknown> {
  messages: ChatMessage[];
  model?: string;
  parameters?: Partial<ModelParameters>;
  metadata?: Record<string, unknown>;
  schema?: {
    name: string;
    schema: JsonSchemaObject;
    strict?: boolean;
  };
  timeoutMs?: number;
  idempotencyKey?: string;
}

export interface OpenRouterStreamHandlers {
  onDelta(delta: StreamDelta): void;
  onError?(error: OpenRouterClientError): void;
  onComplete?(): void;
}

export interface OpenRouterStreamSession {
  cancel(): void;
  completed: Promise<void>;
}

export class OpenRouterClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly body?: ApiErrorResponse,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "OpenRouterClientError";
  }
}

export async function postOpenRouterChat<T = unknown>(
  request: OpenRouterClientChatRequest<T> & { schema: OpenRouterClientChatRequest<T>["schema"] },
  options?: { signal?: AbortSignal }
): Promise<StructuredResult<T>>;
export async function postOpenRouterChat(
  request: OpenRouterClientChatRequest,
  options?: { signal?: AbortSignal }
): Promise<ChatResult>;
export async function postOpenRouterChat<T = unknown>(
  request: OpenRouterClientChatRequest<T>,
  options?: { signal?: AbortSignal }
): Promise<ChatResult | StructuredResult<T>> {
  const response = await fetch("/api/openrouter/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(serializeChatRequest(request)),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw await buildClientError(response);
  }

  const payload = (await response.json()) as ApiChatResponse<T>;
  const result = payload.result;

  if (request.schema) {
    return result as StructuredResult<T>;
  }

  return result as ChatResult;
}

export function streamOpenRouterChat<T = unknown>(
  request: OpenRouterClientChatRequest<T>,
  handlers: OpenRouterStreamHandlers
): OpenRouterStreamSession {
  const abortController = new AbortController();

  const completed = (async () => {
    try {
      const response = await fetch("/api/openrouter/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(serializeChatRequest(request)),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw await buildClientError(response);
      }

      await consumeEventStream(response, handlers, abortController);
    } catch (error) {
      if (error instanceof OpenRouterClientError) {
        handlers.onError?.(error);
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      handlers.onError?.(
        new OpenRouterClientError(
          error instanceof Error ? error.message : "Failed to stream OpenRouter response.",
          499,
          "stream_error"
        )
      );
    }
  })();

  return {
    cancel: () => abortController.abort(),
    completed,
  };
}

async function buildClientError(response: Response): Promise<OpenRouterClientError> {
  let body: ApiErrorResponse | undefined;
  try {
    body = (await response.json()) as ApiErrorResponse;
  } catch {
    body = undefined;
  }

  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;

  const message = body?.message ?? `OpenRouter request failed with status ${response.status}.`;

  return new OpenRouterClientError(
    message,
    response.status,
    body?.error ?? "openrouter_error",
    body,
    retryAfterSeconds
  );
}

function serializeChatRequest<T>(request: OpenRouterClientChatRequest<T>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };

  if (request.model) {
    payload.model = request.model;
  }

  if (request.parameters) {
    payload.parameters = request.parameters;
  }

  if (request.metadata) {
    payload.metadata = request.metadata;
  }

  if (request.schema) {
    payload.schema = {
      name: request.schema.name,
      schema: request.schema.schema,
      ...(request.schema.strict !== undefined && {
        strict: request.schema.strict,
      }),
    };
  }

  if (request.timeoutMs !== undefined) {
    payload.timeout_ms = request.timeoutMs;
  }

  if (request.idempotencyKey) {
    payload.idempotency_key = request.idempotencyKey;
  }

  return payload;
}

async function consumeEventStream(
  response: Response,
  handlers: OpenRouterStreamHandlers,
  abortController: AbortController
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchDelta = (data: unknown): boolean => {
    if (data === "[DONE]" || data === '"[DONE]"') {
      handlers.onComplete?.();
      abortController.abort();
      return true;
    }

    if (typeof data === "string") {
      if (data === "[DONE]") {
        handlers.onComplete?.();
        abortController.abort();
      }
      return data === "[DONE]";
    }

    if (!data || typeof data !== "object") {
      return false;
    }

    if ("type" in data && data.type === "error") {
      handlers.onError?.(
        new OpenRouterClientError(
          typeof (data as any).content === "string" ? (data as any).content : "OpenRouter streaming error.",
          502,
          "openrouter_error"
        )
      );
      abortController.abort();
      return true;
    }

    if ("type" in data && "content" in data) {
      const type = (data as { type: StreamDelta["type"]; content: string }).type;
      const content = (data as { type: StreamDelta["type"]; content: string }).content;
      handlers.onDelta({
        type,
        content,
      });
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        handlers.onComplete?.();
        return;
      }

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const parsed = parseSseEvent(rawEvent);
        if (parsed) {
          const shouldStop = dispatchDelta(parsed);
          if (shouldStop) {
            return;
          }
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    throw error;
  }
}

function parseSseEvent(event: string): unknown {
  if (!event) {
    return undefined;
  }

  const lines = event.split("\n");
  let dataPayload = "";

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataPayload += line.slice(5).trim();
    }
  }

  if (!dataPayload) {
    return undefined;
  }

  if (dataPayload === "[DONE]") {
    return "[DONE]";
  }

  try {
    return JSON.parse(dataPayload);
  } catch {
    return undefined;
  }
}

function parseRetryAfter(header: string): number | undefined {
  const numeric = Number.parseFloat(header);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }

  const parsedDate = Date.parse(header);
  if (!Number.isNaN(parsedDate)) {
    const seconds = Math.ceil((parsedDate - Date.now()) / 1000);
    return seconds > 0 ? seconds : undefined;
  }

  return undefined;
}
