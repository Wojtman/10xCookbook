# API Endpoint Implementation Plan: Upload Recipe Image

## 1. Endpoint Overview

- Provide a `POST /images/upload` API for anonymous and authenticated users to upload recipe images.
- Validate and normalize incoming images (max 2 MB, PNG/JPEG/WebP, ≤1024×1024 px) before compressing to WebP and storing in Supabase Storage.
- Enforce per-user/per-session rate limiting (20 uploads/hour) and return standardized metadata about the processed image.

## 2. Request Details

- HTTP Method: `POST`
- URL Structure: `/images/upload`
- Parameters:
  - Required: `file` (multipart form-data file part)
  - Conditional: `session_id` (required when request is anonymous; ignored if authenticated user present)
- Request Body:
  - Multipart form-data payload containing the image file and, when needed, `session_id`.
  - No JSON body; ensure the Astro route consumes multipart form-data and converts file to `File`/`Blob`.
- Headers:
  - `Authorization: Bearer <token>` for authenticated users (handled by Supabase auth from `locals.supabase`).
  - `Content-Type: multipart/form-data` with boundary (browser generated).

## 3. Used Types

- `ImageUploadResponseDTO` — success response payload.
- `ErrorResponseDTO` — standardized error shape for 4xx/5xx responses.
- `VALIDATION_CONSTANTS.IMAGE` — max size/dimensions/list of allowed formats.
- Introduce internal service contract (e.g., `ImageUploadRequest`/`ImageUploadResult`) inside `src/lib/services/imageUpload.service.ts`; no external DTO change required.

## 4. Response Details

- Success (201 Created):
  - Returns `ImageUploadResponseDTO` containing `image_url`, `width`, `height`, `size_bytes`, `format`.
- Error responses:
  - 400 Bad Request — missing file, invalid dimensions after processing, missing `session_id` for anonymous, failed validation.
  - 401 Unauthorized — Supabase session invalid or missing for authenticated flow.
  - 413 Payload Too Large — file exceeds 2 MB limit before processing.
  - 415 Unsupported Media Type — MIME type or extension not in PNG/JPEG/WebP.
  - 429 Too Many Requests — rate limit exceeded (per user/session); include retry-after header.
  - 500 Internal Server Error — storage or transformation failure (Sharp/Supabase issues).
- Always emit JSON with `ErrorResponseDTO` for errors.

## 5. Data Flow

1. Astro API route receives multipart request; set `export const prerender = false`.
2. Retrieve Supabase client from `context.locals.supabase` and attempt to resolve authenticated user.
3. Parse `formData`:
   - Extract `file` as `File`.
   - Extract `session_id` string.
4. Validate inputs via Zod schema:
   - Ensure `file` exists, size ≤ `VALIDATION_CONSTANTS.IMAGE.MAX_FILE_SIZE_BYTES`, and MIME/extension permitted.
   - Require `session_id` when no authenticated user; trim/validate length.
5. Determine rate-limit key:
   - If user authenticated → `user.id`.
   - Else → provided `session_id`.
6. Invoke image upload service:
   - Service checks rate limit using Supabase Postgres (e.g., `analytics_events` new `event_type: 'image_upload'`) or dedicated table.
   - On pass, stream file to Sharp, downscale (≤1024), normalize to square (crop or contain with padding), convert to WebP.
   - Generate unique storage key (folder per user/session) and upload to Supabase Storage bucket (configurable env).
   - Persist rate-limit marker (insert event row with timestamp).
   - Return metadata (url, width, height, size, format).
7. Endpoint returns 201 with DTO.
8. On failure, map service errors to appropriate HTTP code and emit `ErrorResponseDTO`.

## 6. Security Considerations

- Authentication:
  - Use Supabase auth via `context.locals.supabase`; treat absence as anonymous and require `session_id`.
- Input sanitization:
  - Reject files exceeding size/type constraints before reading into memory to limit resource usage.
  - Re-encode images with Sharp to strip EXIF/embedded malware.
- Storage safety:
  - Generate server-side UUID filenames; prevent user-supplied names.
  - Store in dedicated Supabase bucket with restrictive public access (signed URLs or read-only policy).
- Rate limiting:
  - Enforce 20 uploads/hour per key; return 429 on violation.
  - Consider storing counts in Supabase table with composite key `(owner_key, hour_window)`.
- CORS & CSRF:
  - Endpoint likely used via same origin; ensure Astro default CSRF protections or require auth headers; reject non-POST methods.
- Logging:
  - Use Astro logger to capture validation failures and processing errors without leaking sensitive info.

## 7. Error Handling

- Validation errors:
  - Build Zod error map to `ErrorResponseDTO` with `error: 'validation_error'` and `fields` array.
- Missing/invalid file:
  - 400 with `error: 'file_missing'` or `'validation_error'`.
- Size > limit:
  - 413 with `error: 'file_too_large'`.
- MIME/type mismatch:
  - 415 with `error: 'invalid_file_type'`.
- Dimension issues (after decode >1024 or unreadable):
  - 400 with `error: 'invalid_dimensions'`.
- Rate limit breach:
  - 429 with `error: 'too_many_requests'`; include `Retry-After`.
- Storage/processing failures:
  - Log error details; respond 500 with generic message.
- Ensure try/catch around service call; convert known service error classes to HTTP codes; fallback 500.

## 8. Performance Considerations

- Use streaming/buffer limits to avoid loading huge files entirely; but Sharp expects buffer — guard size before read.
- Cache Supabase storage bucket name via env to avoid repeated lookups.
- Consider async logging of rate-limit entries to minimize response latency (but ensure atomicity).
- Compress to WebP at reasonable quality (e.g., 80) to balance size vs clarity.
- Use concurrency-safe rate-limit query (transaction or single upsert) to avoid race conditions.

## 9. Implementation Steps

1. **Create service** `src/lib/services/imageUpload.service.ts` with responsibilities:
   - `validateImageFile` (type/size).
   - `enforceRateLimit` (queries/inserts Supabase Postgres table or `analytics_events` with new enum value).
   - `processAndUploadImage` (Sharp resize, convert, upload, return metadata).
   - Export main `uploadRecipeImage` function returning DTO shape.
2. **Extend types/constants**:
   - If logging rate limit via `analytics_events`, add `'image_upload'` to `AnalyticsEventType` in `src/types.ts` (and update validations/services accordingly).
3. **Astro API route** `src/pages/api/images/upload.ts`:
   - `export const prerender = false`.
   - Define Zod schema for form data (file + session_id).
   - Acquire Supabase client/user from `context.locals`.
   - Parse multipart form data, run schema validation.
   - Determine owner key (`user.id` or `session_id`).
   - Invoke service; handle returned metadata.
   - Return `Response(JSON.stringify(dto), { status: 201 })`.
4. **Error mapping utility**:
   - Create or reuse helper to build `ErrorResponseDTO` and set headers.
   - Map service errors to HTTP status codes listed above.
5. **Rate limit storage**:
   - Implement Supabase query (SQL or JS) to count events in trailing hour and insert new event.
   - Ensure indexes supporting lookup by owner key + timestamp.
6. **Image processing tooling**:
   - Ensure Sharp (or alternative) is installed/configured.
   - Implement square normalization (center crop vs padding) per spec.
   - Convert to WebP with defined quality; return final metadata.
7. **Supabase storage integration**:
   - Use `supabase.storage.from(bucket).upload(path, buffer, { contentType: 'image/webp' })`.
   - On success, generate public/signed URL according to bucket policy.
8. **Testing**:
   - Add integration/unit tests for service functions (mock Supabase + Sharp).
   - Cover validation edge cases (size/type/session requirements).
   - Test rate limiting behavior (20th vs 21st upload).
9. **Documentation & follow-up**:
   - Update `.ai/api-plan.md` or developer docs if new event type/table added.
   - Ensure environment variables for bucket name and Sharp dependencies documented.

