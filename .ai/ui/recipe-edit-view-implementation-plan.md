# View Implementation Plan Recipe Edit View

## 1. Overview

Recipe Edit View provides a dual-pane editing experience for updating an existing recipe. It mirrors the New Recipe interface but initializes every field with persisted data. The left pane houses raw input, structured form fields, and AI controls while the right pane shows either the current saved recipe preview or the latest AI parse draft. It enforces validation, supports AI-assisted updates, and handles assets, tags, and analytics required by the PRD.

## 2. View Routing

- Route: `/recipes/:id/edit`
- Guard: authenticated users only; redirect unauthenticated users to login.
- Data prerequisites: recipe ID from params, Supabase session/user context, optional cached tags collection.

## 3. Component Structure

- `pages/recipes/[id]/edit.astro`
  - `RecipeEditPage` (React entry mounted via Astro)
    - `RecipeEditForm` (reuse from create view, extended props)
      - `FormHeader` (title input, `LastSavedIndicator`, Save button, mode badge)
      - `ImageUploadField`
      - `PrepTimeInput`
      - `TagSelector`
      - `IngredientListEditor`
      - `RawTextInput`
      - `AIParseControls`
      - `DiscardChangesButton`
    - `RecipePreviewPane`
      - `RecipePreviewContent`
      - `PreviewModeToggle` (current vs AI draft)
      - `ParseStatusBanner`

## 4. Component Details

### RecipeEditPage

- Component description: Top-level React component responsible for fetching recipe + tag data, orchestrating state, coordinating save/parse actions, and passing handlers to `RecipeEditForm` and `RecipePreviewPane`.
- Main elements: suspense/loader wrapper, error boundary, two-pane layout container, toast triggers.
- Handled interactions: initial fetch (GET `/recipes/:id`), refresh on discard, submit update (PATCH), AI parse trigger, image upload, toggling preview source.
- Handled validation: route-level guard (authenticated check), fetch error (404/403) handling.
- Types: `RecipeDetailDTO`, `TagListResponseDTO`, `UpdateRecipeCommand`, `AIParseResponseDTO`, `ImageUploadResponseDTO`, `RecipeFormState` (new view model).
- Props: `{ recipeId: string }` derived from route.

### RecipeEditForm

- Component description: Reused form structure from create view configured for edit mode; manages all editable fields on the left pane and exposes callbacks.
- Main elements: shadcn form controls (title, rich textarea, number input), ingredient list manager, tag selectors, dropzone for raw text, AI parse button & status, image uploader, save/discard controls, analytics triggers.
- Handled interactions: change inputs, change prep time, toggle tags, add/remove/reorder ingredients, parse AI, save form, discard modifications, accept AI suggestions, update raw text, handle form validation states.
- Handled validation: field-level (title required, description length ≤5000, ingredient name required, ingredient count ≤50, prep time ≥0 integer, raw text length ≤50k, image alt text required when image present). Save disabled when invalid or unchanged.
- Types: `RecipeFormState`, `IngredientFormItem`, `TagOption`, `AIParseResponseDTO`, `UpdateRecipeCommand`.
- Props: `{ initialRecipe: RecipeDetailDTO; tagOptions: TagDTO[]; onSubmit(command: UpdateRecipeCommand): Promise<void>; onParse(rawText: string): Promise<AIParseResponseDTO>; onImageUpload(file: File): Promise<ImageUploadResponseDTO>; onDiscard(): void; parseState: AIState; saveState: SaveState; isDirty: boolean; }`.

### RecipePreviewPane

- Component description: Renders right-pane preview switching between current persisted recipe and AI draft; keeps layout identical to new view preview.
- Main elements: preview header (title, tags, prep time), ingredient list, instructions, image preview, toggle segmented control, status banners for AI parse.
- Handled interactions: toggle preview source, apply AI draft (optional action), close AI draft when invalidated.
- Handled validation: ensures AI draft displays only when valid schema validated; otherwise fallback to current recipe.
- Types: `RecipeDetailDTO`, `AIParseResponseDTO`, `PreviewSource` union type.
- Props: `{ recipe: RecipeDetailDTO; draft: AIParseResponseDTO | null; source: PreviewSource; onSourceChange(next: PreviewSource): void; aiStatus: AIState['status']; }`.

### IngredientListEditor

- Component description: Manages ingredient rows editing with reorder support.
- Main elements: list of input rows (name, quantity, notes), add button, reorder handles, delete buttons, max count banner.
- Handled interactions: add ingredient, remove ingredient, reorder via drag/drop or buttons, edit fields, auto-reindex display order.
- Handled validation: max 50 ingredients, name required (non-empty), display order sequential.
- Types: `IngredientFormItem`, `RecipeIngredientInput`.
- Props: `{ items: IngredientFormItem[]; onChange(next: IngredientFormItem[]): void; disabled?: boolean; maxReached: boolean; }`.

### TagSelector

- Component description: Presents predefined tags with accessible toggles.
- Main elements: grid/list of toggle buttons with icon + label, optional search/filter.
- Handled interactions: toggle selection, show tooltip/description, apply AI-suggested defaults.
- Handled validation: ensures only predefined tags selected; handles empty selection allowed.
- Types: `TagDTO`, `TagOption`.
- Props: `{ options: TagOption[]; onToggle(tagId: string): void; disabled?: boolean; }`.

### ImageUploadField

- Component description: Handles drag/drop or click upload, shows preview, alt text input, remove image action.
- Main elements: dropzone, preview thumbnail, alt text textfield, replace/remove buttons, helper text with constraints.
- Handled interactions: file selection, drop, alt text edit, remove image.
- Handled validation: file size, type, dimensions pre-check, alt text default from title when unchanged, alt text required when image present.
- Types: `ImageUploadResponseDTO`, `ImageUploadState` (new type with url + width + height + size + format + isUploaded boolean), `File`.
- Props: `{ image: ImageUploadState | null; onFileSelected(file: File): Promise<void>; onAltTextChange(value: string): void; onRemove(): void; disabled?: boolean; errors?: string[]; }`.

### AIParseControls

- Component description: Raw text textarea with character count and Parse with AI button, status, retry, apply actions.
- Main elements: textarea, counter, parse button with spinner, cancel/retry controls, status messages.
- Handled interactions: parse request, cancel in-flight parse, retry after error/timeout, apply AI draft to form fields (optional per section), log analytics events.
- Handled validation: raw text required for parse, ≤50,000 characters, respect rate limit feedback.
- Types: `AIParseResponseDTO`, `AIParseCommand`, `AIState` (new type capturing status, error, startedAt, duration, errorCode?).
- Props: `{ value: string; onChange(value: string): void; onParse(): void; onCancel(): void; parseState: AIState; }`.

### LastSavedIndicator

- Component description: Displays timestamp of last successful save (from recipe `updated_at`) with relative time updates.
- Main elements: text label, icon, optional tooltip with exact timestamp.
- Handled interactions: none besides tooltip.
- Handled validation: ensures timestamp exists before rendering.
- Types: `string` (ISO timestamp).
- Props: `{ updatedAt?: string; saving: boolean; }`.

### DiscardChangesButton

- Component description: Resets all form state back to last saved version, confirming if unsaved AI draft present.
- Main elements: button, confirmation modal if dirty.
- Handled interactions: click triggers discard; confirm modal.
- Handled validation: only enabled when dirty.
- Types: none beyond boolean.
- Props: `{ dirty: boolean; onDiscard(): void; }`.

## 5. Types

- `RecipeFormState` (new):
  - `id: string`
  - `cookbookId: string`
  - `title: string`
  - `rawText: string`
  - `preparationDescription: string`
  - `prepTimeMinutes: number | null`
  - `image: ImageUploadState | null`
  - `imageAltText: string`
  - `ingredients: IngredientFormItem[]`
  - `tagIds: string[]`
  - `aiDraft: AIParseResponseDTO | null`
  - `aiSuggestedTags: string[]`
  - `aiStatus: AIState['status']`
  - `aiError?: string`
  - `updatedAt: string`
  - `isDirty: boolean`

- `IngredientFormItem` (new alias of view model):
  - `uuid: string` (client-side unique key)
  - `displayOrder: number`
  - `name: string`
  - `quantity?: string`
  - `notes?: string`
  - `ingredientId?: string | null`

- `TagOption`:
  - `id: string`
  - `slug: string`
  - `label: string`
  - `icon?: string`
  - `description?: string`
  - `selected: boolean`

- `AIState`:
  - `status: 'idle' | 'loading' | 'success' | 'timeout' | 'error'`
  - `startedAt?: number`
  - `durationMs?: number`
  - `errorCode?: string`
  - `message?: string`

- `ImageUploadState`:
  - `imageUrl: string`
  - `width: number`
  - `height: number`
  - `sizeBytes: number`
  - `format: string`
  - `altText: string`
  - `uploading: boolean`

- `PreviewSource` union type: `'current' | 'aiDraft'`

- Reuse DTOs/commands: `RecipeDetailDTO`, `RecipeIngredientDTO`, `RecipeIngredientInput`, `AIParseResponseDTO`, `UpdateRecipeCommand`, `ImageUploadResponseDTO`, `TagDTO`.

## 6. State Management

- Custom hook `useRecipeEdit(recipeId: string)` orchestrates:
  - Fetch recipe detail (GET) and tag list (GET `/tags`).
  - Initialize `RecipeFormState` from `RecipeDetailDTO`.
  - Provide helpers: `updateField`, `updateIngredients`, `toggleTag`, `setRawText`, `setImage`, `markDirty`, `resetToLastSaved`.
  - Manage `saveState` with statuses `'idle' | 'saving' | 'success' | 'error'`.
  - Derive `isDirty` via deep comparison between current state and last saved snapshot.
- Hook returns values consumed by `RecipeEditForm` and `RecipePreviewPane`.
- `useAIParser` encapsulates AI parse requests (with abort controller, analytics emissions, timeout handling) and updates `AIState` + `aiDraft` in `RecipeFormState`.
- `useImageUploader` handles local file validation against `VALIDATION_CONSTANTS`, posts to `/images/upload`, updates `ImageUploadState`.
- `useIngredientManager` ensures display order reindexing and max count enforcement.

## 7. API Integration

- GET `/recipes/:id`
  - Request: `recipeId` path param.
  - Response type: `RecipeDetailDTO` (includes `ingredients: RecipeIngredientDTO[]`, `tags: TagDTO[]`).
  - Usage: prefill form, set `rawText` from stored field (if maintained separately) or initial instructions placeholder.

- PATCH `/recipes/:id`
  - Request body: `UpdateRecipeCommand`.
    - Build from form state: `title`, `preparation_description`, `prep_time_minutes`, `image_url`, `image_alt_text`, `display_order` (if changed), `ingredients` (map to `RecipeIngredientInput[]`), `tag_ids`.
  - Response: `RecipeDetailDTO` (updated). Update form snapshot, `LastSavedIndicator`, `isDirty` false.
  - Emit analytics `recipe_edit` upon success (via analytics service or backend hook).

- POST `/ai/parse`
  - Request body: `AIParseCommand` with `raw_text` (from left pane).
  - Response: `AIParseResponseDTO`. Store as `aiDraft` and display in preview. On success log `recipe_parse_success` with `duration_ms` and ingredient count.
  - Handle error codes (`timeout`, `rate_limit_exceeded`, `parse_error`).

- POST `/images/upload`
  - Request: multipart with `file`. The hook handles `File` and returns `ImageUploadResponseDTO`.
  - Response: update `image` state.

- Optional: `GET /tags` (if not globally cached) using `TagListResponseDTO`.

## 8. User Interactions

- Page load: show skeleton/spinner, fetch recipe + tags. On failure show error page/toast (404/403 -> redirect to recipe view or home).
- Edit fields: update state, mark dirty, revalidate form (title non-empty, etc.).
- AI parse: user clicks Parse -> button enters loading, AI state updates -> on success show AI draft preview and highlight suggested tags. On timeout or error show status banner + allow retry.
- Apply AI suggestions: user can selectively accept (per ingredient/list or entire fields) using existing create view pattern (if present) or new actions.
- Save: disabled until dirty & valid; on click call update API, show spinner; on success toast, update last saved timestamp; on failure show error message.
- Discard: only enabled when dirty; triggers confirmation if AI draft present; resets state to last saved snapshot, clears AI draft.
- Image upload: user drags or selects image; hook validates and uploads; preview updates; alt text auto-populated from title unless user edited.
- Ingredient list: add button disabled when 50 items; removal updates; reorder via drag & drop updates display order.
- Tag selection: clickable toggles with accessible labels; selection stored as tag IDs; AI suggestions highlight new tags.
- Preview toggle: user can switch between `Current Recipe` and `AI Draft` view in right pane; AI draft option disabled if no draft or parse error.

## 9. Conditions and Validation

- Title must be non-empty, trimmed -> enforce via form validation & disable save.
- Preparation description required, ≤5000 characters -> show counter and error message when exceeding.
- Ingredient count ≤50 -> disable add, show helper text `Maximum 50 ingredients`.
- Each ingredient name required -> highlight invalid rows, block save.
- Prep time minutes optional but when provided must be non-negative integer -> use number input with clamp and error message.
- Tag IDs must come from tag list -> restrict selector options.
- Image constraints -> validate file type/size/dimensions before upload; show errors from upload service.
- Raw text for AI parse -> limit to 50,000 characters; show count.
- Save only allowed when `isDirty` and no validation errors.
- Right pane toggles disable AI preview when `aiDraft` null or parse not successful.

## 10. Error Handling

- Fetch errors: 404 -> show "Recipe not found" and navigate back; 403 -> show unauthorized message and redirect.
- Save errors: parse response for validation errors; display inline error summary (e.g., via toast + per-field messages). Keep dirty state intact.
- AI parse timeout (`timeout` or HTTP 408): show banner with retry button and maintain raw text.
- AI parse rate limit (429): show countdown using `retry_after`, disable parse button until elapsed.
- AI parse invalid response: show error message, allow manual editing.
- Image upload errors: present toast/inline message; keep existing image; optionally allow fallback to previous image.
- Network failures: show non-blocking banner; keep unsaved changes.
- Tag fetch failure: show fallback message, disable tag selector, allow save with existing tags.

## 11. Implementation Steps

1. Scaffold Astro route `/recipes/[id]/edit.astro`, apply authenticated guard, mount React entrypoint with `recipeId` prop.
2. Implement `RecipeEditPage` component: integrate suspense/loader, error handling, connect to custom hooks, render two-pane layout reusing create view styles.
3. Create `useRecipeEdit` hook to fetch recipe detail + tags, shape initial `RecipeFormState`, expose handlers and computed values.
4. Extend existing `RecipeForm` (create view) to accept `mode` prop (`'create' | 'edit'`), initial values, last-saved metadata, and discard callback.
5. Implement/extend `useAIParser` hook handling parse requests, analytics, abort/timeouts.
6. Integrate `RecipePreviewPane` to display either persisted recipe or AI draft, matching create view preview styling.
7. Wire ingredient management (reuse hook from create view or implement `useIngredientManager`), ensuring display order reindex after edits.
8. Hook up image upload field to `useImageUploader`, enforcing validation + alt text defaulting to current title when user has not customized alt text.
9. Add Last Saved indicator and Discard button behaviors; ensure discard resets `RecipeFormState` and AI draft.
10. Implement Save flow: build `UpdateRecipeCommand`, call PATCH endpoint, handle responses, update state, show toasts, emit analytics.
11. Add comprehensive validation states, integrate with form library (React Hook Form or existing solution), disable Save until valid & dirty.
12. Write unit/integration tests for hooks and components (form state initialization, save command mapping, AI parse transitions), and update Storybook/preview entries if applicable.
