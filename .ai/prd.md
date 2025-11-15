# Product Requirements Document (PRD) - 10xCookbook

## 1. Product Overview
10xCookbook is a web application that enables amateur and hobbyist cooks to rapidly capture raw, unstructured recipe text (copied from blogs, videos, notes) and convert it into clean, structured, editable recipe entries inside a personal cookbook interface. Only authenticated users can access application content. An integrated AI parsing flow accelerates data extraction (title, ingredients, tags, prep time estimate, concise recipe preparation description) while retaining full manual control and editability.

Layout modes:
- Preview Mode: Two-page cookbook displaying saved/selected recipe content on each page.
- Edit Mode (Add/Edit): Left page becomes user input/raw pasted text & editable fields; right page shows AI-formatted draft (structured recipe) for review & adjustment prior to save.

Primary value:
- Frictionless capture: Paste → Parse → Adjust → Save.
- Structured consistency: Enforced schema with limits (≤50 ingredients, recipe preparation description ≤5,000 chars).
- Familiar mental model: Visual two-page cookbook for reading; focused dual-pane editing for creation/update.
- Accessible, performant foundation ready for future enhancements (search, dietary transformations).

Key components:
- Auth & persistence layer for registered users.
- AI parsing service with timeout and graceful fallback.
- Image handling (upload, square normalization, compression to WebP, alt text management).
- Tag taxonomy and selection UI with accessible labels.
- Analytics event logging for engagement and optimization.

## 2. User Problem
Amateur cooks frequently collect recipes in ad hoc formats (copy/paste from long blog posts, video descriptions, personal notes). Manual cleanup is time-consuming, error-prone, and leads to inconsistent ingredients, missing metadata, or lost information. A second, related problem is the absence of a structured, dependable personal cookbook that users can reliably return to and read anytime—most improvised storage (notes apps, screenshots, bookmarks) lacks consistent formatting, tagging, and readability.

Users need:
- A rapid way to transform messy, pasted text into a structured recipe without losing control.
- A persistent, structured cookbook they can return to for clear reading and re-use.
- Clear guidance and guardrails around data persistence and validation to avoid accidental data loss.
- A simple UI that reflects cookbook mental models (preview reading vs. edit creation) rather than abstract forms.
- Lightweight organization via predefined tags (without needing custom taxonomy upfront).
- Reliable handling of images to visually recognize dishes.
- A fallback path when AI fails so progress is not blocked.

Without these capabilities users experience frustration, abandon attempts to organize, and remain in disordered, hard-to-reuse notes. 10xCookbook solves this by combining frictionless AI-assisted parsing with robust manual editing, distinct preview vs. edit modes, and transparent session persistence, increasing the likelihood of sustained usage and registration.

## 3. Functional Requirements
### 3.1 AI Parsing Flow (Edit Mode)
1. User enters Edit Mode (add or edit); left edit pane accepts raw text and editable fields.
2. User pastes raw recipe text into raw input area.
3. User clicks Parse with AI.
4. System calls AI service (timeout target ≤10s; median goal <6s).
5. AI returns structured draft (title suggestion, ingredient list, condensed recipe preparation description, inferred tags, prep time estimate) OR error/timeout.
6. Right pane displays AI-formatted structured draft; all fields remain editable.
7. User reviews, adjusts, and saves.
8. Save persists to the authenticated user’s account.
9. On error/timeout: present retry action + manual entry path (right pane stays blank OR retains last successful draft; left raw input preserved).

### 3.3 Authentication & Authorization
- Registration requires email + password (password hashing, basic security constraints).
- Login establishes persistent session for CRUD operations on persisted recipes.
- All application content and data operations require authentication; no anonymous usage.

### 3.4 Image Handling
- Accept upload or drag & drop of common image formats (PNG, JPEG, WebP).
- Validate size ≤2MB and dimensions ≤1024×1024.
- Client-side normalization: crop or letterbox to square; compress to WebP.
- Alt text defaults to recipe title; user can override.
- Reject invalid files with user-friendly error messages.

### 3.5 Tag Selection
- Predefined tag list only; user chooses zero or more (none required, except where business rules force suggestion).
- Quick tag (≤45 min) and long_rest (>12h passive) may be automatically suggested by AI; user can override.
- Accessible labels and aria attributes included.

### 3.6 Validation Rules
- Title required (non-empty, trimmed).
- Recipe preparation description required and ≤5,000 chars (server and client enforcement).
- Ingredients count ≤50; each ingredient name required; warn but allow if duplicate names.
- Image constraints enforced client-side before upload and server-side for defense in depth.
- Tag IDs must exist in predefined taxonomy.
- Prep time minutes must be non-negative integer.

### 3.7 Analytics Events
- session_start / session_end
- recipe_parse_requested
- recipe_parse_success (duration_ms, ingredient_count)
- recipe_parse_timeout / recipe_parse_error (error_code)
- recipe_save (is_ai_assisted boolean)
- recipe_edit
- recipe_delete
- registration_complete
- login_success

### 3.8 Performance & Reliability
- AI parse median <6s; hard timeout at 10s with graceful fallback.
- Manual entry always available regardless of AI state.
- Single Cosmos/Supabase style backend (future scalability considered) – final data store TBD but schema stable.

### 3.9 Accessibility
- All interactive elements keyboard navigable (Tab order left to right, top to bottom).
- Icons have aria-label or aria-labelledby.
- Alt text present for images.
- Color contrast meets WCAG AA for text.

### 3.10 Security & Privacy
- Password hashing (e.g., bcrypt or Argon2) with salt.
- CSRF protection on state-modifying endpoints.
- No PII beyond email/password.

### 3.12 Error Handling
- AI timeout: show countdown end, then error message with retry + manual entry guidance.
- Image validation errors: explicit reason (file too large, invalid type, dimensions exceeded).
- Persistence errors (auth missing): prompt login/registration.
- Network failures: show non-blocking banner with retry.

## 4. Product Boundaries
In Scope (MVP):
- Registration and login with password hashing.
- Two-page preview layout for reading saved/selected recipes.
- Edit Mode dual-pane (raw input left, AI formatted draft right) for add/edit workflows.
- AI parsing for initial structuring (no advanced transformations).
- Manual recipe creation, editing, deletion.
- Predefined tag taxonomy selection.
- Image upload with normalization/compression and alt text management.
- Validation (limits: ingredients ≤50, recipe preparation description ≤5,000 chars, image size/dimensions).
- Session and recipe-related analytics events.

Out of Scope (MVP):
- Multiple cookbooks per user.
- Dietary preference transformations (veganize, etc.).
- Sharing or social features.
- Custom/user-defined tags.
- Version history and rollback.
- Advanced search/filter UI.
- Video embedding, PDF export.
- Nutrition profiling and preference storage.
- Multi-region scaling / advanced performance tuning.

Assumptions:
- Initial traffic low; single-region deployment acceptable.
- AI provider latency within targeted threshold after calibration.
- Tag list stable for MVP.

Constraints:
- 2-week single sprint delivery.
- AI parsing must not block manual path.
- Max image size and recipe field limits enforced consistently.

## 5. User Stories (Top 20 for MVP)
Format: ID, Title, Description, Acceptance Criteria.

US-002 Title: View Recipe in Preview Mode
Description: As any user, I want a clear two-page preview layout so I can comfortably read a saved recipes.
Acceptance Criteria:
- Two-page layout shows recipes content spanning pages (title, image, ingredients, recipe preparation description, tags).
- No raw input fields visible in preview.

US-003 Title: Enter Edit Mode
Description: As a user, I want to switch to edit mode so I can create or modify a recipe.
Acceptance Criteria:
- Edit mode replaces left page with raw input & editable fields, right page reserved for AI draft.
- Clear visual indicator of mode (e.g., badge or header).

US-004 Title: Paste Raw Recipe Text
Description: As a user, I want to paste unstructured text into the raw input so I can prepare for parsing.
Acceptance Criteria:
- Multi-line input accepts pasted content retaining line breaks.
- Character count visible or accessible.

US-005 Title: Request AI Parse
Description: As a user, I want to trigger AI parsing so I can accelerate structuring.
Acceptance Criteria:
- recipe_parse_requested event logged.
- Loading state shown; timeout at 10s.

US-006 Title: AI Parse Success
Description: As a user, I want AI output to populate structured fields for review.
Acceptance Criteria:
- recipe_parse_success event with duration_ms & ingredient_count.
- Right pane fields populated and editable.

US-007 Title: AI Parse Failure/Timeout
Description: As a user, I want clear messaging on parse failure or timeout so I can retry or proceed manually.
Acceptance Criteria:
- recipe_parse_timeout or recipe_parse_error event logged.
- Retry + manual entry options displayed.
- Raw input preserved.

US-008 Title: Manual Recipe Entry
Description: As a user, I want to enter all recipe data manually so I’m not blocked by AI issues.
Acceptance Criteria:
- User can fill required fields and save without parse.
- Validation enforced (title, recipe preparation description length, ingredient count).

US-009 Title: Ingredient Management
Description: As a user, I want to add/remove ingredients within limits.
Acceptance Criteria:
- ≤50 ingredients enforced; attempt beyond shows non-blocking message.
- Remove control per ingredient updates list immediately.

US-010 Title: Validation Blocking Save
Description: As any user, I want invalid data to block save to ensure integrity.
Acceptance Criteria:
- Title required; recipe preparation description ≤5,000 chars; ingredients have names.
- Disabled save shows reasons until resolved.

US-011 Title: Tag Selection
Description: As a user, I want to select predefined tags to categorize recipes.
Acceptance Criteria:
- Tag buttons with icons & accessible labels toggle selection.
- Selected tags stored on save.

US-012 Title: Image Upload & Normalization
Description: As a user, I want to upload/drag an image and have it normalized.
Acceptance Criteria:
- Accept PNG/JPEG/WebP ≤2MB, ≤1024×1024.
- Non-square images cropped/letterboxed to square; converted to WebP.
- Thumbnail preview displayed.

US-013 Title: Alt Text Defaulting
Description: As a user, I want alt text to default to title for accessibility.
Acceptance Criteria:
- Initial alt text auto-filled from title.
- User can edit alt text before save.

US-016 Title: Register Account
Description: As a user, I want to create an account to persist recipes.
Acceptance Criteria:
- Email format validation & password strength enforced.
- registration_complete event logged.

US-018 Title: Edit Persistent Recipe
Description: As a logged-in user, I want to modify saved recipes.
Acceptance Criteria:
- Changes saved update updated_at.
- recipe_edit event logged.

US-019 Title: Delete Persistent Recipe
Description: As a logged-in user, I want to remove unwanted recipes.
Acceptance Criteria:
- Confirmation modal; deletion logs recipe_delete.

US-020 Title: Session End Logging
Description: As the system, I want session_end captured for analytics.
Acceptance Criteria:
- session_end event emitted on logout or unload.
- Duration derived server-side.

## 6. Success Metrics

- **Engagement:** ≥80% of registered users have ≥3 saved recipes.
- **Session Duration:** Average session duration ≥10 minutes.
- **Onboarding:** ≥70% of newly registered users complete first login and reach the main app.
- **Activation:** ≥60% of newly registered users create at least 1 recipe within 24 hours.
