## View Implementation Plan — Recipe Preview Spread

## 1. Overview

The Recipe Preview Spread view presents two recipes side-by-side like an open cookbook, with a left sidebar for navigating the recipe list. It supports authenticated users and anonymous sessions (with an ephemeral banner and disabled actions). Each spread displays:
- Left/Right preview pages: title, tags with add-tag button, recipe preparation description, image, and ingredients.
- Bottom navigation: Previous/Next spread controls.
- Left sidebar: scrollable, selectable recipe list.

This view consumes cookbook and recipe endpoints to fetch data, using Supabase (Postgres + RLS) via the provided service layer. Accessibility requirements include deterministic tab order (left page → right page → navigation), focusable list items, selected state announcement, and alt text for images. Anonymous users see a session banner and disabled actions with tooltips.

## 2. View Routing

- Path: `/recipes`
  - Query parameters:
    - `cookbookId` (optional): if absent, fetch default cookbook (`is_default: true`) from `/cookbooks`.
    - `page` (optional): 1-based spread page index; defaults to 1.
    - `sort`, `order`, `tags`, `search` (optional): forwarded to recipes list for consistency with API.
- Alternative deep link (optional enhancement): `/cookbooks/:cookbookId/recipes?page=1`

## 3. Component Structure

- `BookLayout` (layout container)
  - `SessionBanner` (conditional; anonymous)
  - `aside` → `SidebarRecipeList`
    - `RecipeListItem` (repeated)
  - `main` (two-page spread)
    - `RecipePreviewCard` (left)
      - `TagChips`
      - `AddTagButton`
    - `RecipePreviewCard` (right)
      - `TagChips`
      - `AddTagButton`
    - `SpreadNavigation`
  - `ToastHost` (global notifications)
  - `SkeletonLoader`/`EmptyState` (conditional)

## 4. Component Details

### BookLayout
- Purpose: Responsive layout with left sidebar and two-page spread. Manages grid/stack across breakpoints and tab order.
- Main elements:
  - `div` grid container (Tailwind: responsive grid; e.g., `grid-cols-[280px_1fr]`)
  - `aside` for sidebar, `main` for spread
  - Slots/children for banner, sidebar, main spread, and toasts
- Handled interactions: None (layout only)
- Validation: N/A
- Types: None (layout-only)
- Props:
  - `children` (ReactNode)
  - Optional `banner` (ReactNode), `sidebar` (ReactNode), `spread` (ReactNode)

### SidebarRecipeList
- Purpose: Scrollable, keyboard-navigable list of recipes. Selecting an item updates the spread page (selected item anchors left page).
- Main elements:
  - `header` with title “Recipes”
  - `ScrollArea` container (shadcn/ui) for the list
  - `ul > RecipeListItem[]`
- Handled interactions:
  - Click or Enter/Space on item → `onSelectRecipe(recipeId, index)`
  - Up/Down Arrow key navigation within the list
  - Home/End keys jump to first/last
- Validation:
  - Ensure `selectedId` matches one of the items; if not, compute from `page`
  - Enforce accessible roles/aria: `role="listbox"`, `role="option"`, `aria-selected`
- Types:
  - Uses `RecipeListItemDTO` (from `src/types.ts`) for data
  - VM: `SidebarRecipeListItemVM` (see Types)
- Props:
  - `items: SidebarRecipeListItemVM[]`
  - `selectedRecipeId?: string`
  - `onSelectRecipe: (recipeId: string, index: number) => void`
  - `loading?: boolean`
  - `error?: string`

### RecipeListItem
- Purpose: Render one list item with title, optional thumbnail (future), ingredient count, and tag chips count.
- Main elements:
  - `li` with button-like container
  - Title text; optional small metadata (ingredient count, tags)
- Handled interactions:
  - Click; Enter/Space triggers select
- Validation:
  - `aria-selected` when selected
  - Ensure title is not empty (fallback to “Untitled recipe”)
- Types: `SidebarRecipeListItemVM`
- Props:
  - `item: SidebarRecipeListItemVM`
  - `selected: boolean`
  - `onSelect: () => void`

### RecipePreviewCard
- Purpose: Show a single recipe preview page. Supports left/right alignment differences and deterministic tab sequence.
- Main elements:
  - Header row: Title (left), `TagChips` and `AddTagButton` (right)
  - Content area:
    - Left column: Recipe preparation description (rich text/plain)
    - Right column: Image (top; responsive), Ingredients list (below)
- Handled interactions:
  - Add tag button click → show tooltip if anonymous; else open tag management
  - Image error fallback (broken image → placeholder)
- Validation:
  - Image has `alt` text (`image_alt_text` or derived)
  - Ingredients display order sorted ascending
  - Tags deduplicated and labeled
- Types:
  - Uses `RecipeDetailDTO` for full details
  - VM: `RecipePreviewVM` (see Types)
- Props:
  - `recipe?: RecipePreviewVM` (undefined while loading)
  - `side: 'left' | 'right'`
  - `isAnonymous: boolean`
  - `onAddTag: (recipeId: string) => void`

### TagChips
- Purpose: Render tags as chips (shadcn/ui `Badge`), wrap as needed.
- Main elements: `div` with `Badge` children
- Handled interactions: Optional click to filter by tag (future)
- Validation: None beyond unique keys and safe label rendering
- Types:
  - `TagDTO[]`
- Props:
  - `tags: TagDTO[]`

### AddTagButton
- Purpose: Allow adding tags to a recipe (disabled for anonymous).
- Main elements: `Button` with `+` icon, `Tooltip`
- Handled interactions:
  - Click:
    - Anonymous → tooltip “Sign in to add tags”
    - Authenticated → `onAddTag(recipeId)` (open drawer/modal in parent)
- Validation:
  - Disabled state when `isAnonymous` is true
- Types: None
- Props:
  - `recipeId: string`
  - `isAnonymous: boolean`
  - `onAddTag: (recipeId: string) => void`

### SpreadNavigation
- Purpose: Bottom navigation with Previous/Next spread controls and page indicator.
- Main elements: Left-aligned “Previous page” on left page; Right-aligned “Next page” on right page
- Handled interactions:
  - Click handlers
  - Keyboard shortcuts: ArrowLeft → Previous; ArrowRight → Next
- Validation:
  - Disable buttons at boundaries (`hasPrev`, `hasNext`)
- Types:
  - `SpreadPaginationVM` (see Types)
- Props:
  - `page: number`
  - `hasPrev: boolean`
  - `hasNext: boolean`
  - `onPrev: () => void`
  - `onNext: () => void`

### SessionBanner
- Purpose: Show ephemeral banner explaining anonymous session data loss on refresh.
- Main elements: `Alert`/`Banner` with concise message from US-001
- Handled interactions: Dismiss (optional)
- Validation: Only visible when `isAnonymous` is true
- Types: None
- Props:
  - `visible: boolean`

### ToastHost
- Purpose: Surface error/success notifications globally.
- Main elements: Host provider for toasts (shadcn/ui)
- Handled interactions: None
- Validation: N/A
- Types: None
- Props: None

### SkeletonLoader / EmptyState
- Purpose: Loading placeholders and empty dataset messages.
- Main elements: Skeleton blocks; “No recipes found” state
- Handled interactions: None
- Validation: N/A
- Types: None
- Props:
  - `variant: 'sidebar' | 'card'`

## 5. Types

DTOs from `src/types.ts`:
- `CookbookDTO`, `CookbookListResponseDTO`, `CookbookListQueryParams`
- `RecipeListItemDTO`, `RecipeDetailDTO`, `RecipeListResponseDTO`, `RecipeListQueryParams`
- `TagDTO`, `RecipeIngredientDTO`

New ViewModel types:

```ts
export interface SidebarRecipeListItemVM {
  id: string;
  title: string;
  ingredientCount: number;
  tags: Pick<TagDTO, 'id' | 'slug' | 'label' | 'icon'>[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipePreviewVM {
  id: string;
  title: string;
  preparationDescription: string;
  imageUrl?: string | null;
  imageAltText?: string | null;
  ingredients: RecipeIngredientDTO[];
  tags: TagDTO[];
  prepTimeMinutes?: number | null;
}

export interface SpreadPaginationVM {
  page: number;           // 1-based spread index
  limitPerSpread: number; // always 2
  total: number;          // total recipes
  totalSpreads: number;   // ceil(total / 2)
  hasPrev: boolean;
  hasNext: boolean;
}
```

Mapping notes:
- `SidebarRecipeListItemVM` derives from `RecipeListItemDTO`, renaming fields (camelCase) and reducing tag shape for lightweight list rendering.
- `RecipePreviewVM` mirrors `RecipeDetailDTO` with friendly names and optional image fields.
- `SpreadPaginationVM` is derived from `RecipeListResponseDTO.pagination` with `limitPerSpread` fixed to `2`.

## 6. State Management

- `cookbookId: string | undefined` — from `cookbookId` query or fetched default cookbook.
- `isAnonymous: boolean` — from auth context/session.
- `page: number` — 1-based spread index, synced with URL (`?page=`), default 1.
- `listQuery: RecipeListQueryParams` — `{ page, limit: 2, sort: 'display_order', order: 'asc', tags?, search? }`
- `list: SidebarRecipeListItemVM[]` — list VM from `RecipeListItemDTO[]`
- `pagination: SpreadPaginationVM` — derived from API pagination
- `leftRecipeId?: string`, `rightRecipeId?: string` — computed from list given `page`
- `detailsCache: Map<string, RecipePreviewVM>` — normalized cache of `RecipeDetailDTO` mapped to VM
- `loadingList: boolean`, `loadingLeft: boolean`, `loadingRight: boolean`, `error?: string`
- `pendingTagRecipeId?: string` — when opening tag UI (future enhancement)

Custom hooks:
- `useCookbookSelection()` — returns `{ cookbookId, isLoading, error }`; fetches default cookbook if not provided.
- `useRecipeList(cookbookId, listQuery)` — returns `{ items, pagination, isLoading, error }`.
- `useRecipeDetailsCache()` — returns `{ get(recipeId), prefetch(recipeIds), set(recipe) }`. Prefetch left/right in parallel on page change.
- `useSpreadNavigation(pagination)` — returns `{ page, hasPrev, hasNext, next(), prev(), setPage(p) }`; syncs to URL params.
- `useKeyNavigation({ onPrev, onNext })` — attaches key handlers to view root.

## 7. API Integration

Services (provided):
- `CookbookService.listCookbooks(userId, query?: CookbookListQueryParams): Promise<CookbookListResponseDTO>`
- `RecipeService.listRecipes(cookbookId, userId, query?: RecipeListQueryParams): Promise<RecipeListResponseDTO>`
- `RecipeService.getRecipeById(recipeId, userId): Promise<RecipeDetailDTO | null>`
- `RecipeService.updateRecipe(recipeId, userId, command: UpdateRecipeCommand): Promise<RecipeDetailDTO>` (for tags; future)

Requests:
- Determine `userId` from auth context; anonymous users won’t call authenticated endpoints. For anonymous, show empty state + banner.
- If `cookbookId` is missing:
  - Call `listCookbooks` with defaults; pick `is_default === true` else first item.
- Fetch list for spread:
  - `listRecipes(cookbookId, userId, { page, limit: 2, sort: 'display_order', order: 'asc', tags?, search? })`
- Fetch details for left/right (parallel):
  - `getRecipeById(leftId, userId)` and `getRecipeById(rightId, userId)`

Responses:
- Map `RecipeListResponseDTO.recipes` → `SidebarRecipeListItemVM[]`
- Derive `SpreadPaginationVM`:
  - `limitPerSpread = 2`
  - `total = pagination.total`
  - `totalSpreads = Math.ceil(total / 2)`
  - `hasPrev = page > 1`, `hasNext = page < totalSpreads`
- Map `RecipeDetailDTO` → `RecipePreviewVM`

## 8. User Interactions

- Select a recipe from sidebar:
  - Outcome: Computes spread index so selected item appears on left page (index `i` → `page = floor(i/2)+1`), updates URL `?page`, loads details for left/right.
- Previous/Next page buttons:
  - Outcome: Update `page` (bounds enforced), prefetch next pair, update URL, focus moves to appropriate page container for accessibility.
- Keyboard navigation:
  - In sidebar: Up/Down to move selection; Enter to open selected spread.
  - Global: ArrowLeft/ArrowRight to move spreads; Home/End jump to first/last (optional).
- Add tag button:
  - Anonymous: Tooltip “Sign in to add tags” (no action).
  - Authenticated: Open tag picker UI (future enhancement) → on submit, call `updateRecipe` with new `tag_ids`, refresh details cache.
- Image fallback:
  - Outcome: Show placeholder if image fails to load.

## 9. Conditions and Validation

- Route/query:
  - `page >= 1`; coerce invalid or missing to 1.
  - `limit` fixed at 2 (per spread).
  - `sort` ∈ {'display_order','created_at','updated_at','title','prep_time_minutes'}; default `'display_order'`.
  - `order` ∈ {'asc','desc'}; default `'asc'`.
- Auth:
  - Anonymous: do not call authenticated endpoints; show `SessionBanner`; disable add-tag; show empty state unless local demo data provided.
- API constraints:
  - Cookbook ownership enforced by backend (RLS + verify); front-end surfaces 404/denied as human-readable error.
  - Tag slugs or search not required in this view; if provided, pass-through.
- Accessibility:
  - List items `role="option"` with `aria-selected`.
  - Deterministic tab order: left card interactive elements → right card → navigation controls.
  - Images have `alt` text; if missing, generate from title (“Photo of {title}”).

## 10. Error Handling

- No default cookbook found:
  - Show toast: “No cookbook found.” Show EmptyState; optionally CTA to create cookbook elsewhere.
- Access denied or 404 on list/recipe:
  - Show toast with friendly message; EmptyState for list or blank page for missing right card.
- Network/server errors:
  - Show toast “Something went wrong. Please try again.” Keep prior state; allow retry via navigation or a retry button (optional).
- Image load error:
  - Render placeholder image with neutral background and icon.
- Partial data (odd count):
  - Right card hidden/blank state; navigation still functional.

## 11. Implementation Steps

1. Routing & Shell
   - Add route at `/recipes`. Parse `cookbookId`, `page`, `sort`, `order`, `tags`, `search` from query.
   - Wire global `ToastHost` and `SessionBanner`.
2. Auth & Cookbook Selection
   - Implement `useCookbookSelection()` to fetch default cookbook when `cookbookId` is absent (using `CookbookService.listCookbooks`).
   - Handle anonymous detection; skip data fetch when anonymous, show banner.
3. List Fetch & VM Mapping
   - Implement `useRecipeList(cookbookId, query)` with `{ page, limit: 2, sort: 'display_order', order: 'asc' }`.
   - Map `RecipeListItemDTO[]` → `SidebarRecipeListItemVM[]`.
4. Spread Computation
   - Compute `leftRecipeId` and `rightRecipeId` from list and `page`.
   - Handle odd counts (right may be undefined).
5. Details Cache & Prefetch
   - Implement `useRecipeDetailsCache()` to `get`, `set`, `prefetch` details using `RecipeService.getRecipeById`.
   - On `page` change, fetch both left/right in parallel; store in cache as `RecipePreviewVM`.
6. Components
   - Build `BookLayout` grid with `aside` and `main`.
   - Implement `SidebarRecipeList` with keyboard navigation and selection.
   - Implement `RecipePreviewCard` (shared for left/right via `side` prop), `TagChips`, `AddTagButton`.
   - Implement `SpreadNavigation` with disabled states and keyboard shortcuts.
   - Add `SkeletonLoader` for sidebar and cards; `EmptyState` for no data.
7. Accessibility
   - Apply roles/aria to sidebar list and items; ensure `aria-selected`, focus ring, and visually-hidden announcements for selection changes.
   - Ensure tab order: left card controls → right card controls → nav.
8. URL Sync
   - Implement `useSpreadNavigation` to update `?page=` and read on mount.
9. Error Handling
   - Show toasts for fetch errors; keep last good state where possible.
   - Graceful image fallback.
10. Add Tag (Authenticated only; staged)
   - Wire `AddTagButton` to open placeholder modal/drawer (or route), and plan to call `updateRecipe` with `tag_ids` when picker is implemented.
11. Testing
   - Validate anonymous path (banner, disabled add-tag, no API calls).
   - Validate auth path (default cookbook, list fetch, spread nav).
   - Verify odd/even counts, page boundaries, keyboard navigation, and alt text.

--- 

Notes on Tech Choices:
- Astro 5 with React 19 components; Tailwind 4 for layout and styling; shadcn/ui for Button, Badge, Tooltip, ScrollArea, Skeleton, Toast.
- Supabase browser client provided via context; services (`CookbookService`, `RecipeService`) instantiated with `SupabaseClient<Database>`.
- Strong typing with TypeScript 5; DTOs imported from `src/types.ts`.*** End Patch*** */}``` assistant to=functions.apply_patchilẹassistant պաշտոն to=functions.todo_write зараз to=functions.todo_write JsonWe need to properly call the functions.apply_patch tool with the specified grammar. The content we sent included extra characters at the end like "*/} ...", which is wrong. We need to correct by re-issuing apply_patch with proper string only containing the patch. Let's craft again. We'll include only the patch block. We'll ensure no extra trailing content. Let's re-run apply_patch. We'll also update TODOs after writing. We need to provide status update that we are correcting the patch. We'll then update todo statuses. We'll include minimal micro-update. We'll now call functions.apply_patch again. Let's proceed. assistant to=functions.apply_patchстановка JSON*** Begin Patch

