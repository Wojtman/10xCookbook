# API Endpoint Implementation Plan: Ingredient Search

## 1. Endpoint Overview
- Provide a read-only autocomplete/search capability over the global ingredient catalog for both anonymous and authenticated users.
- Accept a search query, return matching ingredient records (`id`, `name`, `description`) sorted by relevance (case-insensitive prefix/full match using Supabase/Postgres capabilities).
- Enable clients to tailor response size via an optional `limit`, maintaining guardrails to protect database performance.

## 2. Request Details
- HTTP Method: `GET`
- URL Structure: `/ingredients/search`
- Query Parameters:
  - Required:
    - `q` (string): Trimmed search term, minimum 2 characters. Treat as case-insensitive due to `citext` column.
  - Optional:
    - `limit` (number): Results cap; default 10, maximum 50. Values outside range trigger validation errors.
- Request Body: None.
- Headers: Inherit defaults; no special auth header required but session cookies may be present. Consider adding `Cache-Control` on response for short-lived caching.

## 3. Response Details
- Success `200 OK`:
  - Body conforms to `IngredientSearchResponseDTO` with `ingredients: IngredientCatalogDTO[]` and `total` matching Supabase count (or array length when count unavailable).
  - Set `Content-Type: application/json` and `Cache-Control: public, max-age=30` (tunable) to leverage edge caching while keeping data fresh.
- Error Responses (JSON):
  - `400 Bad Request` with `ErrorResponseDTO` when query validation fails (e.g., missing/short `q`, invalid `limit`).
  - `500 Internal Server Error` leveraging `createInternalErrorResponse()` with `request_id` when Supabase fails or unexpected exceptions arise.
- Empty result sets still yield `200 OK` with `ingredients: []`, `total: 0`.

## 4. Data Flow
- Astro API handler obtains `locals.supabase` (scoped Supabase client per request) and generates `requestId` for logging.
- Parse `q`/`limit` via new Zod schema (`IngredientSearchQuerySchema`) producing a typed `IngredientSearchQueryParams` payload.
- Pass validated params to a new `searchIngredients` function in `src/lib/services/ingredient.service.ts`.
  - Service performs sanitized pattern search (`ilike` with escaped wildcards) against `ingredients` table.
  - Applies `.limit()` and `.order('name', { ascending: true })` (or RANK) while requesting exact count when feasible.
- Service returns `IngredientSearchResponseDTO`; handler serializes to JSON and returns response with caching headers.
- Errors thrown by validation or service bubble to handler blocks that map them to proper HTTP status codes and log via `console.error`.

## 5. Security Considerations
- Authentication optional, but Supabase Row Level Security must allow read access to `ingredients` for anonymous role; verify policy before deployment.
- Validate and sanitize query input to avoid wildcard abuse and to mitigate potential SQL injection; rely on Supabase parameterization plus manual escaping of `%`/`_`.
- Guard against abuse by optionally integrating existing `rateLimit.service` for anonymous requests (future enhancement noted in comments).
- Ensure no write operations or sensitive columns are exposed; response limited to `id`, `name`, `description`.
- Monitor for excessive query sizes by enforcing `limit` bounds and trimming `q`.

## 6. Error Handling
- Validation failures: catch `ZodError`, respond with `createErrorResponse(400, 'validation_error', ...)`, include field paths from Zod issues.
- Service-level Supabase errors: wrap in custom `IngredientServiceError`; handler logs `error.cause` and responds with `createInternalErrorResponse(requestId)`.
- Unexpected runtime errors: catch-all branch logs stack trace with `[Ingredients#search]` prefix and returns standardized 500 response.
- No `404` scenario; empty results are not errors. Missing `q` or being below length threshold handled via 400 validation error.

## 7. Performance
- Limit Supabase query to requested `limit` and rely on Postgres indexes (`citext` column allows btree index usage for case-insensitive searches). Verify/advise creation of functional index on `LOWER(name)` if performance lags.
- Use `select('*', { count: 'exact' })` cautiously; if cost becomes high, consider returning `total` based on array length instead of exact count for huge tables (document fallback).
- Add short-lived caching headers and consider client-side caching for repeated queries with identical inputs.
- Escape user input once and reuse sanitized value; avoid re-allocating regex per request.
- Keep service lean to minimize latency; avoid multiple round trips—single Supabase query suffices.

## 8. Implementation Steps
1. **Add validation schema:** Create `src/lib/validation/ingredient.validator.ts` exporting `IngredientSearchQuerySchema` (Zod) and inferred TypeScript type; include helper to escape wildcard characters.
2. **Create ingredient service:** Add `src/lib/services/ingredient.service.ts` with `IngredientServiceError` class and `searchIngredients(client, params)` function using `SupabaseClient` type from `src/db/supabase.client.ts`.
3. **Implement API route:** Create `src/pages/api/ingredients/search.ts`:
   - `prerender = false`, parse query via validator, call service, build `200` JSON response with caching header.
   - Handle `ZodError`, `IngredientServiceError`, and unexpected errors following existing tag endpoint patterns.
4. **Wire DTO usage:** Ensure service returns `IngredientSearchResponseDTO` structure and handler serializes using `JSON.stringify`.
5. **Add logging:** Standardize `console.error` lines with requestId for Supabase/unexpected errors, mirroring tags endpoints.
6. **Optional rate limit hook:** Evaluate integrating `rateLimit.service` (if simple) or leave TODO comment referencing follow-up story.
7. **Testing & verification:** Add or update unit/integration tests under `src/__tests__` (if test harness exists) for validator and service; manually verify endpoint via local dev (Supabase connection) ensuring 400/200/500 paths behave.
8. **Documentation & PR notes:** Update API docs if required and reference this plan in PR description, highlighting any Supabase policy prerequisites.

