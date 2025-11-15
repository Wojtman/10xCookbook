# View Implementation Plan – Recipe Create View

## 1. Overview
- Presents the recipe creation experience in Edit Mode with a dual-pane “book” layout: left pane for raw input plus structured form, right pane for AI-generated preview.
- Supports authenticated users with AI-assisted parsing, manual entry, media upload, and validation aligned with API requirements.

## 2. View Routing
- Path: `/recipes/new`
- Requires cookbook context (e.g., query or state containing `cookbookId`) to submit recipes to `POST /cookbooks/:cookbook_id/recipes`.

## 3. Component Structure
- `RecipeCreateView` (page route component)
  - `BookLayout`
    - `BookLayout.LeftPage`
      - `EditModeHeader`
      - `RawTextSection`
        - `RawTextArea`
        - `ParseActionsBar`
      - `RecipeForm`
        - `TitleField`
        - `PrepTimeField`
        - `DescriptionField`
        - `IngredientListEditor`
          - `IngredientRow` (repeat)
        - `ImageUploadField`
        - `AltTextField`
        - `TagSelector`
        - `SaveButton`
    - `BookLayout.RightPage`
      - `AIDraftPreview`
        - `PreviewSkeleton`
        - `PreviewContent`
        - `PreviewErrorState`
  - `ToastHost`

## 4. Component Details

### RecipeCreateView
- Description: Top-level React page; fetches tags, resolves session context, orchestrates state/hooks, renders layout.
- Main elements: `BookLayout`, context providers (analytics), `ToastHost`.
- Handled interactions: Initial data fetch (tags, cookbook info).
- Validation: Ensures `cookbookId` available before enabling save.
- Types: `TagDTO[]`, `RecipeFormViewModel`, `AIParseResponseDTO`, `CreateRecipeCommand`.
- Props: Receives `cookbookId`, `userId` (from router/loader/context).



### EditModeHeader
- Description: Displays “Edit Mode” badge, recipe creation title, contextual actions (e.g., breadcrumbs).
- Main elements: `<header>`, `Badge`, optional `Back` link.
- Handled interactions: Breadcrumb/back navigation.
- Validation: none.
- Types: none beyond primitives.
- Props: `onBack`, `cookbookTitle?`.

### RawTextSection
- Description: Container grouping raw paste input and parse controls.
- Main elements: `<section>`, `RawTextArea`, `ParseActionsBar`.
- Handled interactions: Forward-change events from text area and parse trigger to parent.
- Validation: Raw text length ≤ `VALIDATION_CONSTANTS.AI_PARSE.MAX_TEXT_LENGTH` prior to parse call.
- Types: `RawTextState`.
- Props: `rawText`, `onRawTextChange`, `charCount`, `maxChars`, `parseState`, `onParse`, `onCancelParse`.

### RawTextArea
- Description: Multiline textarea maintaining raw recipe text with character counter.
- Main elements: `<label>`, `<textarea>`, `<span>` for counter.
- Handled interactions: `onChange`, `onBlur`, optional `onPaste`.
- Validation: `required` for parse invocation; enforce `maxLength` (50,000) and display counter.
- Types: `RawTextState`.
- Props: `value`, `onChange`, `maxLength`, `charCount`.

### ParseActionsBar
- Description: Buttons for `Parse with AI` and optional `Cancel`/`Regenerate`; shows loading indicator and timeout messaging.
- Main elements: Buttons, spinner, tooltip for rate limits.
- Handled interactions: `onParseClick`, `onCancelClick`, analytics events (`recipe_parse_requested`).
- Validation: Disabled when raw text empty or parse in progress; surfaces errors/timeouts (mapped from `AIParsingError` codes).
- Types: `AIParseStatus`, `AIParseError`.
- Props: `state` (idle/loading/success/error/timeout), `disabled`, `error`, `onParse`, `onRetry`, `elapsedMs`.

### RecipeForm
- Description: Controlled form mapping structured recipe fields aligned with `CreateRecipeCommand`.
- Main elements: `<form>` (prevent default), fieldset sections per group.
- Handled interactions: Field change handlers, submit (delegates to parent), triggers validation updates, stores manual adjustments.
- Validation: Centralized check for title, description length, ingredient count, ingredient name presence, alt text when image exists, numeric prep time.
- Types: `RecipeFormViewModel`, `FormValidationState`.
- Props: `formState`, `validationState`, `onFieldChange`, `onIngredientChange`, `onTagToggle`, `onSubmit`, `onImageChange`, `isSaveDisabled`, `isSaving`.

### TitleField
- Description: Text input for recipe title with validation messaging.
- Main elements: `<input type="text">`, helper text.
- Handled interactions: `onChange`, `onBlur`.
- Validation: `required`, trim non-empty; propagate error if empty.
- Types: string.
- Props: `value`, `error`, `onChange`.

### PrepTimeField
- Description: Numeric input for prep time minutes.
- Main elements: `NumberInput` with optional “manual override” label.
- Handled interactions: `onChange`, clamps to ≥0 integers.
- Validation: Must be integer ≥0 if provided; display hint if AI-suggested value present.
- Types: number | undefined.
- Props: `value`, `onChange`, `error`.

### DescriptionField
- Description: Textarea for structured preparation description.
- Main elements: `<textarea>`, character counter.
- Handled interactions: `onChange`, `onBlur`.
- Validation: `required`, length ≤ 5000 characters; show remaining characters.
- Types: string.
- Props: `value`, `onChange`, `maxLength`, `error`.

### IngredientListEditor
- Description: Manages up to 50 ingredients with display order, name, quantity, notes, autosuggest integration.
- Main elements: List of `IngredientRow`, “Add ingredient” button.
- Handled interactions: Add/remove rows, reorder (if drag/drop), field edits, autosuggest selection (calls ingredient-search endpoint).
- Validation: ≤50 items, every `name` non-empty, sequential `display_order`.
- Types: `IngredientItemViewModel[]`, `IngredientCatalogDTO`.
- Props: `ingredients`, `onIngredientsChange`, `onAdd`, `onRemove`, `onReorder`, `errors`, `maxItems`.

### IngredientRow
- Description: Represents a single ingredient entry with optional link to catalog item.
- Main elements: Inputs for name, quantity, notes; optional dropdown for search results; remove button.
- Handled interactions: Field change, remove, search query change.
- Validation: Name required; display order auto-managed.
- Types: `IngredientItemViewModel`.
- Props: `item`, `onChange`, `onRemove`, `errors`, `searchResults`, `onSearch`.

### ImageUploadField
- Description: Handles selecting/dropping image, shows preview, triggers upload API.
- Main elements: Dropzone, preview thumbnail, replace/remove buttons, progress indicator.
- Handled interactions: `onFileSelect`, `onUpload`, `onRemove`.
- Validation: File ≤2MB, type PNG/JPEG/WebP, processed ≤1024×1024 (backend double-check); show validation errors from upload API.
- Types: `ImageUploadState`, `ImageUploadResponseDTO`.
- Props: `imageState`, `onUpload`, `onRemove`, `uploading`, `error`.

### AltTextField
- Description: Editable alt text, defaults to title when empty; disabled until image present.
- Main elements: `<input>` with helper text.
- Handled interactions: `onChange`, auto-sync with title if user has not overridden.
- Validation: When image present, alt text required (per accessibility best practice).
- Types: string.
- Props: `value`, `onChange`, `disabled`, `error`.

### TagSelector
- Description: Predefined tag toggle list with accessible controls.
- Main elements: Multi-select button group or checkbox list, search/filter input optional.
- Handled interactions: Toggle tag selection; surface suggestion highlights for AI-suggested tags.
- Validation: Tag IDs must exist (provided from backend list).
- Types: `TagDTO[]`, `string[]`.
- Props: `availableTags`, `selectedTagIds`, `suggestedTagSlugs`, `onToggle`, `loading`, `error`.

### SaveButton
- Description: Primary form submission button with disabled state and loading spinner.
- Main elements: `<button type="submit">`.
- Handled interactions: Submit form; surfaces `recipe_save` analytics event.
- Validation: Disabled until validation passes; ensures no save during AI parse/upload operations.
- Types: none beyond primitives.
- Props: `disabled`, `isLoading`, `label`.

### AIDraftPreview
- Description: Right pane preview of AI-structured recipe; syncs with AI results or manual updates.
- Main elements: Layout mirroring preview spread (title, image, ingredients, instructions, tags).
- Handled interactions: None direct (read-only) except optional “Apply to form” actions.
- Validation: Display content only when AI result available; fallback messaging otherwise.
- Types: `AIParseResponseDTO`, `RecipeFormViewModel`.
- Props: `aiState`, `aiResult`, `formState`, `onApplyField`, `onReset`.

### PreviewSkeleton
- Description: Placeholder shimmer shown during AI parse.
- Main elements: Skeleton blocks.
- Handled interactions: None.
- Validation: Visible when `aiState === 'loading'`.

### PreviewErrorState
- Description: User-friendly message when AI parsing fails or times out.
- Main elements: Error illustration/text, retry button linking to parse action.
- Handled interactions: `onRetry`.
- Validation: Distinguishes between timeout and generic error for messaging.
- Types: `AIParsingErrorCode`.
- Props: `errorCode`, `supportingMessage`, `onRetry`.




### ToastHost
- Description: Houses global toast notifications (success/error).
- Main elements: `ToastProvider` from shadcn/ui.
- Handled interactions: Show/hide toasts triggered by operations.
- Validation: none.
- Types: none beyond primitives.
- Props: Provided by context.

## 5. Types
- `RecipeFormViewModel`
  - `title: string`
  - `preparationDescription: string`
  - `prepTimeMinutes?: number`
  - `ingredients: IngredientItemViewModel[]`
  - `image?: ImageUploadResponseDTO | null`
  - `imageAltText: string`
  - `tagIds: string[]`
  - `displayOrder?: number`
  - `isAiAssisted: boolean`
  - `aiSuggestedTagSlugs: string[]`
- `IngredientItemViewModel`
  - `id: string` (local UUID)
  - `display_order: number`
  - `name: string`
  - `quantity?: string | null`
  - `notes?: string | null`
  - `ingredient_id?: string | null`
  - `error?: string`
- `RawTextState`
  - `value: string`
  - `charCount: number`
- `AIParseStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout'`
- `AIParseError`
  - `code: AIParsingErrorCode`
  - `message: string`
- `FormValidationState`
  - `fields: Record<string, string | undefined>`
  - `isValid: boolean`
- `ImageUploadState`
  - `data?: ImageUploadResponseDTO`
  - `uploading: boolean`
  - `error?: string`
- `SaveRecipePayload` (extends `CreateRecipeCommand`)
  - `tag_ids: string[]`
  - `ingredients: RecipeIngredientInput[]`
  - `is_ai_assisted: boolean` (used for analytics payload alongside API call)

## 6. State Management
- `RecipeCreateView` owns top-level state using React hooks (`useState`, `useReducer`).
- Custom hooks:
  - `useRecipeForm(initialState)`: encapsulates form state, validation logic, computed `isSaveDisabled`, syncing alt text defaults, enforcing ingredient limits.
  - `useAIParse()`: manages parse lifecycle, handles abort on unmount, surfaces status/error, logs analytics (`recipe_parse_requested|success|timeout|error`).
  - `useImageUpload()`: wraps upload API call, caches latest `ImageUploadResponseDTO`, bubbles validation errors.
  - `useTagOptions()`: fetches tags on mount, caches result, handles errors/loading.
- Derived state such as `isSaveDisabled` depends on validation state, parse/upload statuses, and dirty flags.

## 7. API Integration
- `POST /ai/parse`
  - Request body typed as `AIParseCommand`.
    - `raw_text: rawTextState.value.trim()`
  - Response typed as `AIParseResponseDTO`; on success update form fields (prefill ingredients, tags, prep time, description/title when empty).
  - Handle errors/timeouts per `AIParsingError.code`.
- `GET /tags`
  - Response typed `TagListResponseDTO`; map to `TagDTO[]` for selector.
- `POST /images/upload`
  - Multipart form containing `file`.
  - Response typed `ImageUploadResponseDTO`; store in form state.
  - Handle 400/413/415/429 errors with user-facing messages.
- `POST /cookbooks/:cookbook_id/recipes`
  - Request typed `CreateRecipeCommand` constructed from `RecipeFormViewModel`.
    - `ingredients` mapped to `RecipeIngredientInput[]` with contiguous `display_order`.
    - `tag_ids` direct from selected tag IDs.
    - `image_alt_text` default to title if user left blank.
  - Response typed `RecipeDetailDTO`; on success dispatch toast and redirect to recipe preview.
- Analytics events integration: call analytics service (existing hook) with `LogAnalyticsEventCommand` for parse and save events.

## 8. User Interactions
- Typing/pasting raw text updates state and char counter; parse button enabled when text present.
- Clicking “Parse with AI” triggers loading state, disables parse/save until completion, and shows skeleton preview; cancel button aborts request.
- On parse success, user can apply suggestions (auto-populates empty fields) and preview updates; toast indicates success.
- On parse failure/timeout, right pane shows error with retry; raw text preserved.
- Users edit structured fields manually; validation feedback shown inline (e.g., missing title).
- Ingredients management via add/remove buttons; hitting limit shows non-blocking message.
- Image upload by drag/drop or file select; preview shown; remove resets state.
- Tag toggles update selection count; AI-suggested tags visually highlighted.
- Save button validates; when clicked, shows loader and disables fields until API resolves; upon success, triggers `recipe_save` analytics and navigates to recipe view.


## 9. Conditions and Validation
- `title`: required, trim > 0; disable save until satisfied.
- `preparation_description`: required, length ≤ 5000; show remaining chars.
- `ingredients`: length ≤ 50; each `name` required; `display_order` sequential (enforced by editor).
- `prep_time_minutes`: optional, integer ≥ 0; invalid input blocked at field level.
- `raw_text` for AI parse: length ≤ 50,000; check before calling API.
- `tag_ids`: must come from fetched list; attempt to toggle unknown tags disabled.
- `image`: enforce file constraints before upload; show errors for size/type.
- `alt_text`: required if `image` present; default to title when blank.
- `SaveButton`: disabled while parse/upload/save in progress, or validation fails.


## 10. Error Handling
- AI parse: differentiate between timeout (`timeout` code) and other failures; display contextual message with retry and manual entry guidance.
- Image upload: map backend codes (`file_too_large`, `invalid_file_type`, `too_many_requests`) to user-friendly toasts/inline errors; allow re-selection.
- Recipe save: handle 400 validation errors by highlighting fields; 404 (invalid cookbook) shows fatal alert with navigation fallback; generic 500 shows toast with retry.
- Tag fetch failure: show inline error and disable selector until refresh.
- Ingredient search failure: fallback to manual entry message, log error quietly.
- Network errors: provide banner with retry actions; preserve user input.
- Abort controllers clean up pending requests on unmount to prevent memory leaks.

## 11. Implementation Steps
1. Scaffold `RecipeCreateView` route in Astro+React, inject required params/context (cookbookId, session info).
2. Implement `useTagOptions`, `useRecipeForm`, `useAIParse`, `useImageUpload` hooks with initial states and validation logic.
3. Compose layout using `BookLayout`, left/right panes, `EditModeHeader`, and `ToastHost`.
4. Build `RawTextSection` (`RawTextArea`, `ParseActionsBar`) with character counter, parse lifecycle, analytics triggers, and abort handling.
5. Implement `RecipeForm` and subcomponents (`TitleField`, `PrepTimeField`, `DescriptionField`, `IngredientListEditor` with `IngredientRow`, `ImageUploadField`, `AltTextField`, `TagSelector`, `SaveButton`) using controlled inputs and validation feedback.
6. Integrate ingredient search (if desired) within `IngredientRow` using debounce and `searchIngredients` endpoint; ensure graceful degradation.
7. Develop `AIDraftPreview` with skeleton, success, and error states; implement logic to merge AI results into form (prefill empty fields, highlight differences).
8. Add API integrations: connect hooks to `/ai/parse`, `/tags`, `/images/upload`, `/cookbooks/:id/recipes`; ensure analytics logging.
9. (removed) Anonymous local-storage persistence and registration prompt logic are not applicable.
10. Wire save flow: validation guard, payload transformation to `CreateRecipeCommand`, call API, handle responses, redirect to preview view, dispatch `recipe_save` analytics with `is_ai_assisted`.
11. Add comprehensive error handling, toasts, and retry UX for parse, upload, and save flows.
12. Write tests (unit for hooks, integration for component interactions) and ensure accessibility checks (focus order, aria labels, keyboard navigation).
13. Document usage and QA checklist (validation scenarios, AI parse success/failure, rate-limit cases).

