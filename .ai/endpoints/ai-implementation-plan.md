# API Endpoint Implementation Plan: AI Parse Recipe

## 1. Endpoint Overview

Provides a POST endpoint at `/api/ai/parse` that accepts raw recipe text, calls the OpenRouter-powered AI parsing service, and returns structured recipe metadata (title, preparation description, ingredients, tags, prep time). Access is restricted to authenticated users and enforces analytics logging, validation limits, and rate limiting (10 requests per minute per user).

## 2. Request Details

- **HTTP Method:** POST
- **URL Structure:** `/api/ai/parse`
- **Authentication:** Required; authenticated users identified via Supabase session in `locals`.
- **Headers:** `Content-Type: application/json`; set `Authorization` header for authenticated requests.
- **Request Body Schema:**
  ```json
  {
    "raw_text": "string (required, non-empty, <= 50000 chars)"
  }
  ```
- **Validation Rules:**
  - Trim and assert `raw_text` length > 0 and ≤ `VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH`.
  - Sanitize `raw_text` to guard against prompt-injection metadata leakage (strip high-risk headers if adding).
  - Request must be made by an authenticated user (`locals.user` present).
  - Reject extra payload fields after safe parsing (Zod `.strict()`).
- **Rate Limiting:** Before invoking AI, count requests in last minute per `user_id`; reject with 429 when count ≥ 10.

## 3. Response Details

- **Success (200):**
  - Body shape matches `AIParseResponseDTO`:
    ```json
    {
      "title": "string",
      "preparation_description": "string",
      "prep_time_minutes": 123,
      "ingredients": [{ "display_order": 0, "name": "string", "quantity": "string", "notes": "string" }],
      "suggested_tags": ["string"],
      "parsing_duration_ms": 4567
    }
    ```
  - `ingredients` entries align with `AISuggestedIngredient`.
  - `parsing_duration_ms` measured end-to-end (or supplied by service).
- **Error Responses:**
  - 400 `ErrorResponseDTO` for validation problems (`error="validation_error"`, include `fields`).
  - 401 handled upstream by middleware when authorization fails.
  - 408 with `{ error: "parse_timeout", message, timeout_ms }` on AI timeout.
  - 429 with `{ error: "rate_limit_exceeded", message, retry_after }`.
  - 500 with `{ error: "parse_error", message, error_code }` for upstream failures.

## 4. Data Flow

1. Astro API handler (`src/pages/api/ai/parse.ts`) receives request; obtains Supabase client/user/session via `context.locals`.
2. Parse JSON and validate with Zod schema in `src/lib/validation/ai.validator.ts`.
3. Identify caller context:
   - Authenticated: use Supabase user id.
4. Invoke rate-limiter helper (new `ensureWithinRateLimit` in `src/lib/services/rate-limit.service.ts` or inline) that queries Supabase `analytics_events` for `recipe_parse_requested` in the last 60s keyed by user; insert guard row if within limit.
5. Log analytics `recipe_parse_requested` event via dedicated helper (new `analytics.service` function) using `LogAnalyticsEventCommand`.
6. Call AI parsing service abstraction (new `src/lib/services/aiParsing.service.ts`) which:
   - Builds OpenRouter request payload (model, prompt/template, raw_text) using environment config.
   - Enforces 10s timeout (e.g., `AbortController`).
   - Maps AI response JSON into internal DTO (list of ingredients, etc.).
   - Handles provider-level errors/timeouts, throwing typed errors.
7. On success:
   - Log `recipe_parse_success` with duration & ingredient count.
   - Return `AIParseResponseDTO` to caller.
8. On timeout or errors:
   - Log corresponding analytics event (`recipe_parse_timeout` or `recipe_parse_error`).
   - Return mapped error response/status.

## 5. Security Considerations

- Use Astro middleware to retrieve Supabase session; never trust client-provided `user_id`.
- Validate and sanitize `raw_text` to prevent prompt injection from affecting future AI prompts; avoid echoing raw data in error messages.
- Protect OpenRouter API key via server-side env (`import.meta.env`), never expose to client.
- Rate limiting prevents abuse/DoS via repeated AI calls.
- Avoid logging sensitive recipe content verbatim; consider truncating when writing server logs or analytics `event_data`.
- Ensure Supabase RLS policies on `analytics_events` allow inserts for service role but prevent read exposure to clients.

## 6. Error Handling

- Validation failures: return 400 with `ErrorResponseDTO`, include problematic fields.
- Missing/expired authentication: rely on middleware to emit 401 before handler executes.
- Rate limit exceeded: short-circuit with 429, include `retry_after: 60`.
- AI timeout (AbortError or provider timeout flag): respond 408 with `timeout_ms` from constants; log timeout analytics.
- Provider/API errors (non-2xx, malformed response): map to 500 `parse_error`, include `error_code` (e.g., `ai_service_unavailable`) but avoid leaking internal stack traces.
- Unexpected runtime errors: catch-all returning 500 with generic message; log details to server console/logger.
- Always clean up analytics logging to avoid partial state (e.g., log success only after response mapping succeeds).

## 7. Performance Considerations

- Rate limit short-circuits before expensive AI call.
- Use streaming `fetch` timeouts to prevent hanging connections.
- Reuse Supabase client from `locals` to avoid re-auth overhead.
- Minimize DB queries: rate limit check should use indexed query on `analytics_events` (`event_type`, `created_at`); ensure index exists (`create_indexes.sql` likely covers).
- Handle large `raw_text` by avoiding unnecessary copies (stream to AI? if provider requires entire text, ensure request body not string-concatenated multiple times).
- Consider caching frequent identical requests (optional future enhancement) but not required for MVP.

## 8. Implementation Steps

1. **Define Validation Schema:** Add `aiParseRequestSchema` in `src/lib/validation/ai.validator.ts` using Zod, enforcing required fields and limits; export helper to infer `AIParseCommand`.
2. **Create Service Abstractions:**
   - `src/lib/services/aiParsing.service.ts` with `parseRecipeWithAI({ raw_text })` using OpenRouter (handle timeout, response mapping to `AIParseResponseDTO`).
   - `src/lib/services/analytics.service.ts` (or extend existing) with `logAnalyticsEvent(supabase, command)` returning inserted event.
   - `src/lib/services/rate-limit.service.ts` helper to enforce per-minute threshold.
3. **Implement Endpoint Handler:** Create `src/pages/api/ai/parse.ts`:
   - Import validation, services, `VALIDATION_CONSTANTS`.
   - Acquire Supabase client and user/session from context.
   - Validate input; derive caller identifier.
   - Run rate limit check.
   - Log `recipe_parse_requested`.
   - Invoke AI parsing service with timeout guard.
   - On success: log `recipe_parse_success` with metadata, return 200 JSON.
   - On errors: map to response codes per section 6.
4. **Add Utility Types:** Ensure handler reuses existing DTOs from `src/types.ts`; extend types if AI response needs additional fields (avoid duplication).
5. **Configure Environment:** Document required env vars (`OPENROUTER_API_KEY`, model ID) and set fetch headers (e.g., `HTTP-Referer`, `X-Title` if OpenRouter requires).
6. **Testing:** Write unit/integration tests under `src/__tests__/api/ai-parse.test.ts` covering validation, rate limit logic (mock Supabase), success map, timeout, provider error.
7. **Analytics & Rate Limit SQL:** Verify Supabase migrations include needed indexes for analytics queries; add new index if missing.
8. **Documentation:** Update `.ai/api-plan.md` or README usage notes if necessary; ensure endpoint added to overall API documentation and OpenAPI spec if maintained.
9. **Lint & QA:** Run lint/tests; ensure handler conforms to project rules (use `context.locals.supabase`, Zod validation, consistent error formatting).
