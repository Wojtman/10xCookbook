## OpenRouter Service Implementation Plan (Astro 5 + React 19 + TypeScript 5)

### 1) Service description

An internal, server-side TypeScript service that standardizes how 10xCookbook calls OpenRouter’s Chat Completions API for both non-streaming and streaming LLM interactions. It lives under `src/lib/openrouter`, exposes a small, typed surface area, and is consumed exclusively from Astro API routes in `src/pages/api` so that the OpenRouter API key is never exposed to the browser. The service supports:

- Configurable system and user messages
- Model selection and model parameter overrides
- Strict JSON structured output using `response_format` with JSON Schema
- Text and streaming (SSE) responses
- Robust error handling, retries, and timeouts
- Safe logging/metrics hooks for observability

The React UI calls our Astro API endpoints instead of OpenRouter directly to maintain security and consistency across the app.


### 2) Constructor description

Create `OpenRouterService` in `src/lib/openrouter/OpenRouterService.ts`.

- Signature
  - `constructor(config: OpenRouterConfig, deps?: OpenRouterDeps)`
- `OpenRouterConfig`
  - `apiKey: string` (required; from env)
  - `baseUrl?: string` (default `https://openrouter.ai/api/v1`)
  - `siteUrl?: string` (for `HTTP-Referer` header; e.g., `https://10xcookbook.example`)
  - `appTitle?: string` (for `X-Title` header; e.g., `10xCookbook`)
  - `defaultModel?: string` (e.g., `openai/gpt-4o-mini`)
  - `defaultParameters?: Partial<ModelParameters>` (default request parameters)
  - `timeoutMs?: number` (default 60_000)
- `OpenRouterDeps` (all optional; useful for testing/DI)
  - `fetchImpl?: typeof fetch`
  - `logger?: { info(...); warn(...); error(...); debug(...); }`
  - `retry?: RetryStrategy` (interface: `shouldRetry(error, attempt): boolean; backoffMs(attempt): number`)

Constructor responsibilities:
1. Validate required config (apiKey).
2. Normalize URLs/headers.
3. Prepare defaults (model, parameters, timeout).
4. Bind `fetchImpl`, `logger`, and `retry` or provide safe fallbacks.


### 3) Public methods and fields

1. `async chat(options: ChatRequest): Promise<ChatResult>`
   - Purpose: One-shot, non-streaming chat completion.
   - Input:
     - `messages: Array<ChatMessage>` where `role` ∈ {`system` | `user` | `assistant`}
     - `model?: string`
     - `parameters?: Partial<ModelParameters>` (`temperature`, `max_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`, `stop`, etc.)
     - `responseFormat?: JsonSchemaResponseFormat` (for structured output; see examples below)
     - `metadata?: Record<string, unknown>` (optional passthrough)
   - Output:
     - `ChatResult` with normalized fields:
       - `id`, `model`, `created`, `usage?`
       - `type: 'text' | 'json'`
       - `text?: string`
       - `object?: unknown` (parsed JSON if strict JSON schema used)
       - `raw: unknown` (raw OpenRouter response, kept for debugging/metrics)

2. `async chatStructured<T>(options: ChatStructuredRequest<T>): Promise<StructuredResult<T>>`
   - Purpose: Enforce strict JSON outputs with a supplied JSON Schema.
   - Input:
     - `messages: Array<ChatMessage>`
     - `schema: { name: string; schema: JsonSchemaObject; strict?: boolean }` (defaults `strict: true`)
     - `model?: string`
     - `parameters?: Partial<ModelParameters>`
   - Behavior: Wraps `chat` with a properly formed `response_format` and parses/validates the returned JSON into `T`.
   - Output:
     - `{ object: T; raw: ChatResult }` (throws on validation failure if strict).

3. `async streamChat(options: ChatRequest, onDelta: (delta: StreamDelta) => void, signal?: AbortSignal): Promise<StreamResult>`
   - Purpose: SSE streaming for partial tokens/JSON lines.
   - Input:
     - Same as `chat`, plus `signal` for cancellation.
   - Behavior: Emits deltas as they arrive; finalizes with `done: true` event or throws on error.
   - Output:
     - `{ done: true }` on completion; intermediate `onDelta` receives `{ type: 'text'|'json'|'error', content, raw? }`.

4. `get defaults(): { model?: string; parameters?: Partial<ModelParameters> }`
   - Purpose: Expose read-only defaults for observability/UI hints.

5. `setDefaults(next: { model?: string; parameters?: Partial<ModelParameters> }): void`
   - Purpose: Allow server-controlled default tuning without code changes.


#### Incorporating OpenRouter API elements (with examples)

1) System message
- Methods:
  1. Provide as the first `messages` entry with `role: 'system'`.
  2. Compose multiple concerns (e.g., style + constraints) into one `system` message for clarity.
- Example:
```ts
const messages = [
  { role: 'system', content: 'You are a helpful cooking assistant. Respond concisely.' },
  { role: 'user', content: 'Create a 2-serving vegan pasta recipe.' },
];
```

2) User message
- Methods:
  1. Plain text `content` for standard prompts.
  2. Multi-part messages (e.g., text + previous assistant reply) by including prior turns in `messages`.
- Example:
```ts
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Summarize this recipe: ...' },
];
```

3) Structured responses via `response_format` (JSON Schema)
- Methods:
  1. Use OpenRouter/OpenAI-compatible `response_format` with `type: 'json_schema'`.
  2. Set `strict: true` to require valid JSON; the model will refuse to output non-JSON.
  3. Validate on the server after parsing (defense-in-depth).
- Example (definition passed to service):
```ts
const recipeSchema = {
  name: 'RecipeDraft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'ingredients', 'instructions', 'tags'],
    properties: {
      title: { type: 'string', minLength: 1 },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'quantity'],
          properties: {
            name: { type: 'string', minLength: 1 },
            quantity: { type: 'string', minLength: 1 },
            notes: { type: 'string' },
          },
        },
      },
      instructions: { type: 'array', items: { type: 'string', minLength: 1 } },
      cook_time_minutes: { type: 'integer', minimum: 0 },
      tags: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

const { object } = await openrouter.chatStructured({
  messages: [
    { role: 'system', content: 'Return only valid JSON matching the schema.' },
    { role: 'user', content: 'Draft a vegan pasta recipe for 2 servings.' },
  ],
  schema: recipeSchema,
  model: 'openai/gpt-4o-mini',
  parameters: { temperature: 0.7, max_tokens: 800 },
});
```

- Correct `response_format` shape used internally by the service:
```ts
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'RecipeDraft',
    strict: true,
    schema: { /* JSON Schema object as above */ },
  },
}
```

4) Model name
- Methods:
  1. Default model set in config (`defaultModel`).
  2. Per-call override via `options.model`.
  3. Prefer models known to support strict JSON schema for structured outputs.
- Examples:
  1. `'openai/gpt-4o-mini'` for cost-effective structured outputs.
  2. `'anthropic/claude-3.5-sonnet'` for high-quality reasoning (verify schema support).

5) Model parameters
- Methods:
  1. Global defaults via `defaultParameters` in config.
  2. Per-call overrides via `options.parameters`.
  3. Enforce safe bounds in service (e.g., max `max_tokens`).
- Example:
```ts
await openrouter.chat({
  messages,
  parameters: {
    temperature: 0.4,
    max_tokens: 600,
    top_p: 0.9,
    presence_penalty: 0.1,
    frequency_penalty: 0.1,
    stop: ['```'],
  },
});
```


### 4) Private methods and fields

1. `_buildHeaders(): Record<string, string>`
   - Adds:
     - `Authorization: Bearer ${apiKey}`
     - `Content-Type: application/json`
     - `HTTP-Referer: ${siteUrl}` (OpenRouter best-practice for routing/analytics)
     - `X-Title: ${appTitle}`
     - Optional: `Idempotency-Key` (when provided by caller for safe retries)

2. `_buildBody(options: ChatRequest): OpenRouterChatBody`
   - Maps our types to OpenRouter’s request: `{ model, messages, temperature, max_tokens, top_p, stop, response_format, ... }`.
   - Normalizes/validates message structure; prunes undefineds.

3. `_post(path: string, body: unknown, timeoutMs: number): Promise<Response>`
   - Uses `fetchImpl` with AbortController timeout.
   - Applies retry strategy for transient errors.

4. `_parseChatResponse(json: unknown, responseFormat?: JsonSchemaResponseFormat): ChatResult`
   - Extracts `text` or parses JSON when `responseFormat` is present and strict.
   - Optionally validates against schema (defense-in-depth).

5. `_stream(path: string, body: unknown, onDelta: (d: StreamDelta) => void, timeoutMs: number, signal?: AbortSignal)`
   - Initiates SSE (`stream: true` in request if required by model) and yields deltas.
   - Handles backpressure, malformed lines, and early termination.

6. `_mapError(resp: Response, payload?: unknown): ServiceError`
   - Reads error JSON if present; maps to typed codes (`UNAUTHORIZED`, `RATE_LIMITED`, `INVALID_REQUEST`, `SERVER_ERROR`, etc.).

7. `_shouldRetry(error: unknown, attempt: number): boolean` and `_backoffMs(attempt: number): number`
   - Centralize retry policy (e.g., network errors, 429/5xx).

8. Private fields
   - `config: OpenRouterConfig`
   - `fetchImpl: typeof fetch`
   - `logger: LoggerLike`
   - `retry: RetryStrategy`


### 5) Error handling

List of potential scenarios and handling strategies:

1. Invalid/missing API key
   - Return `UNAUTHORIZED` with clear remediation; ensure key never leaks in logs.
2. 400 Bad Request (e.g., invalid schema or messages)
   - Return `INVALID_REQUEST` with details; include server-side validation to catch early.
3. 401 Unauthorized (bad key) / 403 (forbidden/quota)
   - Map to `UNAUTHORIZED`/`FORBIDDEN`; do not retry.
4. 404 Model not found / not enabled
   - Map to `NOT_FOUND`; suggest fallback model via config.
5. 409/412 Idempotency conflicts or precondition failures
   - Map to `CONFLICT`/`PRECONDITION_FAILED`; avoid blind retries.
6. 429 Rate limited
   - Map to `RATE_LIMITED`; honor `Retry-After`, apply exponential backoff.
7. 5xx OpenRouter/model provider failures
   - Map to `SERVER_ERROR`; retry with backoff up to capped attempts.
8. Network errors / timeouts
   - Map to `NETWORK_ERROR`/`TIMEOUT`; retry where safe.
9. Streaming aborted (client canceled)
   - Surface `ABORTED`; ensure resources cleaned up.
10. JSON parse or schema validation failure
   - Map to `PARSE_ERROR`/`SCHEMA_MISMATCH`; attach minimal context for debugging.
11. Unsupported `response_format` for chosen model
   - Early detect; throw `UNSUPPORTED_FEATURE` and recommend alternate model.
12. Oversized prompt/response (`max_tokens`/token limits)
   - Map to `TOKEN_LIMIT`; recommend truncation or lower `max_tokens`.

All errors should carry: `code`, `message`, `details?`, `status?`, and `requestId?` (if available from headers).


### 6) Security considerations

1. Never expose `OPENROUTER_API_KEY` to the browser; keep calls server-side under `src/pages/api`.
2. Read secrets from environment (Astro server runtime). Use production secrets in deployment and denylist them from logs.
3. Redact prompts/PII in logs and analytics; provide opt-in verbose logging for developers only.
4. Validate/limit input size (messages length, `max_tokens`) to mitigate abuse and cost spikes.
5. Enforce CORS rules on API routes; only allow app origin.
6. Implement per-user and global rate limiting on API routes.
7. Prefer `strict: true` JSON schema for machine-consumed responses; validate server-side.
8. Handle SSE cancellations and timeouts to avoid resource leaks.
9. Use idempotency keys for retried writes (if/when write-like operations are added).
10. Keep model capability allowlists to prevent unsupported combinations from reaching providers.


### 7) Step-by-step implementation plan

1. Environment and configuration
   - Add to `.env` (or platform secrets):
```bash
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://your-app-domain
OPENROUTER_APP_TITLE=10xCookbook
```
   - Create `src/lib/openrouter/config.ts` exporting a `loadOpenRouterConfig()` that reads env and returns `OpenRouterConfig`.

2. Types
   - Create `src/lib/openrouter/types.ts`:
     - `ChatMessage`, `ModelParameters`, `ChatRequest`, `ChatResult`
     - `JsonSchemaResponseFormat`, `ChatStructuredRequest<T>`, `StructuredResult<T>`
     - `StreamDelta`, `StreamResult`
     - `ServiceError` shape and `ErrorCode` enum

3. Service implementation
   - Create `src/lib/openrouter/OpenRouterService.ts` with methods described above.
   - Endpoint base: `POST ${baseUrl}/chat/completions`.
   - Headers: `Authorization`, `Content-Type`, `HTTP-Referer`, `X-Title`.
   - Respect `timeoutMs`, retries, and structured output handling.

4. API routes (Astro)
   - Create `src/pages/api/openrouter/chat.ts`:
     - `POST` accepts `{ messages, model?, parameters?, schema? }`.
     - If `schema` present, call `chatStructured`, else `chat`.
     - Return `{ result }` with `200` or a structured error with `>=400`.
   - Create `src/pages/api/openrouter/stream.ts`:
     - `POST` accepts same body; sets `Content-Type: text/event-stream`.
     - Pipes deltas from `streamChat` to the response; supports `AbortSignal` on disconnect.

5. Client integration (React 19)
   - Wrap calls in a small client utility (browser) that posts to `/api/openrouter/chat`.
   - For streaming, use `EventSource`/`fetch ReadableStream` depending on Astro adapter.
   - Example (non-streaming):
```ts
const res = await fetch('/api/openrouter/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Generate a gluten-free pancake recipe.' },
    ],
    model: 'openai/gpt-4o-mini',
    parameters: { temperature: 0.5, max_tokens: 600 },
  }),
});
const { result } = await res.json();
```

6. Structured output in practice
   - Define a schema (see `recipeSchema` example above).
   - Call `POST /api/openrouter/chat` with `{ schema }` to receive strict JSON.
   - Validate and store in Supabase as needed (`src/db`).

7. Logging and metrics
   - Provide a `logger` implementation with prompt redaction.
   - Emit counters/timers around request latency, tokens used, error rates.

8. Rate limiting and safeguards
   - Add per-user rate limits on API routes.
   - Enforce caps on `max_tokens` and messages length.

9. Testing
   - Unit test `_buildBody`, `_parseChatResponse`, error mapping, and schema validation with fixtures.
   - Integration test against mocked OpenRouter (or recorded responses).

10. Deployment
   - Ensure secrets present in environment.
   - Confirm outbound HTTPS allowed to `openrouter.ai`.
   - Monitor logs for 429s/5xx and adjust retry/backoff or model choices.


### Appendix: Minimal request body shape (reference)

- Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`
```json
{
  "model": "openai/gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.5,
  "max_tokens": 256,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "RecipeDraft",
      "strict": true,
      "schema": { "type": "object" }
    }
  }
}
```


