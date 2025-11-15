# 10xCookbook – Product Requirements Document (MVP)

## 1. Problem Statement
Amateur cooks struggle to reliably capture, clean, and organize ad‑hoc or copied recipes (blogs, YouTube descriptions). Traditional/manual approaches are cumbersome, leading to lost, inconsistent, or unusable recipe notes. 10xCookbook provides a fast way to paste raw recipe text, have AI extract structured data, and save it into a personal cookbook that mimics the familiarity of a two‑page spread.

## 2. Objectives & Success Metrics
Primary objective: Enable frictionless recipe capture and organization for authenticated users, driving onboarding completion and sustained usage.
Success Criteria (post‑launch, first 3 months):
- 80% of registered users have ≥3 saved recipes.
- Average session duration ≥10 minutes.
- ≥70% of newly registered users complete first login and reach the main app.
- ≥60% of newly registered users create at least 1 recipe within 24 hours.
Measurement Approach: Event logging + SQL queries against user + recipe tables filtered by registration_date (>90 days). Session duration derived from session_start & session_end events.

## 3. Scope
### In Scope (MVP)
- Registration & login to persist cookbook.
- Two‑page cookbook UI layout (left: input/raw; right: AI parsed preview & edits).
- Manual recipe creation & editing (title, image, recipe preparation description, ingredients, predefined tags, summed prep time).
- Predefined tag selection (icon + implicit label).
- AI parsing flow: paste → Parse with AI → structured preview → user adjusts → save.
- Image upload (click “+” placeholder or drag & drop), square thumbnail normalization, compression (e.g., WebP), alt text = recipe title.
- Field limits: ≤50 ingredients; recipe preparation description ≤5,000 chars; image ≤2MB, ≤1024×1024.
- Session logging (start/end) for analytics.

### Out of Scope (MVP)
- Multi‑cookbook.
- Dietary preference transformations (veganize, etc.).
- Sharing recipes or social features.
- Custom/user‑defined tags.
- Version history & rollback.
- Rich search/filtering UI.
- Video embedding, PDF export, profile nutrition/preferences.

## 4. Personas
1. Casual Home Cook: Copies online recipes; wants quick cleanup & storage.
2. Aspiring Hobbyist: Maintains a growing personal collection; motivated to register after testing AI parsing.
3. Efficiency Seeker: Wants minimal friction—paste, parse, save.

## 5. User Stories (MVP)
- As a registered user, I can paste raw recipe text and click “Parse with AI” to see a structured preview.
- As a registered user, I can add/edit a recipe manually and see it saved in my cookbook.
- As a registered user, I can upload or drag & drop an image to represent a dish.
- As a new user, I can register and log in to create and manage my cookbook.
- As a registered user, I can edit a saved recipe and update its ingredients, recipe preparation description, tags, image.
- As a registered user, I can view all my recipes in a two‑page layout interface.
- As a registered user, I can delete a recipe I no longer need.

## 6. Functional Requirements
### Recipe Entity Fields
- id (UUID)
- user_id (UUID, required; FK to Users.id)
- title (string, required)
- preparation_description (string, required, ≤5,000 chars)
- ingredients: array [{ name: string, quantity?: string, unit?: string }] (≤50)
- tags: array of predefined tag IDs (0..N; at least one optional)
- prep_time_minutes (integer total; sum of active + passive if user chooses)
- image_url (optional)
- image_alt (defaults to title, editable later) 
- created_at / updated_at (timestamps)

### Tag Taxonomy (Predefined)
Each tag: { id, icon_name, accessible_label } – examples:
- meat
- vegan
- gluten_free
- dessert
- quick (≤45 min total)
- long_rest (>12h passive)
(Exact final set to be locked before dev; icons shipped as assets/SVG.)

### AI Parsing Flow
1. User pastes raw text into left page input area.
2. User clicks “Parse with AI”.
3. System calls AI service (timeout target ≤10s; TBD calibration).
4. Response returns structured draft: title suggestion, ingredient list, condensed recipe preparation description, inferred tags, prep_time estimate.
5. Right page displays editable form populated with AI output.
6. User reviews/edits and clicks Save to persist to their account.
7. Errors/timeouts: show retry button + manual entry option.



### Image Handling
- On upload/drag: client normalizes to square (crop or letterbox), compresses, converts to WebP.
- Alt text defaults to recipe title for accessibility.

### Validation
- Reject oversized images with user-friendly message.
- Ingredient duplication optionally flagged (non-blocking).
- Enforce character and count limits at client and server.

### Session Logging
- On entry (authenticated): session_start event (user_id, timestamp).
- On exit or explicit logout: session_end (timestamp).
- Duration calculated server-side; stored in analytics/session table.

## 7. Non-Functional Requirements
- Performance: AI parse median <6s; must not exceed 10s timeout threshold.
- Reliability: Graceful fallback if AI fails (user can still manually enter data).
- Accessibility: Icons accompanied by aria-labels; focus order logical; contrast meeting WCAG AA for text.
- Security: Basic auth (password hashing, CSRF protection for form posts).
- Privacy: No PII beyond email/password for MVP.
- Scalability: Single sprint; initial low traffic; design ready for future search/filter expansion.

## 8. Data Model (Draft)
### Tables
Users: { id, email, password_hash, registration_date, created_at }
Recipes: { id, user_id (FK Users.id), title, preparation_description, prep_time_minutes, image_url, image_alt, created_at, updated_at }
RecipeIngredients: { id, recipe_id (FK Recipes.id), name, quantity, unit }
RecipeTags: { recipe_id, tag_id }
Tags: { id, code, icon_name, accessible_label }
Sessions: { id, user_id (nullable), session_start, session_end, duration_seconds (derived) }
(Indexes: Recipes(user_id), RecipeIngredients(recipe_id), RecipeTags(tag_id, recipe_id))

## 9. UX Flow Summary
Login/Register → Two‑page view (left inputs, right preview) → Paste → Parse with AI → Right page populated → Adjust → Save → Cookbook view displays saved recipe entries.
Edit Flow: Select recipe → Right page toggles to editable form → Modify → Save.
Delete Flow: Confirmation modal before removal.

## 10. Analytics Event Taxonomy
- session_start / session_end
- recipe_parse_requested
- recipe_parse_success (duration_ms, ingredient_count)
- recipe_parse_timeout / recipe_parse_error (error_code)
- recipe_save (is_ai_assisted: bool)
- recipe_edit
- recipe_delete
- registration_complete
- login_success

## 11. Constraints & Assumptions
- Single sprint (2 weeks) for full MVP.
- AI model cost & latency acceptable within initial budget; no dietary transformations needed now.
- Tag set fixed—no user-created tags reduces complexity.


## 12. Risks (Current View)
- AI latency variability (REQUIRES calibration; potential user frustration if >10s).
- Misclassification of tags (can be corrected manually; low impact).
- User confusion about validation rules or limits (mitigated by clear messaging).

## 13. Mitigations
- Clear validation and error notices for save failures.
- Timeout + manual entry fallback path.
- Pre-launch AI latency test & adjust timeout threshold (maybe progressive loading indicator with spinner + countdown).

## 14. Release Plan (Single Sprint)
Week 1: Data model, auth, basic CRUD UI, image handling, tag selection, session logging skeleton.
Week 2: AI parsing integration, polish UI layout, analytics events, testing, calibration of timeout, deployment.
Deferred Backlog: Filtering/search, dietary transformations, version history, multi-cookbook, export, sharing.

## 15. Open Questions
1. Final predefined tag list & icons (exact set, naming, accessible labels) – TO CONFIRM.
2. Which AI provider/model & prompt spec? (Latency + cost evaluation) – TO DEFINE early in sprint.
3. Should passive vs active prep time be captured separately in data model for future (even if UI sums)? – DECIDE before schema freeze.

5. Image storage location (object storage/CDN strategy) – TO SPECIFY.

## 16. Acceptance Criteria Checklist
- User can paste raw text and receive parsed recipe within ≤10s or get fallback option.
- Registered user can create, edit, delete recipes with enforced limits.
- Tags selectable from predefined list with icons rendered & aria-labels present.
- Analytics events persist for parse, save, session start/end.
- AI failure does not block manual recipe creation.

## 17. Glossary
- AI Parse: Transformation of raw, unstructured text into structured recipe data.
- Passive Time: Waiting/non-active prep (resting, fermenting) included in total.

