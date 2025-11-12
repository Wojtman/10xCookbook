# API Endpoint Implementation Plan: Tags

## 1. Endpoint Overview
- Public read-only endpoints that expose the predefined taxonomy stored in the `tags` table.
- `GET /tags` returns the full collection along with a `total` count for client-side display.
- `GET /tags/:id` retrieves an individual tag by UUID or slug; used for detail pages and validation during recipe editing.

## 2. Request Details
- **HTTP Methods:** `GET`
- **URL Structures:** `/tags`, `/tags/:id`
- **Parameters:**
  - `GET /tags`
    - Required: none
    - Optional: none (future-safe by ignoring unexpected query params after validation)
  - `GET /tags/:id`
    - Required path parameter `id` (string; validated as UUID or slug)
    - Optional: none
- **Headers:** Standard JSON response; no authentication header required.

## 3. Response Details
- **Success (200):**
  - `/tags`: `{ tags: TagDTO[]; total: number }`
  - `/tags/:id`: `TagDTO`
  - Ensure responses use ISO8601 timestamps as provided by Supabase.
- **Error Codes:**
  - `400` with `validation_error` when `id` param is empty or malformed.
  - `404` with `not_found` when no tag matches the identifier.
  - `500` with `internal_server_error` when Supabase queries fail unexpectedly.
- **Headers:** Set `Content-Type: application/json` and consider `Cache-Control: public, max-age=60` to allow short-lived caching.

## 4. Data Flow
- Astro API handler obtains `locals.supabase` and request parameters from the context.
- Validation layer (Zod) ensures incoming params are well-formed before any database access.
- Handler delegates to `tag.service` which:
  - For collection: executes `select('*', { count: 'exact' })` ordered by `label`, returns data plus count.
  - For single tag: determines if identifier is UUID (regex test) or slug, performs the corresponding `eq` filter with `.single()`.
  - Throws typed errors (`TagNotFoundError`, `TagServiceError`) consumed by the route to map to HTTP responses.
- Handler serializes DTOs (no transformation needed beyond ensuring nullable fields default to `null`) and returns standardized responses.

## 5. Security Considerations
- Endpoints are intentionally unauthenticated; ensure no user context is required.
- Strict input validation prevents malformed identifiers from reaching Supabase, mitigating injection or excessive pattern matching.
- Rate limiting is not mandated but can rely on platform-level protections; document that repeated probing may be handled by global middleware if needed.
- Avoid leaking internal error messages; rely on custom error classes and `createErrorResponse` helper.

## 6. Error Handling
- Use `createErrorResponse`/`createInternalErrorResponse` helpers for consistency.
- Translate validation issues (empty param, invalid UUID/slug characters) to `400`.
- Translate service `TagNotFoundError` to `404`.
- Log unexpected Supabase failures with `console.error` including request identifier before returning `500`.
- Ensure promise rejections from Supabase are caught and normalized.

## 7. Performance Considerations
- Tag dataset is small; leverage `select('*', { count: 'exact' })` without pagination.
- Add ordering by `label` to maintain deterministic results and reduce client sorting work.
- Apply short-duration caching headers (`max-age=60`) to reduce repeated fetches.
- Keep service functions stateless to allow future memoization or CDN caching if dataset grows.

## 8. Implementation Steps
1. **Type updates:** Extend `src/types.ts` with `export interface TagListResponseDTO { tags: TagDTO[]; total: number; }` (and optionally `TagResponseDTO = TagDTO` for clarity).
2. **Validation schema:** Create `src/lib/validation/tag.validator.ts` exporting `TagIdentifierSchema = z.string().min(1)` plus utility `isUuid` helper.
3. **Service abstraction:** Add `src/lib/services/tag.service.ts` defining `TagNotFoundError`, `TagServiceError`, `fetchAllTags`, and `fetchTagByIdentifier` that query Supabase using the provided client.
4. **Route implementations:** 
   - Add `src/pages/api/tags/index.ts` with `prerender = false`, `GET` handler, validation hooks, service invocation, and `Cache-Control` header.
   - Add `src/pages/api/tags/[id].ts` that parses `params.id`, runs schema validation, calls the service, and maps service errors to HTTP codes.
5. **Error handling wiring:** Ensure both handlers wrap service calls in try/catch to convert service errors via `createErrorResponse`; include request IDs in logs for traceability.
6. **Testing & verification:** If automated tests exist, add unit/integration coverage for service functions (mock Supabase), or document manual verification via `curl`/Thunder Client.
7. **Documentation:** Update `.ai/api-plan.md` or public API docs if needed to indicate caching headers or validation specifics after implementation.

