# Test Plan – 10xCookbook

## 1. Introduction & Testing Goals
10xCookbook is a web application for quickly transforming unstructured recipe text into a uniform, editable structure stored in a personal cookbook. The testing process aims to ensure:
- Data integrity (recipes, tags, images, sessions, analytics events).
- Reliability and availability of core flows (registration, login, recipe create/edit, AI parsing, save, delete).
- Fulfillment of functional requirements (PRD, limits: ≤50 ingredients, preparation description ≤5,000 characters, image validation).
- Target performance (AI parsing median < 6 s, timeout at 10 s with graceful fallback).
- Security (RLS / Supabase policies, session control, no PII leakage beyond email).
- Accessibility (WCAG AA for key components, keyboard support, proper alt text).
- Correct telemetry (analytics events and parameters).

## 2. Test Scope
Included:
- Frontend layer (Astro + React + TypeScript): UI components, preview vs. edit modes.
- Service layer (`lib/services`): AI parsing, image upload, analytics, cookbook/recipe/tag services, rate limiting.
- API endpoints (`pages/api/...`): auth, recipes, tags, images, analytics, AI parse, sessions.
- Validation layer (`validation/*.ts`).
- Supabase integration (auth, RLS, migrations, tag seeding).
- Openrouter integration (limits, correct parameters, network error fallback).
- Database migrations (schema consistency, naming alignment, functions/triggers).
Out of scope: social features, dietary transformations, multi-region scaling, advanced search (excluded from MVP).

## 3. Test Types
1. Unit Tests:
   - Validators (e.g., `recipe.validator.ts`, `ingredient.validator.ts`, `auth.validator.ts`).
   - Hook logic (e.g., `useAIParse`, `useRecipeForm`, `useImageUpload`).
   - Service functions (parsing, image normalization, analytics event emission, rate limit logic).
2. Component Tests (React/Astro):
   - Auth forms, `RecipeForm`, `AIDraftPreview`, tag interaction, `BookLayout`.
3. Integration Tests:
   - Connections between API endpoints, services, and database (Supabase client + RLS).
   - AI parse flow: call `/api/ai/parse` → service → response.
4. End-to-End (E2E):
   - Core user scenarios (registration, login, recipe creation with & without AI, edit, delete, image upload, tagging).
5. Performance Tests:
   - AI parsing time (statistical samples, medians, timeout handling).
   - Load on recipe save endpoint (RPS vs. stability, estimated RU usage in PostgreSQL/Supabase context).
6. Security Tests:
   - RLS enforcement – no access to other users' resources.
   - Unauthorized endpoint calls (cookbooks/recipes/tags).
   - Password strength, brute-force attempts (rate limiting / blocking).
7. Accessibility (A11y) Tests:
   - Focus order, aria-labels, contrast, auto alt text + override.
8. Regression Tests:
   - After each database migration or schema change.
9. Compatibility Tests:
   - New Astro / React versions – smoke test.
10. Resilience / Fallback Tests:
    - AI timeout, Openrouter network error, interrupted image upload.
11. Analytics Data Quality Tests:
    - Events with correct parameters (e.g., `duration_ms`, `ingredient_count`).
12. Database Migration Tests:
    - Correct sequence ordering, no duplicates, valid column rename (migration `20251102000700`).

## 4. Key Test Scenarios
Grouped by functionality (condensed catalog – full list in test repository).

### Auth / Sessions
- Registration (valid email + strong password) → `registration_complete` event.
- Registration with invalid email (client + server validation) → error message.
- Successful login → active session, `login_success` event.
- Login with wrong password → no session, error message.
- Logout → `session_end` event (manual + unload simulation).
- Anonymous session migration to registered user (endpoint `sessions/migrate`).

### Recipe Creation (Manual)
- Enter title, ≤50 ingredients, description ≤5,000 chars → success `recipe_save` (is_ai_assisted=false).
- Exceed ingredient limit (51) → block adding another + warning message.
- Missing title → disabled save button + error list.
- Duplicate ingredient names → warning, save still allowed.

### AI Parsing
- Trigger `Parse with AI` with valid text → draft appears in right panel, `recipe_parse_success` (duration_ms, ingredient_count).
- Timeout >10 s (mock simulation) → error message, `recipe_parse_timeout`, original text preserved.
- Openrouter API error (500 / network) → fallback, `recipe_parse_error`.
- Re-parse after edits → draft updated.

### Recipe Edit / Delete
- Edit existing recipe → `updated_at` updated, `recipe_edit` event.
- Delete recipe (confirmation modal) → `recipe_delete` event.
- Attempt to edit another user's recipe → denied (RLS).

### Tagging
- Fetch tag list (seed) → displayed in UI.
- Add/Remove tag → selection state reflected in saved recipe.
- Auto suggestion (e.g., “quick”) from AI → user can override.

### Images
- Upload PNG 800×600 1.2MB → convert to square WebP, thumbnail preview.
- Size limit exceeded (>2MB) → validation error.
- Image 2000×2000 → rejected (dimension check).
- Interrupted upload (abort) → not saved, message displayed.
- Alt text auto from title; user override → new value saved.

### Views & Navigation
- Preview mode: no editable fields, proper two-page layout.
- Transition preview → edit → preview (data state retained).
- Navigation between recipe list and detail view; skeleton loader behaves correctly.

### Analytics
- Emission of all events at intended points (sequence validated vs. PRD).
- Event parameters match expected types (integer vs. string) – analytics validators.
- No duplicates on repeated emission (e.g., parse retry logs new `recipe_parse_requested`).

### Security / RLS / Rate Limiting
- Access attempt to another user's recipe → 403 / no data.
- Spamming AI parse endpoint → rate limit triggers (429 + message).
- SQL injection attempts in form fields → no exposure (validation + parameterization).

### DB Migrations
- Run all migrations on a clean database → success without conflicts.
- Idempotent local environment recreation.
- Verify columns after rename (`description` → `preparation_description`).

### Fallback / Resilience
- Network loss during recipe save → message + retry option.
- Network loss fetching tags → empty fallback + message.

### Accessibility
- Tab order: login form, `RecipeForm`, tag dropdown.
- Contrast of key texts (Axe tool).
- Aria labels in action buttons (Parse, Save, Delete, Logout).

## 5. Test Environments
- Local: Supabase (local instance / hosted), Auth emulator, seed data (tags).
- Staging (DigitalOcean): production-config copy, reduced scale, E2E & performance tests.
- CI tools (GitHub Actions) run suites: unit + integration + lint + type checks.
- Environment variables: Openrouter keys (limited test quotas), Supabase keys (public + service role only in controlled tests).

## 6. Testing Tooling
- Unit/Integration: Vitest (TS) + React Testing Library.
- E2E: Playwright (CI: headless, local: headed for debugging).
- Accessibility: axe-core (Playwright integration + component checks), manual keyboard reviews.
- Performance: k6 / Artillery (AI parse, recipe save), manual timing in integration tests.
- Coverage: c8 (CI report, min threshold 70% for service logic + validators).
- Image analysis: `sharp` library (transform tests – mock in unit, real offline in integration).
- Static analysis: ESLint + TypeScript type checking.
- Security: OWASP test queries (manual), dependency scan via `npm audit`.

## 7. Test Schedule (MVP – 2 Weeks)
| Day  | Activity |
|------|----------|
| 1–2  | Requirements analysis, scaffold unit tests + validators |
| 3–4  | UI component tests (auth, recipe form, AI draft preview) |
| 5–6  | API integration tests (auth, recipes, tags, images, AI parse) |
| 7    | E2E core flows (registration, manual + AI recipe creation) |
| 8    | E2E edit/delete, anonymous → registered session migration |
| 9    | Performance (AI parse, saves), security (RLS, rate limit) |
| 10   | Accessibility + analytics telemetry |
| 11   | Regression after migrations + stabilization |
| 12   | Fill coverage gaps, risk report |
| 13   | Critical fixes, re-test |
| 14   | Finalization: final report, exit criteria check |

## 8. Exit Criteria
- All critical tests (auth, recipe create/edit/save, AI parse fallback) green.
- AI parsing median < 6 s (≥30 invocations sample on staging).
- No blocking (Severity 1) defects; max 2 open high (Severity 2) defects with accepted fix plan.
- Coverage of service logic + validators ≥ 70% lines.
- Accessibility tests implemented (≥95% key paths without critical contrast/focus issues).
- Analytics events correct (≥95% samples with valid schema & parameters).
- All DB migrations succeed from zero without errors.

## 9. Roles & Responsibilities
- QA Engineer: create/maintain tests, risk analysis, defect reporting, performance metrics.
- Backend Dev: fix API, validation, migration issues; support integration tests.
- Frontend Dev: fix UI/UX issues, accessibility, component regressions.
- DevOps: environment setup (staging), CI optimization, secrets management.
- Product Owner: defect prioritization, exit criteria acceptance.

## 10. Defect Reporting Procedures
1. Register defect in GitHub Issues (template: title, reproduction steps, expected vs actual, logs, screenshots).
2. Severity Classification:
   - S1 Critical: blocks core flows (e.g., cannot save recipe).
   - S2 High: significant functional limitation (e.g., AI parse fails without fallback).
   - S3 Medium: degraded behavior (e.g., slow parse >8 s).
   - S4 Low: cosmetic issues (typos, minor UX).
3. Prioritization: QA + PO decide order (S1 immediate, S2 within 24h, S3 backlog sprint, S4 optional).
4. Tracking: statuses (Open → In Progress → In Review → Resolved → Closed).
5. Fix Verification: re-test + regression of related modules.
6. Communication: daily defect summary (new, closed, open S1/S2 counts).
7. Commit conventions: use Conventional Commits (fix:, feat:, test:, chore:) – link to Issue number.

---

## Attachments / References
- PRD: `.ai/prd.md`
- Tech Stack: `.ai/tech-stack.md`
- Migrations: `supabase/migrations/*`
- Services & Validators: `src/lib/services`, `src/lib/validation`
- Endpoints: `src/pages/api/*`

## Monitored Metrics (Post Deployment)
- Average AI parsing time (Prometheus/logging).
- API 4xx/5xx error rate (<2%).
- Number of unique user recipes vs activation goal.
- Event emission consistency (no missing key events).

## Risks & Mitigation Strategies (Summary)
| Risk | Mitigation |
|------|------------|
| High AI parsing time | Performance tests, prompt caching, trace analysis. |
| Data loss during edit | Autosave / in-memory state retention, view transition tests. |
| Migration errors | Automated integration tests starting from zero. |
| Incorrect ingredient/description limits | Unit validators + E2E in `RecipeForm`. |
| RLS leakage | Negative tests accessing foreign resources. |
| Incomplete analytics | Emission tests + event schema validation. |
| Accessibility gaps (a11y) | Playwright + axe, manual focus review. |

## Plan Maintenance
Updated on each major architecture change (e.g., new resource types, added UI modes). QA monitors coverage and adjusts priorities in the test backlog.
