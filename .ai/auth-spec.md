## Authentication Architecture Specification – 10xCookbook (Astro 5 + React 19 + Supabase)

Version: 1.0
Owners: Platform (Auth), Web
Status: Proposed
Scope: Registration, Login, Logout, Password Recovery; SSR/CSR integration; Validation; Error handling; Analytics

## 0) Goals and Non-Goals

- Goals
  - Implement user authentication with Supabase Auth: registration, login, logout, password recovery.
  - Require authentication for all application routes; no anonymous access to application content.
  - Provide clear UI architecture (Astro pages + React components) with validation and robust error handling.
  - Integrate analytics events per PRD and avoid breaking existing recipe flows and services.
  - Support SSR-protected routes and consistent session handling across server and client.

- Non-Goals (MVP)
  - SSO/OAuth providers.
  - MFA.
  - Advanced account management (email change verification, device management).

## 1) Requirements Mapping (from PRD and Tech Stack)

- Authenticated-only Access: All application routes (beyond `/auth/*`) require an authenticated session; SSR guards enforce redirects to `/auth/login`.
- Authentication & Authorization (PRD): Registration with email/password; login; all data operations require authentication.
- Security & Privacy (PRD §3.10): Password hashing handled by Supabase; CSRF protection on our state-modifying endpoints; no PII beyond email/password.
- Registration UX: Standard login/register/forgot/update-password flows; no anonymous or ephemeral usage.
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

- Application Routes (Authenticated only)
  - All non-`/auth/*` routes are protected with SSR session guard and require an authenticated user.
  - Protected account/profile pages (future) will also require SSR session guard.

- Layouts
  - `Layout.astro`: Global shell for main application views; includes header, footer, theme, and analytics bootstrap. Emits `session_start` on load for authenticated sessions, sets up `session_end` emission on unload/logout. Includes `AccountMenu` when a session exists.
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
  - `AccountMenu.tsx` – shows avatar/email for authenticated users; “Sign out” action posts to `/logout`.
  - `SessionGate.tsx` (optional client wrapper) – conditionally renders children based on a lightweight client session check; SSR guards remain canonical.

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

1. Register

- Fill email/password → `signUp` → if email confirmation on, show “check email”; else redirect to `/`.
- Emit `registration_complete`.

2. Login

- Enter email/password → `signInWithPassword`.
- On success: emit `login_success`, redirect to `/` (or `next` param if present).

3. Forgot Password

- Enter email → `resetPasswordForEmail({ redirectTo: SITE_URL + '/auth/update-password' })` → success banner.

4. Update Password (from email link)

- Page loads with `code`/`access_token` → exchange for session → show form to set new password → on submit `updateUser({ password })` → redirect to `/`.

5. Logout

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
  - Keep Supabase RLS enabled for application tables (e.g., `recipes`, `profiles`). Authenticated users can only access their data. Anonymous access is not permitted to application content.

- Session Consistency
  - Prefer server redirects after sensitive actions and use hard navigations after login/register to ensure fresh SSR context.

## 5) Compatibility, Analytics, and Contracts

### 5.1 Compatibility with Existing Behavior

- All application content is protected behind authentication. Unauthenticated users are redirected to `/auth/login`.

- Persistent operations remain restricted:
  - Existing API routes for recipes continue to enforce auth (server-side).

- Registration Prompt
  - No anonymous usage or registration prompt thresholds exist under the authenticated-only model.

### 5.2 Analytics Events (Additions/Usage)

- `session_start` (on initial load of an authenticated session)
- `login_success` (user_id)
- `registration_complete` (user_id)
- `session_end` (on unload/logout)
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
  - `src/layouts/Layout.astro` (global app shell; analytics bootstrap)
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

- Utilities (Client)
- (Removed) Temporary recipe migration utilities are no longer applicable under authenticated-only access.

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

## 9) Deployment & Configuration Notes

- Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SITE_URL` are configured in host environment.
- `astro.config.mjs` uses server output and appropriate adapter for DigitalOcean deployment.
- Supabase email templates configured; reset redirect points to `/auth/update-password`.
- Verify CORS/same-site cookie settings to allow server SSR cookie reads.

## 10) Rollout Plan

- Phase 1: Ship auth pages/components behind a feature flag; dark-launch routes.
- Phase 2 (MVP): Enforce authenticated-only access across all non-auth routes with SSR guards and complete login/register/forgot/update flows.
- Observability: Monitor auth error rates, conversion events, and session metrics per PRD §6.

— End of Specification —
