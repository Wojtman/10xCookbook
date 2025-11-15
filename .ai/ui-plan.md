# UI Architecture for 10xCookbook

## 1. UI Structure Overview

10xCookbook provides an "open book" dual-page paradigm with two primary modes: Preview Mode (read-focused) and Edit Mode (creation / modification). The architecture is optimized for fastest MVP delivery while meeting core functional, accessibility, and security requirements. Navigation is URL/route-driven using Astro + React, with minimal local/Context-based state (session/auth, AI draft) and direct API calls via Supabase client/fetch. All application content requires authentication; there is no anonymous or ephemeral usage. Error feedback is unified through toast notifications; loading states for AI parsing use skeleton placeholders.

High-level layers:

- Global Shell (header, toasts mount point)
- Content Router (determines view)
- BookLayout (two-page container; responsive stacking for small screens)
- View-specific components (list, preview, edit forms)
- Overlays/Popovers (Tag selection, image upload preview)

## 2. View List

### 2.1 Recipe List View

- Path: Integrated into Cookbook Preview view (left sidebar within `/recipes`)
- Purpose: Provide a left navigation list of recipes inside the preview. Selecting a list item updates the preview pages.
- Key Information: "Recipies" heading and a vertical list of recipe items; selection highlight; scrollable list.
- Key Components: `SidebarRecipeList`, `RecipeListItem`, `ToastHost`.
- UX/Accessibility/Security: List items are focusable with keyboard navigation; selected state announced; any thumbnails include alt text.

### 2.2 Recipe Preview Spread View

- Path: `/recipes` (Cookbook preview view)
- Purpose: Display two recipe previews side-by-side like an open cookbook, with a left sidebar list for navigation.
- Key Information (per half-page):
  - Top-left: recipe name
  - Top-right: tags and a `[+]` add-tag button
  - Content: left column shows recipe preparation description; right column shows image (top) and ingredients list (bottom)
  - Bottom: pagination buttons — "Previous page" on the left page (aligned right), "Next page" on the right page (aligned left)
- Key Components: `BookLayout`, `SidebarRecipeList`, `RecipePreviewCard` (left/right), `TagChips`, `AddTagButton`, `SpreadNavigation`, `ToastHost`.
- UX/Accessibility/Security: Deterministic tab order left page → right page → navigation; semantic landmarks; alt text for images.

### 2.3 New Recipe (Create) View

- Path: `/recipes/new`
- Purpose: Create a single recipe. Layout mirrors the preview spread, but both panes relate to the same recipe.
- Layout:
  - Left pane: User data — raw text input and structured form fields (title, recipe preparation description, ingredients editor, prep time, image upload, tags selector)
  - Right pane: AI parsed recipe preview generated from the left pane input; updates on Parse/Regenerate
- Key Components: `BookLayout` (Left: `UserDataForm`, `RawTextArea`, `IngredientListEditor`, `TagSelectorTrigger`, `SelectedTagChips`, `ImageUploader`, `SaveButton`, `ParseButton`; Right: `AIDraftPreview`, `SkeletonParse`), `ToastHost`.
- UX/Accessibility/Security: Parse actions focusable; skeleton while loading; save disabled until valid; no spread navigation or sidebar list (single recipe only).

### 2.4 Edit Recipe View

- Path: `/recipes/:id/edit`
- Purpose: Modify an existing single recipe. Layout identical to New Recipe, prefilled with existing data.
- Layout:
  - Left pane: Prefilled user data with editable fields and raw text
  - Right pane: Current structured view or AI re-parse preview of the same recipe
- Key Components: Same as New Recipe plus `LastSavedIndicator`, `DiscardChangesButton`.
- UX/Accessibility/Security: Save disabled until changes are valid; route is guarded for authenticated users; conflict/validation errors surfaced via toast.

### 2.5 Authentication View (Register/Login)

- Path: `/auth` (sub-routes `/auth/login`, `/auth/register` optional)
- Purpose: Provide registration and login flows to access the application.
- Key Information: Email, password fields, password rules.
- Key Components: `AuthForm`, `PasswordStrengthHint`, `SubmitButton`, `AuthModeToggle`.
- UX/Accessibility/Security: Proper input labeling; password field with aria-described hint; errors via toast; rate limit or server errors show standard toast; on success navigate to the main app.

### 2.6 (removed)

Anonymous migration and session initialization views/components are not applicable under authenticated-only access.

### 2.8 Tag Selection Overlay

- Path: Modal/Popover (triggered from Create/Edit)
- Purpose: Allow choosing tags from predefined list; no AI suggestion section in MVP.
- Key Information: Tag list (icon, label), currently selected state, search filter (optional future), confirm action.
- Key Components: `TagSelectorPanel`, `TagOptionButton`, `CloseButton`.
- UX/Accessibility/Security: Focus trap; escape key closes; ARIA roles `listbox` / `option`.

### 2.9 Image Upload Inline Component

- Path: Inline in Create/Edit
- Purpose: Client-side normalization of selected image before upload.
- Key Information: Preview thumbnail, alt text (default title), file validation status.
- Key Components: `ImageUploader`, `AltTextInput`, `ImagePreview`, `FileValidationMessage`.
- UX/Accessibility/Security: Drag-and-drop zone labeled; alt text editable; file errors surfaced via toast + inline message; accept attribute restricts formats.

### 2.10 Not Found / Error Fallback View

- Path: `/*` unmatched or resource not found scenarios
- Purpose: Provide graceful messaging for missing recipes or invalid routes.
- Key Information: Error code (404), action to return to list.
- Key Components: `ErrorState`, `ReturnLink`.
- UX/Accessibility/Security: Focus moves to heading; descriptive text; minimal.

### 2.11 Rate Limit / Global Error Toast (Cross-cutting)

- Path: N/A
- Purpose: Convey transient errors uniformly.
- Key Components: `ToastHost`, `Toast` items.
- UX/Accessibility/Security: Announce via ARIA live region; sequential stacking; auto-dismiss with pause on focus.

## 3. User Journey Map

### Primary Flow (Authenticated)

1. User logs in via `/auth/login` (or registers at `/auth/register`) and is redirected to `/recipes`.
2. User clicks "New Recipe" → `/recipes/new` view loads; enters raw text.
3. User triggers AI Parse → skeleton appears; success populates structured draft OR timeout → error toast + manual editing continues.
4. User adjusts fields, adds tags via Tag Selection Overlay, uploads image (normalized client-side).
5. User saves recipe → persisted to their cookbook → toast confirms.
6. User navigates back to `/recipes` → sees persisted list; opens a spread via `/recipes/:id` (left recipe); right recipe auto-shown. Edit button on either page routes to `/recipes/:thatRecipeId/edit`.

### Edit & Maintenance Flow

1. Authenticated user opens `/recipes/:id` spread (left recipe = given id, right recipe = next by sort order).
2. Selects Edit on chosen page → navigates to `/recipes/:chosenId/edit` (single-recipe dual-pane edit mode).
3. Saves changes → redirected back to spread anchored on the edited recipe id (if left) or original left id (if right) with updated content; optional indicator.
4. Deletes recipe → if left deleted, route advances to next recipe id; if right deleted, right page re-renders next recipe or Empty CTA; toast confirms action.

### Error/Edge Flow

- AI Timeout: skeleton replaced by inline error block + toast; user continues manually.
- Rate Limit (AI or upload): toast explains wait; user can retry after countdown.
- Validation error on save: toast plus field highlight; focus moves to first invalid field.

## 4. Layout and Navigation Structure

### Global Shell

- Header: Logo/App name, New Recipe button, Auth status (Register/Login or User Menu), optional cookbook title (single for MVP).
- Main Content: Router outlet containing BookLayout or standard container.
- ToastHost: Positioned fixed bottom-right or top-right; ARIA live region.

### Navigation

- Primary navigation via recipe list and direct actions on cards (open preview).
- Route transitions: push state on view changes; browser back supported.
- Disabled actions: New/Edit/Delete if unauthorized; tooltip on hover.

### Responsive Behavior

- Desktop: Dual-page spread (two columns) with consistent height; scroll per page.
- Mobile/Tablet Narrow: Stack pages vertically; optional tabs or headings to delineate “Page Left” / “Page Right”; maintain left-first tab order.
- Image and ingredient list collapse to accordions on very small screens.

### Accessibility Considerations

- Deterministic tab sequence: left page interactive elements first, then right page.
- All interactive components have focus states and ARIA labeling (buttons, toggles, tag chips).
- Live regions for toast notifications.
- Color contrast meets WCAG AA; no information conveyed solely by color (disabled actions include icon + tooltip).

### Security Considerations

- Auth context read before enabling persistence actions.
- Image upload restricted by file input accept attributes; client-side validation before network call.

## 5. Key Components

| Component                    | Description                                               | Reuse              | Accessibility Notes                                         |
| ---------------------------- | --------------------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| `HeaderBar`                  | Top navigation, auth status, new recipe CTA               | All views          | Landmark role `banner`                                      |
| `BookLayout`                 | Two-page container switching between Preview/Edit content | Preview, New, Edit | Logical DOM order left then right                           |
| `RecipeCard`                 | Summary card for recipe listings                          | List               | Entire card focusable, alt text for image                   |
| `IngredientListEditor`       | Manage ingredients (add/remove/reorder, ≤50)              | New/Edit           | Buttons labeled; reorder via accessible controls            |
| `IngredientListRead`         | Read-only ordered ingredients list                        | Preview            | Semantic list `<ol>`                                        |
| `TagChips`                   | Display selected tags with remove action                  | Preview / Edit     | Each chip is a button with `aria-label`                     |
| `TagSelectorPanel`           | Overlay listing predefined tags                           | New/Edit           | Focus trap, escape closes                                   |
| `ImageUploader`              | Client-side normalization and preview                     | New/Edit           | Drop zone label, alt text input tied via `aria-describedby` |
| `SkeletonParse`              | Placeholder during AI parsing                             | New/Edit           | `aria-busy="true"` while loading                            |
| `RawTextArea`                | Paste raw recipe text for AI parsing                      | New/Edit           | Character count accessible description                      |
| `ToastHost` / `Toast`        | Unified error and status notifications                    | Global             | Live region for announcements                               |
| `AuthForm`                   | Login/registration fields                                 | Auth               | Labels + password requirements text                         |
| `MigrationSummary`           | Post-migration confirmation                               | Migrate            | Clear heading focus first                                   |
| `ActionBar`                  | Edit/Delete/Back controls                                 | Preview            | Disabled styling + tooltip for unauthorized                 |
| `SaveButton` / `ParseButton` | Commit create/edit; trigger AI parse                      | New/Edit           | Disabled state reason via tooltip                           |
| `LastSavedIndicator`         | Timestamp of last successful save                         | Edit               | Updates with `aria-live="polite"`                           |
| `ErrorState`                 | Fallback messaging for not found                          | Error view         | Clear descriptive text + navigation link                    |

## Mapping User Stories to Views/Components (Summary)

- US-001 Session start: `/recipes` list initial load.
- US-002 Preview recipe spread: `/recipes/:id` showing two recipes side-by-side (`BookLayout`, two `RecipePage` instances, `SpreadNavigation`).
- US-003 Enter Edit Mode: `/recipes/:id/edit` or `/new` with dual-pane.
- US-004 Paste Raw Text: `RawTextArea`.
- US-005 Request AI Parse: `ParseButton`, `SkeletonParse`.
- US-006 AI Parse Success: Draft panel populates structured fields.
- US-007 Parse Failure/Timeout: `SkeletonParse` replaced by inline error + toast.
- US-008 Manual Entry: Form fields & `IngredientListEditor` available.
- US-009 Ingredient Management: `IngredientListEditor` enforcing ≤50.
- US-010 Validation Blocking Save: `SaveButton` disabled plus toast.
- US-011 Tag Selection: `TagSelectorPanel` & `TagChips`.
- US-012 Image Upload & Normalization: `ImageUploader`.
- US-013 Alt Text Defaulting: `ImageUploader` auto-fills alt text.
- US-016 Register Account: `AuthForm` at `/auth`.
- US-018 Edit Persistent Recipe: `/recipes/:id/edit` (entered from spread’s ActionBar for either recipe page).
- US-019 Delete Persistent Recipe: `ActionBar` Delete flow.
- US-020 Session End Logging: Hook on unload (invisible UI side-effect).

## Edge Cases & Error States (UI Handling)

- AI parse timeout (408): Toast + inline message, retain raw input.
- Rate limit (429): Toast with retry_after countdown; disable parse button temporarily.
- Validation (400/422): Toast plus first invalid field focus.
- Resource Not Found (404): Redirect to Error Fallback view.
- Conflict (409) on cookbook/recipe title: Toast with instruction to change title.
- Image invalid (413/415/400): Inline validation message below uploader + toast.
- Network offline: Optional banner (non-blocking) with retry suggestions.
- Spread end (odd last recipe): Right page displays Empty CTA state (Add New Recipe) instead of blank; navigation still functional.

## Requirements to UI Element Mapping (Selected)

- Dual-pane book layout: `BookLayout` → functional requirement for preview/edit modes.
- AI assisted parse with timeout: `ParseButton` + `SkeletonParse` + timeout handling.
- Ingredient limit enforcement: `IngredientListEditor` counters.
- Tag taxonomy selection: `TagSelectorPanel` (no suggestions for MVP).
- Image normalization: `ImageUploader` client processing.
- Accessibility (tab order, alt text): DOM order left-first; auto alt text fill.
- Error unified handling: `ToastHost`.

## Compatibility With API Plan

- Direct mapping of CRUD endpoints to create/edit/delete actions.
- AI parse endpoint integrated through `ParseButton` with loading skeleton.
- Tags list consumed once per session for selector panel.
- Image upload endpoint called after client normalization; form holds URL result.
- Analytics endpoints fired from action handlers (parse events, save, edit, delete, registration, session start/end).

## Potential Pain Points & Mitigations

- AI failures causing frustration: Fast fallback to manual fields; preserves progress.
- Ingredient management complexity: Simple add/remove list with reorder buttons instead of drag-and-drop MVP.
- Mobile usability of dual-pane: Vertical stacking with clear headings; maintain logical order.
- Disabled actions opacity without clarity: Use clear disabled states and hints as needed.
- Error overload (multiple toasts): Auto-merge identical consecutive error types (future enhancement; MVP simple stacking).

## Unresolved / Future Considerations (Outside MVP Scope)

- Suggested tags UX (AI inference) integration.
- Advanced search/filter UI on list view (currently minimal).
- Multiple cookbooks navigation structure.
- Optimistic updates & caching layer.
- Drag-and-drop ingredient reorder and recipe reorder.
- Design system token formalization beyond Tailwind defaults.
