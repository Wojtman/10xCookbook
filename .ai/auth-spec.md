## Authentication Architecture Specification – 10xCookbook (Astro 5 + React 19 + Supabase)

Version: 1.0
Owners: Platform (Auth), Web
Status: Proposed
Scope: Registration, Login, Logout, Password Recovery; Anonymous session compatibility; SSR/CSR integration; Validation; Error handling; Analytics


## 0) Goals and Non-Goals

- Goals
  - Implement user authentication with Supabase Auth: registration, login, logout, password recovery.
  - Preserve anonymous usage flow and ephemeral cookbook behavior.
  - Provide clear UI architecture (Astro pages + React components) with validation and robust error handling.
  - Integrate analytics events per PRD and avoid breaking existing recipe flows and services.
  - Support SSR-protected routes and consistent session handling across server and client.

- Non-Goals (MVP)
  - SSO/OAuth providers.
  - MFA.
  - Advanced account management (email change verification, device management).


## 1) Requirements Mapping (from PRD and Tech Stack)

- Anonymous Cookbook Behavior (PRD §3.2): Remains unchanged for non-auth users; ephemeral storage and banner.
- Authentication & Authorization (PRD §3.3): Registration with email/password; login; restricted persistence endpoints for anonymous users.
- Security & Privacy (PRD §3.10): Password hashing handled by Supabase; CSRF protection on our state-modifying endpoints; no PII beyond email/password.
- Registration Prompt Logic (PRD §3.11): Prompt after first AI parse success or when temporary recipes ≥2.
- Error Handling (PRD §3.12): Clear errors for auth operations; network/persistence failures show non-blocking banners or dialogs.
- Analytics Events (PRD §3.7): login_success, registration_complete, session_start, session_end; integrate with existing analytics infra.
- Tech stack (tech-stack.md): Astro 5 (SSR where needed), React 19 islands, TypeScript 5, Tailwind 4, shadcn/ui, Supabase (PostgreSQL + Auth).


## 2) User Interface Architecture

### 2.1 Routes, Pages, and Layouts

- New Auth Routes (Astro pages)
  - `/auth/login` (SSR, `prerender = false`): Login form, link to password reset and registration.
  - `/auth/register` (SSR, `prerender = false`): Registration form; minimal profile info deferred (MVP: email/password only).
  - `/auth/forgot-password` (SSR, `prerender = false`): Request password reset email.
  - `/auth/update-password` (SSR, `prerender = false`): Handles Supabase password reset link. Accepts `code`/`access_token` query params, exchanges for session, and allows entering a new password.
  - `/logout` (SSR, `prerender = false`): Clears auth cookies via server client and redirects (see 4.3).

- Existing App Routes (Non-auth + Auth views)
  - Preview Mode pages remain public/anonymous-friendly.
  - Edit Mode remains accessible for anonymous users (ephemeral) and authenticated users (persistent). No breaking changes.
  - Protected account/profile pages (future) will require SSR session guard.

- Layouts
  - `Layout.astro`: Global shell for main application views; includes header, footer, theme, and analytics bootstrap. Emits `session_start` on load (anonymous or authenticated), sets up `session_end` emission on unload/logout, and provides an injection point for the anonymous ephemeral banner. Includes `AccountMenu` when a session exists.
  - `AuthLayout.astro`: Minimal layout for auth pages (centered card, no cookbook chrome).

### 2.2 React Components (shadcn/ui + Tailwind)

- Atomic Inputs
  - `EmailField.tsx` – labeled input with validation state and aria attributes.
  - `PasswordField.tsx` – labeled input with visibility toggle and requirements hint.
  - `PasswordStrengthMeter.tsx` – optional; shows strength heuristics (client-side only, not blocking).

- Form Shells (one per page, client islands)
  - `LoginForm.tsx`
    - Fields: email, password.
    - Actions: Submit (login), link to `/auth/forgot-password`, link to `/auth/register`.
    - Contract: Calls Supabase client `signInWithPassword`. On success, hard redirect via `window.location.assign(next || '/');` to avoid stale state.
  - `RegisterForm.tsx`
    - Fields: email, password (confirm optional; recommended).
    - Contract: Calls Supabase client `signUp`. On success: if email confirmation disabled, redirect to `/` after session; if enabled, show “check your email” state. Emit `registration_complete` (see 5.4).
  - `ForgotPasswordForm.tsx`
    - Field: email.
    - Contract: Calls Supabase client `resetPasswordForEmail` with `redirectTo` pointing to `/auth/update-password`. On success, show confirmation state.
  - `UpdatePasswordForm.tsx`
    - Fields: new password (and confirm).
    - Contract: After `exchangeCodeForSession` (server or client), call `auth.updateUser({ password })`. On success, redirect to `/`.

- Shared UI
  - `FormAlert.tsx` – success/info/error alert region with role="alert" and focus management.
  - `FormSubmitButton.tsx` – primary submit with loading and disabled states.
  - `RegistrationPrompt.tsx` – modal/banner triggered after first AI parse success or when temp recipes ≥2; prompts to register. May embed `RegisterForm` inline (preferred for preserving temporary recipes for migration) with a fallback link to `/auth/register`.
  - `AccountMenu.tsx` – shows avatar/email for authenticated users; shows “Sign in” for anonymous; “Sign out” action posts to `/logout`.
  - `SessionGate.tsx` (optional client wrapper) – conditionally renders children based on a lightweight client session check, but SSR guards remain canonical.

### 2.3 Separation of Responsibilities (Astro vs React)

- Astro Pages (SSR)
  - Control route visibility and SSR guards (server-side session check using Supabase server client).
  - Set `prerender = false` on auth pages to ensure runtime SSR and cookie access.
  - Perform server redirects for protected pages.
  - Provide `initialProps` (e.g., next URL) to React islands via inline script or component props.

- React Components (Client Islands)
  - Own form state, client-side validation, and submission to Supabase JS client.
  - Translate Supabase errors into user-friendly messages.
  - Trigger navigation (hard redirects) after successful actions.
  - Fire analytics events (non-blocking) for form interactions and results.

### 2.4 Validation Rules and Messages

- Email
  - Required. Valid email format (simple RFC 5322-compatible regex).
  - Errors: “Email is required”, “Enter a valid email address”.

- Password (Registration/Update)
  - Required. Minimum 8 characters.
  - At least 3 of 4 categories recommended: lowercase, uppercase, number, symbol. We do not block on categories if Supabase policy differs; we display hints and enforce minimum length.
  - Errors: “Password is required”, “Password must be at least 8 characters”.

- Password (Login)
  - Required.
  - “Password is required”.

- General Error Copy (mapped from Supabase errors)
  - “Invalid email or password” (auth/invalid-credentials).
  - “Account already exists” (auth/email-already-in-use).
  - “Too many attempts. Try again later.” (rate limit).
  - “Network error. Check your connection and retry.”

### 2.5 Primary Scenarios

1) Anonymous user visits app
  - Sees ephemeral banner (PRD §3.2) and can parse/edit/save temporarily.
  - Analytics emits `session_start` with an anonymous token for this browser tab/session.

2) Registration Prompt (PRD §3.11)
  - Triggered after first AI parse success or temp recipes ≥2.
  - Presents benefits and data loss risk; CTA opens embedded `RegisterForm` or links to `/auth/register`.

3) Register
  - Fill email/password → `signUp` → if email confirmation on, show “check email”; else redirect to `/`.
  - Emit `registration_complete`.
  - On first authenticated visit, automatically migrate temporary recipes (PRD §3.3, §3.11, US-017).

4) Login
  - Enter email/password → `signInWithPassword`.
  - On success: emit `login_success`, redirect to `/` (or `next` param if present).

5) Forgot Password
  - Enter email → `resetPasswordForEmail({ redirectTo: SITE_URL + '/auth/update-password' })` → success banner.

6) Update Password (from email link)
  - Page loads with `code`/`access_token` → exchange for session → show form to set new password → on submit `updateUser({ password })` → redirect to `/`.

7) Logout
  - Account menu → POST `/logout` → server clears session cookies and redirects to `/`.


## 3) Backend Logic

### 3.1 Supabase Data Model (Auth + Profiles)

- Supabase Auth built-ins
  - `auth.users`: managed by Supabase (email, hashed password, email_confirmed_at, etc.).

- Application profiles (optional MVP, for future expansion)
  - Table: `public.profiles`
    - `id uuid primary key references auth.users(id) on delete cascade`
    - `display_name text`
    - `created_at timestamptz default now()`
    - `updated_at timestamptz default now()`
  - RLS: enable; select/update restricted to `auth.uid() = id`.

### 3.2 API Endpoints (Astro pages/api)

- `GET /api/auth/session`
  - Purpose: Server-backed check to return minimal session info (user id, email). Used by SSR or client bootstrap.
  - Auth: Reads Supabase cookies via server client.
  - Response 200: `{ user: { id, email }, isAuthenticated: true }`
  - Response 200 (no session): `{ user: null, isAuthenticated: false }`

- `POST /logout`
  - Purpose: Server-side sign-out to guarantee cookie clearing.
  - Auth: Requires session cookie; idempotent.
  - Behavior: Uses Supabase server client `signOut()`; clears cookies; redirects to `/`.

- (Optional) `POST /api/analytics`
  - Purpose: Accepts analytics events (`login_success`, `registration_complete`, etc.) for server-side logging into a Supabase table or external sink. Non-blocking; 202 on accept.

Notes
  - We do NOT proxy registration/login to our backend; we use Supabase JS directly in the client. This minimizes surface area and complexity, while SSR pages still rely on server session checks.

### 3.3 Input Validation Mechanism

- Shared Zod Schemas (`src/lib/validation/auth.validator.ts`)
  - `emailSchema = z.string().trim().min(1).email()`
  - `passwordSchema = z.string().min(8)`
  - `registerSchema = z.object({ email: emailSchema, password: passwordSchema, confirmPassword?: optional })`
  - `loginSchema = z.object({ email: emailSchema, password: z.string().min(1) })`
  - `forgotPasswordSchema = z.object({ email: emailSchema })`
  - `updatePasswordSchema = z.object({ password: passwordSchema, confirmPassword?: optional })`

- Client forms use same rules for instant feedback; server endpoints apply Zod where applicable (e.g., `/api/auth/session` does not accept a body; `/logout` only reads cookies).

### 3.4 Exception Handling

- Standard error envelope for API endpoints:
  - `{ error: { code: string; message: string; details?: unknown } }`
  - HTTP status mapping:
    - 400: validation_error
    - 401: unauthorized
    - 429: rate_limited
    - 500: internal_error

- Supabase error mapping (client side)
  - `auth/invalid-credentials` → “Invalid email or password”
  - `auth/email-already-in-use` → “Account already exists”
  - `auth/rate-limit-exceeded` → “Too many attempts. Try again later.”
  - Default → “Something went wrong. Please try again.”

### 3.5 SSR and Astro Configuration

- Pages requiring access to cookies/session must run on the server:
  - Set `export const prerender = false;` in `/auth/*` pages and any protected page.

- `astro.config.mjs` (guidance)
  - Ensure SSR is enabled (output: 'server') and the chosen adapter is configured for deployment (e.g., Node adapter for DigitalOcean).
  - Example settings (descriptive, not code): set `output = 'server'`, configure `adapter-node`, and verify environment variables are available at runtime.

- `src/middleware.ts`
  - Implement route guard for protected routes (e.g., `/account`, future persistent-only areas).
  - Use Supabase server client to read session and redirect to `/auth/login?next=...` if unauthenticated.

### 3.6 Temporary Recipe Migration (US-017)

- Goal: After a user becomes authenticated (post-register or post-login), persist any temporary recipes created during the anonymous session.

- Source of truth for temporary recipes
  - Client-only storage (localStorage) under a dedicated key namespace (e.g., `cookbook:temp:*`) to survive in-app auth flows and email confirmation redirects.
  - Each entry includes a creation timestamp and version to support cleanup/TTL.

- When migration runs
  - Registration without email confirmation: Immediately after `registration_complete` and a valid session exists, run migration on the current page before redirecting away (preferred via embedded `RegisterForm` in `RegistrationPrompt.tsx`).
  - Registration with email confirmation: On the first authenticated page load after confirmation (SSR detects session), automatically run migration.
  - Login by an existing user who had temporary recipes: On the first authenticated load, automatically run migration.

- Migration behavior
  - Read all temporary recipes; batch persist them with `user_id` using existing create endpoints (server-side auth enforced).
  - Emit analytics: `recipe_save` for each created recipe (with `is_ai_assisted` flag when applicable), and a summary event `temporary_recipe_migration_complete` with counts.
  - On success, clear migrated entries from localStorage and show a non-blocking confirmation banner.
  - On partial failure, keep remaining entries; show a retry affordance. Failures do not block normal operation.

- Rationale and PRD compatibility
  - US-017 requires migration as part of MVP, so migration is mandatory (not optional) and automatic on first authenticated load.


## 4) Authentication System (Supabase + Astro)

### 4.1 Configuration & Environment

- Environment variables
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, if needed for admin tasks; not required for basic auth flows)
  - `SITE_URL` (used for email links: `resetPasswordForEmail.redirectTo`)

- Email templates and SMTP configured in Supabase dashboard for password recovery messages.

### 4.2 Clients and Utilities

- Client-side helper: `src/lib/auth/supabaseClient.ts`
  - Creates a Supabase browser client with anon key.
  - Used by React forms for sign-up, sign-in, reset request, update password.

- Server-side helper: `src/lib/auth/supabaseServer.ts`
  - Wraps `@supabase/ssr` `createServerClient` using Astro request/response cookies.
  - Functions:
    - `getServerSession(ctx) → { user | null }`
    - `requireAuth(ctx) → { user }` (throws/redirects if missing)
    - `serverSignOut(ctx)`

### 4.3 Logout Flow

- POST `/logout`:
  - Uses server client `signOut()` and clears cookies.
  - Issues redirect to `/` (303/302). This guarantees cookie invalidation even if a client tab has stale state.

### 4.4 Password Recovery Flow

- Forgot
  - Client: `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/auth/update-password' })`
  - UI shows “If an account exists, we’ve sent a reset link” (avoid account enumeration).

- Update Password
  - User follows email link to `/auth/update-password?code=<...>` (or `access_token` depending on Supabase version).
  - Page exchanges code for session (server or client), then renders `UpdatePasswordForm`.
  - Submit calls `supabase.auth.updateUser({ password })`.
  - On success, redirect to `/` and optionally display “Password updated” toast.

### 4.5 Security Considerations

- CSRF
  - Our state-changing endpoints (`/logout`, `/api/analytics`) include CSRF protection (double-submit cookie with header) or are same-site POSTs from our origin. `/logout` may also accept same-site enforced cookie and referrer policy; include CSRF token if exposed publicly.

- RLS
  - Keep Supabase RLS enabled for application tables (e.g., `recipes`, `profiles`). Authenticated users can only access their data. Anonymous users never hit persistent endpoints (client saves ephemeral only).

- Session Consistency
  - Prefer server redirects after sensitive actions and use hard navigations after login/register to ensure fresh SSR context.

### 4.6 Anonymous Session and Ephemeral Storage Semantics

- Anonymous session token
  - Generate a UUID v4 `anonymousSessionId` on first load when unauthenticated; store in `sessionStorage` and memory for the life of the browser tab.
  - Use this token for `session_start`/`session_end` analytics. It is not sent to servers except as part of non-PII analytics payloads.

- Temporary recipe storage
  - Use client localStorage to retain temporary recipes across in-app auth flows (including email confirmation) to enable US-017 migration.
  - Display a persistent banner indicating that data is temporary and may be lost.
  - Clear behavior: on successful migration, or via explicit “Discard temporary data” action, or via TTL-based cleanup (e.g., 24h) on load.

- Note on PRD wording (PRD §3.2)
  - To satisfy US-017 migration while preserving a simple flow, we allow temporary recipes to persist across in-app auth flows instead of purging strictly on refresh/navigation. The UI continues to warn about data loss risk. This is a narrow, intentional deviation to make migration reliable.


## 5) Compatibility, Analytics, and Contracts

### 5.1 Compatibility with Existing Behavior

- Anonymous flow remains intact:
  - Ephemeral storage and banner per PRD §3.2, with clarified persistence across in-app auth flows to support migration (see §4.6).
  - Edit Mode accessible without login; manual save stays ephemeral.

- Persistent operations remain restricted:
  - Existing API routes for recipes continue to enforce auth (server-side). Anonymous users see prompts and are blocked from persistence as today.

- Registration Prompt
  - Hooked to existing parse success event and ephemeral recipe count logic (maintain current triggers; render `RegistrationPrompt.tsx`). No changes required in `recipe.service.ts` beyond showing the prompt.

### 5.2 Analytics Events (Additions/Usage)

 - `session_start` (on initial load; include anonymous or authenticated flag and `anonymousSessionId` when applicable)
- `login_success` (user_id)
- `registration_complete` (user_id)
- `session_end` (on unload/logout)
 - `temporary_recipe_migration_complete` (migrated_count)
- Error events (non-PII): `auth_error` with code and stage (login/register/reset)

- Emission Strategy
  - Client-side, non-blocking `navigator.sendBeacon` or fetch with short timeout to `/api/analytics` (if implemented) or existing analytics mechanism.

### 5.3 Type Contracts (descriptive)

```ts
// Form payloads (client-side)
type LoginFormData = { email: string; password: string };
type RegisterFormData = { email: string; password: string; confirmPassword?: string };
type ForgotPasswordData = { email: string };
type UpdatePasswordData = { password: string; confirmPassword?: string };

// Session response (server-backed)
type SessionResponse =
  | { isAuthenticated: true; user: { id: string; email: string } }
  | { isAuthenticated: false; user: null };

// Standard API error envelope
type ApiError = { error: { code: string; message: string; details?: unknown } };
```

### 5.4 Redirect Rules

- After Login: redirect to `next` query param if present; otherwise `/`.
- After Register: if email confirmation disabled → `/`; else show confirmation state, optionally redirect to `/auth/login` after a few seconds.
- After Update Password: `/`.
- After Logout: `/`.


## 6) Implementation Blueprint (Modules and Files)

- Pages (Astro, SSR: `prerender = false`)
  - `src/pages/auth/login.astro` → mounts `LoginForm`
  - `src/pages/auth/register.astro` → mounts `RegisterForm`
  - `src/pages/auth/forgot-password.astro` → mounts `ForgotPasswordForm`
  - `src/pages/auth/update-password.astro` → mounts `UpdatePasswordForm` (exchanges code for session)
  - `src/pages/logout.astro` → server sign-out then redirect
  - `src/pages/api/auth/session.ts` → returns minimal session JSON
  - `src/pages/api/analytics/index.ts` (optional) → accepts analytics

- Layouts
  - `src/layouts/Layout.astro` (global app shell; analytics bootstrap and ephemeral banner slot)
  - `src/layouts/AuthLayout.astro`

- Components (React)
  - `src/components/auth/EmailField.tsx`
  - `src/components/auth/PasswordField.tsx`
  - `src/components/auth/FormAlert.tsx`
  - `src/components/auth/LoginForm.tsx`
  - `src/components/auth/RegisterForm.tsx`
  - `src/components/auth/ForgotPasswordForm.tsx`
  - `src/components/auth/UpdatePasswordForm.tsx`
  - `src/components/nav/AccountMenu.tsx`
  - `src/components/prompts/RegistrationPrompt.tsx`

 - Utilities (Client)
  - `src/lib/services/recipeMigration.ts` – invoked post-auth to migrate temporary recipes from localStorage

- Auth Utilities
  - `src/lib/auth/supabaseClient.ts`
  - `src/lib/auth/supabaseServer.ts`
  - `src/lib/validation/auth.validator.ts` (Zod schemas)

- Middleware
  - `src/middleware.ts` – SSR auth guard for protected routes (future `/account`, etc.).


## 7) Accessibility and UX

- Forms use semantic labels, aria-describedby for error/help text, role="alert" for errors, and proper focus management after submit.
- Keyboard navigation supported for all interactive controls.
- Clear error copy and non-blocking banners for network issues.
- High-contrast compliant with Tailwind/shadcn defaults adjusted to WCAG AA.


## 8) Testing Matrix (High-Level)

- Registration
  - Valid/invalid email, short password, existing email, confirmation on/off, network errors.

- Login
  - Valid/invalid credentials, rate limit, network errors.

- Forgot/Update Password
  - Existing/non-existing email (generic success), bad/expired code, successful update.

- Session/SSR
  - Auth pages SSR load with/without session.
  - Protected page redirects unauthenticated → `/auth/login?next=...`.

- Anonymous Compatibility
  - Ephemeral flows unaffected; registration prompt triggers on configured thresholds.


## 9) Deployment & Configuration Notes

- Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SITE_URL` are configured in host environment.
- `astro.config.mjs` uses server output and appropriate adapter for DigitalOcean deployment.
- Supabase email templates configured; reset redirect points to `/auth/update-password`.
- Verify CORS/same-site cookie settings to allow server SSR cookie reads.


## 10) Rollout Plan

- Phase 1: Ship auth pages/components behind a feature flag; dark-launch routes.
- Phase 2: Enable registration prompt in Edit Mode and `session_start/session_end` analytics.
- Phase 3 (MVP): Implement and enable automatic temporary recipe migration (US-017) post-auth, including inline registration path to preserve data.
- Observability: Monitor auth error rates, conversion events, and session metrics per PRD §6.


— End of Specification —


