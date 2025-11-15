# API Endpoint Implementation Plan: Log Analytics Event

## 1. Endpoint Overview

- Accepts analytics events from authenticated users via `POST /analytics/events`.
- Validates `event_type` before inserting into Supabase `analytics_events`.
- Delegates persistence to the existing `logAnalyticsEvent` service to keep the API route lean and reusable across future triggers (e.g., background jobs).

## 2. Request Details

- HTTP Method: `POST`
- URL Structure: `/analytics/events`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` (resolved through `locals.supabase.auth.getUser()`)
- Body Parameters (JSON shaped as `LogAnalyticsEventCommand`):
  - **Required**
    - `event_type`: string constrained to the predefined `AnalyticsEventType` union.
  - **Optional**
    - `event_data`: JSON object for contextual metadata; reject `null`, arrays, or primitive values.
- Validation:
  - Introduce `AnalyticsEventSchema` (Zod) with `.strict()` to block unknown top-level fields and `.transform` to trim strings.
  - Reuse the shared `AnalyticsEventType` list (via `z.enum([...])` or the `isValidAnalyticsEventType` guard) so validation and type inference stay aligned.
  - Consider applying a serialized size cap (e.g., ≤10 KB) on `event_data` to prevent oversized payloads; respond with 400 if exceeded.

## 3. Response Details

- **201 Created** — returns `AnalyticsEventResponseDTO` (`{ event_id, created_at }`) on success.
- **400 Bad Request** — invalid JSON body, missing required fields, disallowed `event_type`, or oversized `event_data`; return `ErrorResponseDTO` including `fields` from Zod.
- **401 Unauthorized** — Supabase authentication attempt fails (invalid/expired bearer token) when the client expected authenticated context; return `ErrorResponseDTO`.
- **500 Internal Server Error** — Supabase insert failures or unexpected exceptions; use `createInternalErrorResponse` with a generated request ID.
- Always set `Content-Type: application/json` on responses.

## 4. Data Flow

1. Add Astro API route `src/pages/api/analytics/events.ts` exporting `prerender = false` and a `POST` handler only.
2. Generate `requestId = crypto.randomUUID()` for tracing; log this ID in error paths.
3. Acquire Supabase client from `locals.supabase` and call `auth.getUser()`:
   - Use the returned `user?.id` when available.
   - Requests without an authenticated user are rejected with 401.
4. Parse the request body via `await request.json()`; wrap in try/catch to handle malformed JSON with a 400 response.
5. Validate the parsed payload with `AnalyticsEventSchema.safeParse`; on failure, map issues to `createErrorResponse(400, 'validation_error', ...)`.
6. Call `logAnalyticsEvent({ supabase: locals.supabase, userId: user?.id as string, command: validatedData })`.
7. On success, return `new Response(JSON.stringify(result), { status: 201, headers: { 'Content-Type': 'application/json' } })`.
8. Catch `AnalyticsServiceError`:
   - Log with `console.error` alongside `requestId` and `error.cause`.
   - Respond via `createInternalErrorResponse(requestId)`.
9. Catch any other unexpected errors, log, and fallback to the same 500 response helper.

## 5. Security Considerations

- Enforce strict validation on `event_type` to prevent injection of arbitrary values or table pollution.
- Reject `event_data` that is not a plain JSON object and cap payload size to mitigate abuse.
- Never accept client-supplied `user_id`; rely solely on Supabase auth context.
- Avoid leaking Supabase error details in responses; only log them server-side with the request ID.
- Coordinate with global middleware or platform-level throttling to deter high-volume event spam (document expectation if rate limiting is handled elsewhere).

## 6. Error Handling

- Zod validation failures → `createErrorResponse(400, 'validation_error', 'Payload failed validation', fields)`.
- JSON parsing errors → `createErrorResponse(400, 'validation_error', 'Invalid JSON payload')`.
- Supabase auth errors (invalid token) → `createErrorResponse(401, 'unauthorized', 'Invalid authentication token')`.
- Known `AnalyticsServiceError` → log and return `createInternalErrorResponse(requestId)`.
- Unexpected exceptions → log `[Analytics#POST] Unexpected error (${requestId})` and return the generic 500 helper.

## 7. Performance Considerations

- Single-row insert keeps latency low; avoid redundant Supabase queries (call `auth.getUser()` only once).
- Cap `event_data` size and strip empty objects to keep rows lightweight and storage costs predictable.
- Reuse the existing Supabase client from `locals` instead of instantiating a new client.
- Avoid expensive serialization by reusing the validated payload when calling the service.

## 8. Implementation Steps

1. **Validation Layer:** Create `src/lib/validation/analytics.validator.ts` exporting `AnalyticsEventSchema`, inferred `AnalyticsEventInput`, and helper to map Zod issues to string paths; derive event type options from `AnalyticsEventType`.
2. **Service Type Alignment:** Update `src/lib/services/analytics.service.ts` to import `SupabaseClient` type from `src/db/supabase.client.ts`, attach the original Supabase error to `AnalyticsServiceError` via `cause`, and ensure the service still returns `AnalyticsEventResponseDTO`.
3. **API Route:** Implement `src/pages/api/analytics/events.ts` with `prerender = false`, the POST handler described above, and reuse `createErrorResponse` / `createInternalErrorResponse`.
4. **Validation Usage:** Within the route, parse and validate JSON, enforce event-data size limits, and convert Zod issues to the `fields` array in `ErrorResponseDTO`.
5. **Logging & Monitoring:** Standardize error logs with namespace `[Analytics#POST]` including `requestId`, request metadata (`event_type`) when safe, and use structured logging if available.
6. **Testing & QA:** Document manual verification steps (e.g., `curl` happy-path and validation failure) and add unit/integration tests for the validator and route (mocking Supabase) if the testing harness exists.
