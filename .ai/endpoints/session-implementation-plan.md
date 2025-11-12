# API Endpoint Implementation Plan: Session Endpoints

## 1. Endpoint Overview
- Deliver two session-related endpoints: unauthenticated `POST /api/sessions/anonymous` for issuing short-lived anonymous session tokens, and authenticated `POST /api/sessions/migrate` for moving anonymous recipe drafts into a user-owned cookbook.
- Persist anonymous session metadata (token hash, expiry, migration audit columns) in a new `anonymous_sessions` table and store recipe drafts in `anonymous_recipes`, `anonymous_recipe_ingredients`, and `anonymous_recipe_tags` keyed by `session_id`.
- Reuse existing Supabase client in Astro API routes, service/validator patterns, and analytics logging pipeline to ensure consistency with current backend architecture.
- Enforce analytics instrumentation (`session_start` and `session_end`) and structured error responses via `buildErrorResponse`.

## 2. Request Details

### 2.1 POST /api/sessions/anonymous
- **Authentication:** None (public endpoint).
- **Rate limiting:** Throttle by hashed client IP (max N per hour, configure constant) using `ensureWithinRateLimit` prior to issuing a token.
- **Request Body / Parameters:** None; rely solely on request metadata.
- **Headers:** Inspect `x-forwarded-for` or `cf-connecting-ip` for rate limiting and audit logging.

### 2.2 POST /api/sessions/migrate
- **Authentication:** Required; validate Supabase session via `locals.supabase.auth.getUser()`.
- **Content-Type:** `application/json`.
- **Request Body (validated by Zod schema):**
  ```json
  {
    "session_id": "string (required, UUIDv4)",
    "target_cookbook_id": "string (optional, UUIDv4)"
  }
  ```
- **Command model:** Map validated payload to `MigrateRecipesCommand` (`session_id`, optional `target_cookbook_id`).
- **Additional validation:** Confirm `target_cookbook_id`, when present, belongs to the authenticated user; otherwise resolve or create default cookbook.

## 3. Response Details
- **Anonymous session creation (201 Created):** Return `SessionResponseDTO` (`session_id`, `expires_at`, `message`). `session_id` is the opaque token; `expires_at` derived from configured TTL (e.g., 24 hours). Include standard `Content-Type: application/json`.
- **Migration success (200 OK):** Return `MigrationResponseDTO` with migrated recipe count, resolved cookbook ID, and success message. Set `session_end` analytics event on success.
- **Error format:** Always emit `ErrorResponseDTO` with appropriate `error` code (`validation_error`, `unauthorized`, `session_not_found`, `already_migrated`, etc.) and optional `fields` array; include `request_id` correlation if available.

## 4. Data Flow
- **Anonymous Session Creation:**
  1. Compute requester fingerprint (`clientIpHash`) and enforce rate limit via `ensureWithinRateLimit` (identify by synthetic session key such as `ip:${hash}` stored in analytics events).
  2. Generate cryptographically strong token (use `crypto.randomUUID()` and optionally append random bytes); store only a SHA-256 hash in `anonymous_sessions` with expiry (`now + TTL`), `created_at`, `client_fingerprint`, and `analytics_cursor`.
  3. Insert session row; capture `id` (UUID PK) and `expires_at`.
  4. Log analytics `session_start` event with `session_id` (plain token) and `user_id: null`.
  5. Respond with plaintext token and expiry while warning about temporary nature.

- **Anonymous Recipe Migration:**
  1. Authenticate user and parse JSON, validating with `SessionMigrationSchema` (`z.object({ session_id: z.string().uuid(), target_cookbook_id: z.string().uuid().optional() })`).
  2. Query `anonymous_sessions` by hashed token; ensure session exists, not expired, and not already migrated. On failure, throw typed errors (`SessionNotFoundError`, `SessionAlreadyMigratedError`, `SessionExpiredError`).
  3. Resolve destination cookbook:
     - If `target_cookbook_id` provided, verify ownership via `cookbooks` table (`user_id === authUser.id`).
     - Otherwise fetch user’s default cookbook (`is_default = true`); if missing, create one via `CookbookService`.
  4. Fetch all anonymous recipes and related data for the session (ordered by `display_order`). If none, return 404.
  5. Within a Supabase transaction (RPC or `supabaseClient.transaction` helper), insert rows into `recipes`, `recipe_ingredients`, and `recipe_tags` mapping anonymous IDs to new UUIDs, preserving ordering and timestamps. Use bulk insert patterns for efficiency.
  6. Mark session as migrated (`migrated_at`, `migrated_by_user_id`, `target_cookbook_id`) and delete anonymous draft rows to prevent replays.
  7. Log analytics `session_end` event and optionally `recipe_save` events per migrated recipe for richer telemetry.
  8. Return migration summary with count of recipes inserted and cookbook ID.

## 5. Security Considerations
- Store only hashed session tokens server-side; redact plaintext token after response to reduce leakage risk.
- Bind migration to authenticated users; ensure session cannot be migrated twice or by a different account through atomic updates/transactions.
- Enforce expiration (e.g., 24h) and purge expired sessions regularly to avoid indefinite access.
- Harden rate limiting to mitigate abuse of anonymous session creation (leverage hashed IP or user-agent combinations).
- Validate cookbook ownership and restrict Supabase RLS policies to prevent cross-user access during inserts.
- Sanitize and constrain analytics logging to avoid accepting arbitrary `event_data` from anonymous clients.

## 6. Error Handling
- **400 Bad Request:** Invalid JSON, schema validation failures, already migrated session, expired session, cookbook ownership mismatch. Return `validation_error` or domain-specific codes.
- **401 Unauthorized:** Missing Supabase session when calling migrate endpoint.
- **404 Not Found:** Session token not found, no recipes associated with session, or target cookbook absent.
- **409 Conflict (optional):** If concurrent migration detected while updating session row.
- **429 Too Many Requests:** Rate limit exceeded for anonymous session creation (surface `retry_after` header).
- **500 Internal Server Error:** Supabase insert/select failures, transaction rollback, analytics logging errors (after logging and masking details).
- Include structured logging (`console.error`) with request context; consider augmenting analytics with failure events if helpful.

## 7. Performance
- Use bulk inserts for recipe migration and wrap in single transaction to minimize round trips.
- Index `anonymous_sessions.token_hash` and `expires_at` for fast lookups and cleanup; index `anonymous_recipes.session_id` for joins.
- Schedule background job (Supabase cron or edge function) to purge expired sessions and orphaned drafts, keeping tables lean.
- Ensure analytics logging is non-blocking; handle failures gracefully without delaying responses when possible.
- Keep response payloads lightweight; only include summary metadata post-migration.

## 8. Implementation Steps
1. **Database migrations:** Create `anonymous_sessions` (PK UUID, `token_hash`, `expires_at`, `created_at`, `migrated_at`, `migrated_by_user_id`, `client_fingerprint`), `anonymous_recipes`, `anonymous_recipe_ingredients`, and `anonymous_recipe_tags` tables mirroring required recipe columns with foreign keys and indexes; add policies for server-side operations.
2. **Domain models:** Extend `src/types.ts` with helper interfaces for anonymous session creation result and anonymous recipe draft records if needed.
3. **Validation layer:** Add `session.validator.ts` exporting schemas/types for session creation (trivial) and `MigrateRecipesCommand`; include helpers for deriving `clientIpHash`.
4. **Service layer:** Implement `SessionService` with methods `createAnonymousSession`, `verifySession`, `migrateSessionData`, and helper errors; reuse Supabase transactions and existing cookbook service for default cookbook resolution.
5. **API routes:** Add `src/pages/api/sessions/anonymous.ts` and `src/pages/api/sessions/migrate.ts`, following existing controller style (auth guard, validation, service orchestration, error mapping, analytics logging).
6. **Analytics integration:** Utilize `logAnalyticsEvent` to emit `session_start`/`session_end`; adapt `RateLimitService` or extend it to accept IP-based keys for anonymous throttling.
7. **Testing:** Create unit tests for validators/service (mock Supabase client) and integration tests hitting new API routes (happy path, expired session, already migrated, cookbook invalid, rate limit).
8. **Docs & maintenance:** Update `.ai/api-plan.md` or README with session lifecycle details, document retention/cleanup strategy, and ensure deployment scripts include migration ordering and environment variables (session TTL, rate limit thresholds).

