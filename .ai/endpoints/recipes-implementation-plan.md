# API Endpoint Implementation Plan: Recipe Endpoints

## 1. Endpoint Overview

This implementation plan covers six recipe management endpoints that enable users to create, read, update, delete, and reorder recipes within their cookbooks. All endpoints require authentication and enforce ownership validation to ensure users can only access their own recipes.

**Endpoints:**
1. **GET /cookbooks/:cookbook_id/recipes** - List recipes with pagination, filtering, and sorting
2. **GET /recipes/:id** - Get single recipe with full details including ingredients and tags
3. **POST /cookbooks/:cookbook_id/recipes** - Create new recipe with ingredients and tags
4. **PATCH /recipes/:id** - Update existing recipe (partial updates supported)
5. **DELETE /recipes/:id** - Delete recipe and cascade to ingredients/tags
6. **PATCH /cookbooks/:cookbook_id/recipes/reorder** - Batch update display order of recipes

**Key Features:**
- Full CRUD operations for recipes
- Nested ingredient and tag management
- Pagination and filtering for list view
- Batch reordering for user-defined recipe order
- Analytics event logging for user actions
- Comprehensive authorization checks

---

## 2. Request Details

### 2.1 List Recipes

- **HTTP Method:** GET
- **URL Structure:** `/cookbooks/:cookbook_id/recipes`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `cookbook_id` (path parameter, UUID) - Target cookbook identifier

- **Optional (Query Parameters):**
  - `page` (number, default: 1, min: 1) - Page number for pagination
  - `limit` (number, default: 20, min: 1, max: 100) - Items per page
  - `sort` (enum, default: 'display_order') - Sort field
    - Options: `display_order`, `created_at`, `updated_at`, `title`, `prep_time_minutes`
  - `order` (enum, default: 'asc') - Sort direction
    - Options: `asc`, `desc`
  - `tags` (string) - Comma-separated tag slugs for filtering (e.g., "vegetarian,quick_tag")
  - `search` (string) - Full-text search in title and recipe preparation description

**Request Body:** None

---

### 2.2 Get Recipe

- **HTTP Method:** GET
- **URL Structure:** `/recipes/:id`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `id` (path parameter, UUID) - Recipe identifier

**Request Body:** None

---

### 2.3 Create Recipe

- **HTTP Method:** POST
- **URL Structure:** `/cookbooks/:cookbook_id/recipes`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `cookbook_id` (path parameter, UUID) - Parent cookbook identifier

**Request Body:**
```json
{
  "title": "string (required, non-empty after trim)",
  "preparation_description": "string (required, ≤5000 characters)",
  "image_url": "string (optional, valid URL format)",
  "image_alt_text": "string (optional, defaults to title)",
  "prep_time_minutes": "number (optional, non-negative integer)",
  "display_order": "number (optional, integer, default: 0)",
  "ingredients": [
    {
      "display_order": "number (required, non-negative integer, unique per recipe)",
      "name": "string (required, non-empty after trim)",
      "quantity": "string (optional)",
      "notes": "string (optional)",
      "ingredient_id": "UUID (optional, must exist in catalog if provided)"
    }
  ],
  "tag_ids": ["UUID (optional, must exist in tags table)"]
}
```

---

### 2.4 Update Recipe

- **HTTP Method:** PATCH
- **URL Structure:** `/recipes/:id`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `id` (path parameter, UUID) - Recipe identifier

**Request Body:** Same structure as Create Recipe, all fields optional (partial update)

---

### 2.5 Delete Recipe

- **HTTP Method:** DELETE
- **URL Structure:** `/recipes/:id`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `id` (path parameter, UUID) - Recipe identifier

**Request Body:** None

---

### 2.6 Reorder Recipes

- **HTTP Method:** PATCH
- **URL Structure:** `/cookbooks/:cookbook_id/recipes/reorder`
- **Authentication:** Required (via middleware)

**Parameters:**
- **Required:**
  - `cookbook_id` (path parameter, UUID) - Parent cookbook identifier

**Request Body:**
```json
{
  "recipes": [
    {
      "id": "UUID (required, must belong to cookbook)",
      "display_order": "number (required, non-negative integer)"
    }
  ]
}
```

---

## 3. Used Types

### DTOs (Data Transfer Objects)

From `src/types.ts`:

- **RecipeListItemDTO** - Recipe representation in list view
  ```typescript
  interface RecipeListItemDTO extends Tables<'recipes'> {
    ingredient_count: number;
    tags: TagDTO[];
  }
  ```

- **RecipeDetailDTO** - Full recipe with ingredients and tags
  ```typescript
  interface RecipeDetailDTO extends Tables<'recipes'> {
    ingredients: RecipeIngredientDTO[];
    tags: TagDTO[];
  }
  ```

- **RecipeListResponseDTO** - List response with pagination
  ```typescript
  interface RecipeListResponseDTO {
    recipes: RecipeListItemDTO[];
    pagination: PaginationDTO;
  }
  ```

- **PaginationDTO** - Pagination metadata
  ```typescript
  interface PaginationDTO {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  }
  ```

- **TagDTO** - Tag representation
  ```typescript
  type TagDTO = Tables<'tags'>;
  ```

- **RecipeIngredientDTO** - Ingredient in recipe context
  ```typescript
  type RecipeIngredientDTO = Omit<
    Tables<'recipe_ingredients'>,
    'recipe_id' | 'created_at' | 'updated_at'
  >;
  ```

- **ReorderRecipesResponseDTO** - Reorder operation result
  ```typescript
  interface ReorderRecipesResponseDTO {
    updated: number;
  }
  ```

- **ErrorResponseDTO** - Standard error response
  ```typescript
  interface ErrorResponseDTO {
    error: string;
    message: string;
    fields?: string[];
  }
  ```

### Command Models

From `src/types.ts`:

- **RecipeListQueryParams** - Query parameters for list endpoint
  ```typescript
  interface RecipeListQueryParams {
    page?: number;
    limit?: number;
    sort?: 'display_order' | 'created_at' | 'updated_at' | 'title' | 'prep_time_minutes';
    order?: 'asc' | 'desc';
    tags?: string; // comma-separated
    search?: string;
  }
  ```

- **CreateRecipeCommand** - Create recipe request body
  ```typescript
  interface CreateRecipeCommand extends Omit<
    TablesInsert<'recipes'>,
    'id' | 'created_at' | 'updated_at'
  > {
    ingredients: RecipeIngredientInput[];
    tag_ids?: string[];
  }
  ```

- **UpdateRecipeCommand** - Update recipe request body
  ```typescript
  interface UpdateRecipeCommand extends Partial<
    Omit<TablesUpdate<'recipes'>, 'id' | 'created_at' | 'updated_at'>
  > {
    ingredients?: RecipeIngredientInput[];
    tag_ids?: string[];
  }
  ```

- **RecipeIngredientInput** - Ingredient input structure
  ```typescript
  interface RecipeIngredientInput {
    display_order: number;
    name: string;
    quantity?: string;
    notes?: string;
    ingredient_id?: string;
  }
  ```

- **ReorderRecipesCommand** - Reorder request body
  ```typescript
  interface ReorderRecipesCommand {
    recipes: RecipeReorderItem[];
  }
  ```

- **RecipeReorderItem** - Single recipe reorder item
  ```typescript
  interface RecipeReorderItem {
    id: string;
    display_order: number;
  }
  ```

---

## 4. Response Details

### 4.1 List Recipes

**Success Response (200 OK):**
```json
{
  "recipes": [
    {
      "id": "uuid",
      "cookbook_id": "uuid",
      "title": "Spaghetti Carbonara",
      "preparation_description": "Classic Italian pasta dish...",
      "image_url": "https://storage.example.com/recipes/image.webp",
      "image_alt_text": "Spaghetti Carbonara on white plate",
      "prep_time_minutes": 30,
      "display_order": 0,
      "ingredient_count": 8,
      "tags": [
        {
          "id": "uuid",
          "slug": "quick_tag",
          "label": "Quick (≤45 min)",
          "icon": "⚡",
          "description": "Recipes that can be prepared in 45 minutes or less"
        }
      ],
      "created_at": "2025-11-02T10:00:00Z",
      "updated_at": "2025-11-03T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

**Error Responses:**
- **400 Bad Request** - Invalid query parameters
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Cookbook doesn't exist or user lacks access

---

### 4.2 Get Recipe

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "cookbook_id": "uuid",
  "title": "Spaghetti Carbonara",
  "preparation_description": "Classic Italian pasta dish with eggs, cheese, and pancetta...", 
  "image_url": "https://storage.example.com/recipes/image.webp",
  "image_alt_text": "Spaghetti Carbonara on white plate",
  "prep_time_minutes": 30,
  "display_order": 0,
  "ingredients": [
    {
      "id": "uuid",
      "display_order": 0,
      "name": "spaghetti",
      "quantity": "400g",
      "notes": "dried",
      "ingredient_id": "catalog-uuid"
    }
  ],
  "tags": [
    {
      "id": "uuid",
      "slug": "quick_tag",
      "label": "Quick (≤45 min)",
      "icon": "⚡",
      "description": "Recipes that can be prepared in 45 minutes or less"
    }
  ],
  "created_at": "2025-11-02T10:00:00Z",
  "updated_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- **400 Bad Request** - Invalid recipe ID format
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Recipe doesn't exist or user lacks access

---

### 4.3 Create Recipe

**Success Response (201 Created):**
Returns full recipe object as in Get Recipe (4.2)

**Error Responses:**
- **400 Bad Request** - Validation failure
  ```json
  {
    "error": "validation_error",
    "message": "Recipe preparation description exceeds maximum length of 5000 characters",
    "fields": ["description"]
  }
  ```
- **400 Bad Request** - Too many ingredients
  ```json
  {
    "error": "validation_error",
    "message": "Recipe cannot have more than 50 ingredients",
    "fields": ["ingredients"]
  }
  ```
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Cookbook doesn't exist, user lacks access, or invalid tag_ids/ingredient_ids

---

### 4.4 Update Recipe

**Success Response (200 OK):**
Returns full recipe object as in Get Recipe (4.2)

**Error Responses:**
- **400 Bad Request** - Validation failure
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Recipe doesn't exist or user lacks access

---

### 4.5 Delete Recipe

**Success Response (204 No Content):**
Empty body

**Error Responses:**
- **400 Bad Request** - Invalid recipe ID format
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Recipe doesn't exist or user lacks access

---

### 4.6 Reorder Recipes

**Success Response (200 OK):**
```json
{
  "updated": 3
}
```

**Error Responses:**
- **400 Bad Request** - Validation failure (invalid UUIDs, negative display_order, etc.)
- **401 Unauthorized** - User not authenticated
- **404 Not Found** - Cookbook doesn't exist, user lacks access, or recipe IDs don't belong to cookbook

---

## 5. Data Flow

### 5.1 List Recipes Flow

1. **Request Reception:** Astro endpoint receives GET request at `/cookbooks/:cookbook_id/recipes`
2. **Authentication:** Middleware verifies user session (from `context.locals.supabase.auth.getUser()`)
3. **Parameter Validation:** Validate cookbook_id (UUID) and query parameters using Zod schema
4. **Authorization Check:** Verify user owns the cookbook via RecipeService
5. **Database Query:** Execute paginated query with filters:
   - Join with recipe_tags and tags for tag filtering
   - Apply search filter on title and recipe preparation description using ILIKE
   - Count total recipes for pagination
   - Fetch ingredient count per recipe
   - Fetch associated tags per recipe
6. **Response Construction:** Build RecipeListResponseDTO with pagination metadata
7. **Return:** Send 200 OK with JSON response

**Database Queries:**
```sql
-- Check cookbook ownership
SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2;

-- Get total count
SELECT COUNT(*) FROM recipes 
WHERE cookbook_id = $1 
AND ($2::text[] IS NULL OR id IN (
  SELECT recipe_id FROM recipe_tags WHERE tag_id IN (
    SELECT id FROM tags WHERE slug = ANY($2)
  )
))
AND ($3::text IS NULL OR title ILIKE $3 OR description ILIKE $3); -- description is recipe preparation description

-- Get paginated recipes with ingredient count and tags
SELECT 
  r.*,
  COUNT(DISTINCT ri.id) as ingredient_count,
  COALESCE(json_agg(DISTINCT jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'label', t.label,
    'icon', t.icon,
    'description', t.description
  )) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
LEFT JOIN tags t ON rt.tag_id = t.id
WHERE r.cookbook_id = $1
GROUP BY r.id
ORDER BY r.display_order ASC
LIMIT $2 OFFSET $3;
```

---

### 5.2 Get Recipe Flow

1. **Request Reception:** Astro endpoint receives GET request at `/recipes/:id`
2. **Authentication:** Middleware verifies user session
3. **Parameter Validation:** Validate recipe ID (UUID)
4. **Database Query:** Fetch recipe with all details
5. **Authorization Check:** Verify user owns the parent cookbook
6. **Response Construction:** Build RecipeDetailDTO with ingredients and tags
7. **Return:** Send 200 OK with JSON response

**Database Queries:**
```sql
-- Get recipe with cookbook ownership check
SELECT r.*, c.user_id 
FROM recipes r
JOIN cookbooks c ON r.cookbook_id = c.id
WHERE r.id = $1;

-- Get ingredients
SELECT id, display_order, name, quantity, notes, ingredient_id
FROM recipe_ingredients
WHERE recipe_id = $1
ORDER BY display_order ASC;

-- Get tags
SELECT t.*
FROM tags t
JOIN recipe_tags rt ON t.id = rt.tag_id
WHERE rt.recipe_id = $1;
```

---

### 5.3 Create Recipe Flow

1. **Request Reception:** Astro endpoint receives POST request at `/cookbooks/:cookbook_id/recipes`
2. **Authentication:** Middleware verifies user session
3. **Parameter Validation:** Validate cookbook_id and request body using Zod schema
4. **Authorization Check:** Verify user owns the cookbook
5. **Foreign Key Validation:** Verify all tag_ids and ingredient_ids exist
6. **Database Transaction:** Start transaction for atomic operation
   - Insert recipe record
   - Insert recipe_ingredients records (batch)
   - Insert recipe_tags records (batch)
7. **Analytics Event:** Log `recipe_save` event with `{ is_ai_assisted: false }`
8. **Fetch Created Recipe:** Retrieve full recipe with ingredients and tags
9. **Response Construction:** Build RecipeDetailDTO
10. **Return:** Send 201 Created with JSON response

**Database Queries:**
```sql
-- Check cookbook ownership
SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2;

-- Validate tag_ids
SELECT id FROM tags WHERE id = ANY($1);

-- Validate ingredient_ids
SELECT id FROM ingredients WHERE id = ANY($1);

-- Insert recipe (within transaction)
INSERT INTO recipes (cookbook_id, title, description, image_url, image_alt_text, prep_time_minutes, display_order)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- Insert ingredients (batch)
INSERT INTO recipe_ingredients (recipe_id, display_order, name, quantity, notes, ingredient_id)
VALUES ($1, $2, $3, $4, $5, $6), ...;

-- Insert tags (batch)
INSERT INTO recipe_tags (recipe_id, tag_id)
VALUES ($1, $2), ...;

-- Log analytics event
INSERT INTO analytics_events (user_id, session_id, event_type, event_data)
VALUES ($1, $2, 'recipe_save', '{"is_ai_assisted": false}');
```

---

### 5.4 Update Recipe Flow

1. **Request Reception:** Astro endpoint receives PATCH request at `/recipes/:id`
2. **Authentication:** Middleware verifies user session
3. **Parameter Validation:** Validate recipe_id and request body
4. **Authorization Check:** Verify user owns the recipe's parent cookbook
5. **Foreign Key Validation:** Verify all tag_ids and ingredient_ids exist (if provided)
6. **Database Transaction:** Start transaction
   - Update recipe record with provided fields
   - If ingredients provided: Delete existing recipe_ingredients, insert new ones
   - If tag_ids provided: Delete existing recipe_tags, insert new ones
7. **Analytics Event:** Log `recipe_edit` event
8. **Fetch Updated Recipe:** Retrieve full recipe with ingredients and tags
9. **Response Construction:** Build RecipeDetailDTO
10. **Return:** Send 200 OK with JSON response

**Database Queries:**
```sql
-- Check recipe ownership
SELECT r.id, c.user_id 
FROM recipes r
JOIN cookbooks c ON r.cookbook_id = c.id
WHERE r.id = $1;

-- Update recipe (within transaction)
UPDATE recipes 
SET 
  title = COALESCE($2, title),
  description = COALESCE($3, description),
  image_url = COALESCE($4, image_url),
  image_alt_text = COALESCE($5, image_alt_text),
  prep_time_minutes = COALESCE($6, prep_time_minutes),
  display_order = COALESCE($7, display_order),
  updated_at = now()
WHERE id = $1
RETURNING *;

-- If ingredients provided:
DELETE FROM recipe_ingredients WHERE recipe_id = $1;
INSERT INTO recipe_ingredients (...) VALUES (...);

-- If tag_ids provided:
DELETE FROM recipe_tags WHERE recipe_id = $1;
INSERT INTO recipe_tags (...) VALUES (...);

-- Log analytics event
INSERT INTO analytics_events (user_id, session_id, event_type, event_data)
VALUES ($1, $2, 'recipe_edit', NULL);
```

---

### 5.5 Delete Recipe Flow

1. **Request Reception:** Astro endpoint receives DELETE request at `/recipes/:id`
2. **Authentication:** Middleware verifies user session
3. **Parameter Validation:** Validate recipe ID (UUID)
4. **Authorization Check:** Verify user owns the recipe's parent cookbook
5. **Database Operation:** Delete recipe (cascade to recipe_ingredients and recipe_tags)
6. **Analytics Event:** Log `recipe_delete` event
7. **Return:** Send 204 No Content

**Database Queries:**
```sql
-- Check recipe ownership
SELECT r.id, c.user_id 
FROM recipes r
JOIN cookbooks c ON r.cookbook_id = c.id
WHERE r.id = $1;

-- Delete recipe (cascades to recipe_ingredients and recipe_tags)
DELETE FROM recipes WHERE id = $1;

-- Log analytics event
INSERT INTO analytics_events (user_id, session_id, event_type, event_data)
VALUES ($1, $2, 'recipe_delete', NULL);
```

---

### 5.6 Reorder Recipes Flow

1. **Request Reception:** Astro endpoint receives PATCH request at `/cookbooks/:cookbook_id/recipes/reorder`
2. **Authentication:** Middleware verifies user session
3. **Parameter Validation:** Validate cookbook_id and request body
4. **Authorization Check:** Verify user owns the cookbook
5. **Ownership Validation:** Verify all recipe IDs belong to the cookbook
6. **Database Transaction:** Batch update display_order for all recipes
7. **Response Construction:** Build ReorderRecipesResponseDTO with count
8. **Return:** Send 200 OK with JSON response

**Database Queries:**
```sql
-- Check cookbook ownership
SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2;

-- Verify all recipes belong to cookbook
SELECT id FROM recipes WHERE cookbook_id = $1 AND id = ANY($2);

-- Batch update display_order (within transaction)
UPDATE recipes 
SET display_order = $2, updated_at = now()
WHERE id = $1;
-- Repeat for each recipe in batch
```

---

## 6. Security Considerations

### 6.1 Authentication

- **Middleware Enforcement:** All endpoints require authentication via Astro middleware
- **User Session:** Retrieved from `context.locals.supabase.auth.getUser()`
- **Unauthenticated Access:** Return 401 Unauthorized if session is missing or invalid
- **Token Validation:** Supabase SDK handles JWT verification and expiration

### 6.2 Authorization

- **Ownership Validation:** Every operation must verify user owns the target resource
  - For cookbook operations: `SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2`
  - For recipe operations: Join with cookbooks table to verify ownership
- **Cascade Protection:** Database foreign keys with ON DELETE CASCADE ensure orphaned data prevention
- **Path Parameter Validation:** Always validate UUIDs before database queries to prevent injection

### 6.3 Input Validation

- **Zod Schemas:** Use Zod for all input validation before database operations
- **UUID Format:** Validate all ID parameters match UUID v4 format
- **String Sanitization:** Trim strings and validate non-empty where required
- **Length Limits:** Enforce recipe preparation description ≤5000 chars, max 50 ingredients
- **Numeric Ranges:** Validate prep_time_minutes ≥ 0, page ≥ 1, limit between 1-100
- **Enum Validation:** Restrict sort and order to predefined values
- **URL Validation:** Verify image_url is valid URL format
- **Array Validation:** Check array lengths and element types

### 6.4 SQL Injection Prevention

- **Parameterized Queries:** Supabase SDK uses parameterized queries by default
- **No Raw SQL:** Avoid concatenating user input into SQL strings
- **ILIKE Sanitization:** Escape wildcards in search parameters if needed

### 6.5 Data Exposure

- **Omit Auto-Generated Fields:** Never allow users to set id, created_at, updated_at, user_id
- **Error Messages:** Return generic error messages, log detailed errors server-side
- **Filter Response Fields:** Only return fields defined in DTOs, exclude internal metadata

### 6.6 Rate Limiting

- **Consider Implementation:** While not in MVP spec, consider rate limiting for:
  - Create/update operations (prevent spam)
  - Search operations (prevent DB overload)
- **Cloudflare/Nginx:** Implement at infrastructure level if needed

### 6.7 CORS Configuration

- **Allowed Origins:** Configure Astro CORS middleware for production domains
- **Credentials:** Allow credentials for authenticated requests
- **Methods:** Restrict to GET, POST, PATCH, DELETE as needed

---

## 7. Error Handling

### 7.1 Validation Errors (400 Bad Request)

**Scenarios:**
- Invalid UUID format in path parameters
- Query parameters out of range (page < 1, limit > 100)
- Invalid enum values (sort, order)
- Title empty after trim
- Recipe preparation description exceeds 5000 characters
- More than 50 ingredients
- Negative prep_time_minutes or display_order
- Invalid URL format for image_url
- Malformed request body

**Response Example:**
```json
{
  "error": "validation_error",
  "message": "Recipe preparation description exceeds maximum length of 5000 characters",
  "fields": ["description"]
}
```

**Implementation:**
- Use Zod validation errors to populate `fields` array
- Provide user-friendly messages
- Log full validation error details server-side

### 7.2 Authentication Errors (401 Unauthorized)

**Scenarios:**
- No user session in context.locals
- Expired or invalid JWT token
- User not found in database

**Response Example:**
```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

**Implementation:**
- Check `context.locals.supabase.auth.getUser()` result
- Return early if user is null

### 7.3 Authorization Errors (404 Not Found)

**Note:** Use 404 instead of 403 to avoid information disclosure about resource existence

**Scenarios:**
- User doesn't own the cookbook
- User doesn't own the recipe's parent cookbook
- Cookbook doesn't exist
- Recipe doesn't exist

**Response Example:**
```json
{
  "error": "not_found",
  "message": "Cookbook not found"
}
```

**Implementation:**
- Combine existence and ownership checks in single query
- Return 404 for both missing resources and unauthorized access
- Log actual reason (missing vs unauthorized) server-side

### 7.4 Foreign Key Errors (404 Not Found)

**Scenarios:**
- tag_ids reference non-existent tags
- ingredient_ids reference non-existent catalog ingredients
- Recipe IDs in reorder request don't belong to cookbook

**Response Example:**
```json
{
  "error": "not_found",
  "message": "One or more tag IDs are invalid"
}
```

**Implementation:**
- Validate foreign keys before insert
- Use Supabase .select() to verify IDs exist
- Return specific error for which foreign key failed

### 7.5 Database Errors (500 Internal Server Error)

**Scenarios:**
- Database connection failure
- Transaction deadlock
- Constraint violations (should be caught by validation)
- Unexpected database errors

**Response Example:**
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred. Please try again later."
}
```

**Implementation:**
- Catch all unhandled errors at endpoint level
- Log full error stack trace server-side
- Return generic error message to user
- Consider rollback for transaction failures

### 7.6 Error Logging

**Server-Side Logging:**
```typescript
console.error('[RecipeService] Error details:', {
  operation: 'createRecipe',
  error: error.message,
  stack: error.stack,
  userId: userId,
  cookbookId: cookbookId
});
```

**Analytics Events:**
- Don't log errors to analytics_events table (it's for user analytics)
- Use separate logging service or console for error tracking

---

## 8. Performance Considerations

### 8.1 Database Query Optimization

**Indexes:**
Ensure the following indexes exist (should be in migration files):
- `recipes(cookbook_id)` - For filtering by cookbook
- `recipes(display_order)` - For default sorting
- `recipe_ingredients(recipe_id, display_order)` - For ingredient ordering
- `recipe_tags(recipe_id)` - For tag joins
- `recipe_tags(tag_id)` - For tag filtering
- `tags(slug)` - For tag slug lookups
- Full-text search index on `recipes(title, description)` (description is recipe preparation description) if using PostgreSQL FTS

**Query Patterns:**
- Use `COUNT(*)` in separate query for pagination total (avoid COUNT in main query)
- Use LEFT JOIN for optional relationships (tags, ingredients)
- Use COALESCE for aggregating empty arrays
- Limit ingredient and tag fetches to necessary fields

### 8.2 Pagination Strategy

**Offset-Based Pagination:**
- Use `LIMIT` and `OFFSET` for simplicity
- Calculate total_pages: `Math.ceil(total / limit)`
- For large datasets, consider cursor-based pagination in future

**Query Efficiency:**
```typescript
const offset = (page - 1) * limit;
const { data, count } = await supabase
  .from('recipes')
  .select('*, recipe_ingredients(count), recipe_tags(tag_id)', { count: 'exact' })
  .eq('cookbook_id', cookbookId)
  .range(offset, offset + limit - 1);
```

### 8.3 N+1 Query Prevention

**Problem:** Fetching tags/ingredients separately for each recipe

**Solution:** Use Supabase joins and aggregations
```typescript
// Good: Single query with joins
const { data } = await supabase
  .from('recipes')
  .select(`
    *,
    recipe_ingredients(*),
    recipe_tags(tag_id, tags(*))
  `)
  .eq('id', recipeId)
  .single();

// Bad: N+1 queries
const recipe = await supabase.from('recipes').select('*').eq('id', recipeId).single();
const ingredients = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipeId);
const tags = await supabase.from('recipe_tags').select('*, tags(*)').eq('recipe_id', recipeId);
```

### 8.4 Batch Operations

**Reorder Recipes:**
- Use Supabase batch update if supported, or execute updates in transaction
- Avoid individual UPDATE statements in loop
- Consider using SQL CASE statement for batch updates:
```sql
UPDATE recipes
SET display_order = CASE
  WHEN id = $1 THEN $2
  WHEN id = $3 THEN $4
  ...
END
WHERE id IN ($1, $3, ...);
```

**Ingredient/Tag Inserts:**
- Use batch insert with multiple VALUES
- Supabase supports array inserts: `.insert([{...}, {...}, ...])`

### 8.5 Response Payload Size

**Minimize Data Transfer:**
- Only fetch necessary fields in SELECT queries
- Don't return recipe preparation description in list view if not needed (currently included per spec)
- Consider paginating ingredients if recipes can have many (50 max mitigates this)

**Compression:**
- Enable gzip/brotli compression at server level (Astro supports this)

### 8.6 Caching Strategy

**Not in MVP, but consider:**
- Cache tag list (rarely changes, predefined taxonomy)
- Cache ingredient catalog (grows slowly)
- Don't cache user-specific data (recipes, cookbooks)

### 8.7 Transaction Management

**Keep Transactions Short:**
- Only wrap insert/update/delete operations
- Don't include external API calls or analytics logging in transaction
- Use transaction for:
  - Create recipe (insert recipe + ingredients + tags)
  - Update recipe with ingredients/tags
  - Batch reorder

**Example:**
```typescript
const { data, error } = await supabase.rpc('create_recipe_with_relations', {
  recipe_data: {...},
  ingredients_data: [...],
  tag_ids: [...]
});
```

---

## 9. Implementation Steps

### Step 1: Create Validation Schemas

**File:** `src/lib/validation/recipe.validator.ts`

1. Import Zod and UUID validator
2. Define schema for RecipeListQueryParams
   - Validate page (number, min: 1, default: 1)
   - Validate limit (number, min: 1, max: 100, default: 20)
   - Validate sort (enum, default: 'display_order')
   - Validate order (enum, default: 'asc')
   - Validate tags (optional string, split and validate slugs)
   - Validate search (optional string, trim)
3. Define schema for RecipeIngredientInput
   - Validate display_order (number, non-negative)
   - Validate name (string, non-empty after trim)
   - Validate quantity (optional string)
   - Validate notes (optional string)
   - Validate ingredient_id (optional UUID)
4. Define schema for CreateRecipeCommand
   - Validate title (string, non-empty after trim)
   - Validate description (string, max 5000 chars) - recipe preparation description
   - Validate image_url (optional, valid URL)
   - Validate image_alt_text (optional string)
   - Validate prep_time_minutes (optional, non-negative integer)
   - Validate display_order (optional integer, default: 0)
   - Validate ingredients (array, max 50 items, RecipeIngredientInput schema)
   - Validate tag_ids (optional array of UUIDs)
5. Define schema for UpdateRecipeCommand (partial version of CreateRecipeCommand)
6. Define schema for ReorderRecipesCommand
   - Validate recipes (array of {id: UUID, display_order: number})
7. Export validation functions that parse and return typed results

**Example:**
```typescript
import { z } from 'zod';
import { validateUUID } from './uuid.validator';

const recipeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['display_order', 'created_at', 'updated_at', 'title', 'prep_time_minutes']).default('display_order'),
  order: z.enum(['asc', 'desc']).default('asc'),
  tags: z.string().optional(),
  search: z.string().trim().optional()
});

export function validateRecipeListQuery(params: unknown) {
  return recipeListQuerySchema.parse(params);
}
```

---

### Step 2: Create Recipe Service

**File:** `src/lib/services/recipe.service.ts`

1. Import types, Supabase client type, and validation utilities
2. Define RecipeService class with constructor accepting SupabaseClient
3. Implement helper methods:
   - `checkCookbookOwnership(cookbookId: string, userId: string)` - Verify user owns cookbook
   - `checkRecipeOwnership(recipeId: string, userId: string)` - Verify user owns recipe's cookbook
   - `validateTagIds(tagIds: string[])` - Verify all tag IDs exist
   - `validateIngredientIds(ingredientIds: string[])` - Verify all ingredient IDs exist
4. Implement `listRecipes(cookbookId, queryParams, userId)`:
   - Check cookbook ownership
   - Build query with filters (tags, search)
   - Apply sorting and pagination
   - Fetch recipes with ingredient count and tags
   - Fetch total count for pagination
   - Return RecipeListResponseDTO
5. Implement `getRecipeById(recipeId, userId)`:
   - Fetch recipe with cookbook.user_id
   - Check ownership
   - Fetch ingredients (ordered by display_order)
   - Fetch tags
   - Return RecipeDetailDTO
6. Implement `createRecipe(cookbookId, command, userId)`:
   - Check cookbook ownership
   - Validate tag_ids and ingredient_ids
   - Start transaction (if using RPC) or use Supabase insert with nested relations
   - Insert recipe
   - Insert ingredients (batch)
   - Insert tags (batch)
   - Fetch and return created recipe with full details
7. Implement `updateRecipe(recipeId, command, userId)`:
   - Check recipe ownership
   - Validate tag_ids and ingredient_ids (if provided)
   - Update recipe fields
   - If ingredients provided: delete old, insert new
   - If tag_ids provided: delete old, insert new
   - Fetch and return updated recipe
8. Implement `deleteRecipe(recipeId, userId)`:
   - Check recipe ownership
   - Delete recipe (cascade handles ingredients and tags)
   - Return void
9. Implement `reorderRecipes(cookbookId, command, userId)`:
   - Check cookbook ownership
   - Verify all recipe IDs belong to cookbook
   - Batch update display_order
   - Return count of updated recipes

**Example:**
```typescript
import type { SupabaseClient } from '../db/supabase.client';
import type { RecipeListQueryParams, CreateRecipeCommand, RecipeDetailDTO } from '../../types';

export class RecipeService {
  constructor(private supabase: SupabaseClient) {}

  async checkCookbookOwnership(cookbookId: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('cookbooks')
      .select('id')
      .eq('id', cookbookId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Cookbook not found');
    }
  }

  async listRecipes(cookbookId: string, params: RecipeListQueryParams, userId: string) {
    await this.checkCookbookOwnership(cookbookId, userId);

    // Build query with filters, pagination, etc.
    // ...
  }

  // ... other methods
}
```

---

### Step 3: Create Astro API Endpoints

**Files:**
- `src/pages/api/cookbooks/[id]/recipes/index.ts` - List and create recipes
- `src/pages/api/recipes/[id].ts` - Get, update, delete recipe
- `src/pages/api/cookbooks/[id]/recipes/reorder.ts` - Reorder recipes

**For each endpoint:**

1. Import types, service, validators, and error response utility
2. Add `export const prerender = false` at top of file
3. Define HTTP method handlers (GET, POST, PATCH, DELETE)
4. In each handler:
   - Extract user from `context.locals.supabase.auth.getUser()`
   - Return 401 if user is null
   - Extract and validate path parameters
   - Extract and validate query/body parameters using Zod
   - Instantiate RecipeService with `context.locals.supabase`
   - Call appropriate service method
   - Handle errors with try/catch
   - Log analytics events (if applicable)
   - Return appropriate Response with status code and JSON body

**Example for List Recipes:**
```typescript
// src/pages/api/cookbooks/[id]/recipes/index.ts
import type { APIRoute } from 'astro';
import { RecipeService } from '../../../../lib/services/recipe.service';
import { validateRecipeListQuery, validateCreateRecipeCommand } from '../../../../lib/validation/recipe.validator';
import { validateUUID } from '../../../../lib/validation/uuid.validator';
import { errorResponse } from '../../../../lib/utils/error-response';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    // Authentication
    const { data: { user } } = await context.locals.supabase.auth.getUser();
    if (!user) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    // Validate path parameter
    const cookbookId = context.params.id;
    if (!validateUUID(cookbookId)) {
      return errorResponse('validation_error', 'Invalid cookbook ID', 400);
    }

    // Validate query parameters
    const queryParams = validateRecipeListQuery(Object.fromEntries(context.url.searchParams));

    // Call service
    const recipeService = new RecipeService(context.locals.supabase);
    const result = await recipeService.listRecipes(cookbookId, queryParams, user.id);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[GET /cookbooks/:id/recipes] Error:', error);
    
    if (error.message === 'Cookbook not found') {
      return errorResponse('not_found', 'Cookbook not found', 404);
    }

    return errorResponse('internal_error', 'An unexpected error occurred', 500);
  }
};

export const POST: APIRoute = async (context) => {
  // Similar structure for create recipe
  // ...
};
```

---

### Step 4: Implement Error Response Utility

**File:** `src/lib/utils/error-response.ts` (may already exist)

1. Create helper function to build ErrorResponseDTO
2. Accept error type, message, status code, and optional fields array
3. Return Astro Response with JSON body and status code

**Example:**
```typescript
import type { ErrorResponseDTO } from '../../types';

export function errorResponse(
  error: string,
  message: string,
  status: number,
  fields?: string[]
): Response {
  const body: ErrorResponseDTO = {
    error,
    message,
    ...(fields && { fields })
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

### Step 5: Implement Analytics Event Logging

**File:** `src/lib/services/analytics.service.ts` (create if doesn't exist)

1. Import types and Supabase client
2. Define AnalyticsService class
3. Implement `logEvent(userId, sessionId, eventType, eventData)`:
   - Insert event into analytics_events table
   - Handle errors gracefully (don't fail request if analytics fails)
   - Log errors server-side

**Usage in Recipe Endpoints:**
```typescript
// After successful recipe creation
await analyticsService.logEvent(
  user.id,
  context.locals.sessionId, // Assume middleware sets this
  'recipe_save',
  { is_ai_assisted: false }
);
```

---

### Step 6: Update Middleware for Session Management

**File:** `src/middleware/index.ts`

1. Check if sessionId is already in context.locals
2. If not, generate or retrieve sessionId from cookie/header
3. Set `context.locals.sessionId` for use in analytics

---

### Step 7: Write Unit Tests

**Files:** `src/__tests__/recipe.service.test.ts`, `src/__tests__/recipe.validator.test.ts`

1. Set up test environment with mock Supabase client
2. Test validation schemas:
   - Valid inputs pass
   - Invalid inputs throw errors
   - Edge cases (max length, boundary values)
3. Test service methods:
   - Happy paths return expected data
   - Unauthorized access throws errors
   - Foreign key validation works
   - Database errors are handled
4. Use testing utilities from `src/lib/utils/api-test-helper.ts`

---

### Step 8: Integration Testing

**File:** `src/__tests__/recipe.api.test.ts`

1. Set up test Supabase instance or use mocks
2. Test each endpoint:
   - Test authenticated and unauthenticated requests
   - Test valid and invalid inputs
   - Test authorization (user accessing other user's data)
   - Test pagination and filtering
   - Test cascade delete
   - Test batch reorder
3. Use `src/lib/utils/auth-mock.ts` for authentication mocking

---

### Step 9: Database Migration Review

**Files:** `supabase/migrations/*.sql`

1. Verify indexes exist for query optimization
2. Verify foreign key constraints with ON DELETE CASCADE
3. Verify check constraints match validation rules
4. Verify unique constraints for recipe_ingredients display_order
5. Add any missing indexes based on query patterns

**Recommended indexes:**
```sql
-- If not already present
CREATE INDEX idx_recipes_cookbook_id ON recipes(cookbook_id);
CREATE INDEX idx_recipes_display_order ON recipes(display_order);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag_id ON recipe_tags(tag_id);
```

---

### Step 10: Documentation and Code Review

1. Add JSDoc comments to service methods
2. Document expected errors in function signatures
3. Update API documentation if any changes made to spec
4. Review code for security vulnerabilities
5. Review error handling coverage
6. Ensure all validation rules match spec
7. Verify analytics events are logged correctly

---

### Step 11: Manual Testing

**Test scenarios:**

1. **List Recipes:**
   - Empty cookbook returns empty array
   - Pagination works correctly
   - Filtering by tags works
   - Search works across title and recipe preparation description
   - Sorting by different fields works

2. **Get Recipe:**
   - Returns full recipe with ingredients and tags
   - Returns 404 for non-existent recipe
   - Returns 404 when accessing other user's recipe

3. **Create Recipe:**
   - Creates recipe with all fields
   - Creates recipe with minimal fields
   - Rejects invalid data
   - Rejects > 50 ingredients
   - Rejects invalid tag_ids
   - Analytics event logged

4. **Update Recipe:**
   - Partial update works
   - Full update works
   - Ingredients replacement works
   - Tags replacement works
   - Analytics event logged

5. **Delete Recipe:**
   - Deletes recipe and cascades to ingredients/tags
   - Returns 404 for non-existent recipe
   - Analytics event logged

6. **Reorder Recipes:**
   - Batch update works
   - Rejects recipes not in cookbook
   - Returns correct update count

---

### Step 12: Performance Testing

1. Test pagination with large datasets
2. Test search performance
3. Test tag filtering with multiple tags
4. Profile database queries
5. Verify indexes are used (use EXPLAIN ANALYZE)
6. Test batch reorder with many recipes

---

### Step 13: Deploy and Monitor

1. Deploy to staging environment
2. Run smoke tests
3. Monitor error logs
4. Monitor database performance
5. Check analytics events are logged
6. Deploy to production
7. Monitor production logs and metrics

---

## Summary

This implementation plan provides comprehensive guidance for building six recipe management endpoints. The key principles are:

- **Security first:** Always verify authentication and authorization
- **Validation everywhere:** Use Zod schemas for all inputs
- **Service layer:** Extract business logic from endpoints
- **Error handling:** Provide user-friendly errors, log details server-side
- **Performance:** Use efficient queries, batch operations, and proper indexing
- **Testing:** Comprehensive unit and integration tests
- **Analytics:** Track user actions for insights

By following this plan step-by-step, the development team will implement robust, secure, and performant recipe endpoints that meet all API specification requirements.
