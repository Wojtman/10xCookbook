# REST API Plan for 10xCookbook

## 1. Overview

This REST API provides the backend for 10xCookbook, an application enabling authenticated users to capture, parse, and manage recipes in a personal cookbook. All application content and operations require authentication. The API supports AI-powered recipe parsing, image handling, tagging, and analytics event tracking.

**Base URL:** `/api/v1`

---

## 2. Resources

| Resource | Database Table(s) | Description |
|----------|-------------------|-------------|
| Auth | `auth.users` (Supabase) | User authentication and registration |
| Cookbooks | `cookbooks` | Personal recipe collections |
| Recipes | `recipes`, `recipe_ingredients`, `recipe_tags` | Recipe entries with ingredients and tags |
| Tags | `tags` | Predefined recipe categorization taxonomy |
| Ingredients | `ingredients` | Global ingredient catalog (read-only for users) |
| AI Parse | N/A | AI service integration for recipe parsing |
| Images | Storage + `recipes.image_url` | Recipe image upload and management |
| Analytics | `analytics_events` | User engagement and interaction tracking |

---

## 4. Cookbook Endpoints

### 4.1 List Cookbooks

**GET** `/cookbooks`

**Authentication Required:** Yes

Retrieves all cookbooks for authenticated user.

**Query Parameters:**
- `sort`: Sort field (default: `created_at`)
  - Options: `created_at`, `updated_at`, `title`
- `order`: Sort order (default: `desc`)
  - Options: `asc`, `desc`

**Response (200 OK):**
```json
{
  "cookbooks": [
    {
      "id": "uuid",
      "title": "My Cookbook",
      "is_default": true,
      "recipe_count": 15,
      "created_at": "2025-11-01T10:00:00Z",
      "updated_at": "2025-11-03T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 4.2 Get Cookbook

**GET** `/cookbooks/:id`

**Authentication Required:** Yes

Retrieves single cookbook with metadata.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "My Cookbook",
  "is_default": true,
  "recipe_count": 15,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Cookbook does not exist or user lacks access

---

### 4.3 Create Cookbook

**POST** `/cookbooks`

**Authentication Required:** Yes

Creates new cookbook for authenticated user.

**Request Body:**
```json
{
  "title": "Summer Recipes",
  "is_default": false
}
```

**Validation Rules:**
- `title`: Required, non-empty after trim, unique per user
- `is_default`: Optional boolean (default: false)
- Maximum one `is_default=true` per user (enforced via partial unique index)

**Response (201 Created):**
```json
{
  "id": "uuid",
  "title": "Summer Recipes",
  "is_default": false,
  "recipe_count": 0,
  "created_at": "2025-11-03T10:00:00Z",
  "updated_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation failure
  ```json
  {
    "error": "validation_error",
    "message": "Title is required and must not be empty",
    "fields": ["title"]
  }
  ```
- `409 Conflict`: Duplicate title or multiple default cookbooks
  ```json
  {
    "error": "duplicate_title",
    "message": "A cookbook with this title already exists"
  }
  ```

---

### 4.4 Update Cookbook

**PATCH** `/cookbooks/:id`

**Authentication Required:** Yes

Updates cookbook metadata.

**Request Body:**
```json
{
  "title": "Updated Title",
  "is_default": true
}
```

**Validation Rules:** Same as Create Cookbook

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "is_default": true,
  "recipe_count": 15,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-03T10:15:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Cookbook does not exist or user lacks access
- `400 Bad Request`: Validation failure
- `409 Conflict`: Duplicate title

---

### 4.5 Delete Cookbook

**DELETE** `/cookbooks/:id`

**Authentication Required:** Yes

Deletes cookbook and all contained recipes (cascade).

**Response (204 No Content):**
Empty body

**Error Responses:**
- `404 Not Found`: Cookbook does not exist or user lacks access

---

## 5. Recipe Endpoints

### 5.1 List Recipes

**GET** `/cookbooks/:cookbook_id/recipes`

**Authentication Required:** Yes

Retrieves recipes for specified cookbook.

**Query Parameters:**
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 20, min: 1, max: 100)
- `sort`: Sort field (default: `display_order`)
  - Options: `display_order`, `created_at`, `updated_at`, `title`, `prep_time_minutes`
- `order`: Sort order (default: `asc`)
  - Options: `asc`, `desc`
- `tags`: Comma-separated tag slugs for filtering (e.g., `vegetarian,quick_tag`)
- `search`: Full-text search in title and recipe preparation description

**Response (200 OK):**
```json
{
  "recipes": [
    {
      "id": "uuid",
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
          "icon": "⚡"
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
- `404 Not Found`: Cookbook does not exist or user lacks access

---

### 5.2 Get Recipe

**GET** `/recipes/:id`

**Authentication Required:** Yes

Retrieves single recipe with full details including ingredients.

**Response (200 OK):**
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
    },
    {
      "id": "uuid",
      "display_order": 1,
      "name": "eggs",
      "quantity": "4 large",
      "notes": "room temperature",
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
    },
    {
      "id": "uuid",
      "slug": "dinner",
      "label": "Dinner",
      "icon": "🍽️",
      "description": "Evening meals"
    }
  ],
  "created_at": "2025-11-02T10:00:00Z",
  "updated_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Recipe does not exist or user lacks access

---

### 5.3 Create Recipe

**POST** `/cookbooks/:cookbook_id/recipes`

**Authentication Required:** Yes

Creates new recipe in specified cookbook.

**Request Body:**
```json
{
  "title": "Spaghetti Carbonara",
  "preparation_description": "Classic Italian pasta dish with eggs, cheese, and pancetta...",
  "image_url": "https://storage.example.com/recipes/image.webp",
  "image_alt_text": "Spaghetti Carbonara on white plate",
  "prep_time_minutes": 30,
  "display_order": 0,
  "ingredients": [
    {
      "display_order": 0,
      "name": "spaghetti",
      "quantity": "400g",
      "notes": "dried",
      "ingredient_id": "catalog-uuid"
    },
    {
      "display_order": 1,
      "name": "eggs",
      "quantity": "4 large",
      "notes": "room temperature",
      "ingredient_id": null
    }
  ],
  "tag_ids": ["tag-uuid-1", "tag-uuid-2"]
}
```

**Validation Rules:**
- `title`: Required, non-empty after trim
- `preparation_description`: Required, ≤5000 characters (recipe preparation description)
- `image_url`: Optional, valid URL format
- `image_alt_text`: Optional string (defaults to title if omitted)
- `prep_time_minutes`: Optional, non-negative integer
- `display_order`: Optional integer (default: 0)
- `ingredients`: Array, max 50 items
  - `display_order`: Required, non-negative integer, unique per recipe
  - `name`: Required, non-empty after trim
  - `quantity`: Optional string
  - `notes`: Optional string
  - `ingredient_id`: Optional UUID (must exist in catalog if provided)
- `tag_ids`: Optional array of UUIDs (must exist in tags table)

**Response (201 Created):**
Returns full recipe object as in Get Recipe (5.2)

**Error Responses:**
- `400 Bad Request`: Validation failure
  ```json
  {
    "error": "validation_error",
    "message": "Recipe preparation description exceeds maximum length of 5000 characters",
    "fields": ["description"]
  }
  ```
- `400 Bad Request`: Too many ingredients
  ```json
  {
    "error": "validation_error",
    "message": "Recipe cannot have more than 50 ingredients",
    "fields": ["ingredients"]
  }
  ```
- `404 Not Found`: Cookbook does not exist or invalid tag_ids/ingredient_ids

**Analytics Event:** `recipe_save` with `{ is_ai_assisted: false }`

---

### 5.4 Update Recipe

**PATCH** `/recipes/:id`

**Authentication Required:** Yes

Updates existing recipe. Partial updates supported.

**Request Body:** Same structure as Create Recipe (all fields optional)

**Validation Rules:** Same as Create Recipe

**Response (200 OK):**
Returns full recipe object as in Get Recipe (5.2)

**Error Responses:**
- `404 Not Found`: Recipe does not exist or user lacks access
- `400 Bad Request`: Validation failure

**Analytics Event:** `recipe_edit`

---

### 5.5 Delete Recipe

**DELETE** `/recipes/:id`

**Authentication Required:** Yes

Deletes recipe and all associated ingredients/tags (cascade).

**Response (204 No Content):**
Empty body

**Error Responses:**
- `404 Not Found`: Recipe does not exist or user lacks access

**Analytics Event:** `recipe_delete`

---

### 5.6 Reorder Recipes

**PATCH** `/cookbooks/:cookbook_id/recipes/reorder`

**Authentication Required:** Yes

Updates display_order for multiple recipes in batch.

**Request Body:**
```json
{
  "recipes": [
    { "id": "uuid-1", "display_order": 0 },
    { "id": "uuid-2", "display_order": 1 },
    { "id": "uuid-3", "display_order": 2 }
  ]
}
```

**Validation Rules:**
- All recipe IDs must belong to specified cookbook
- display_order values must be non-negative integers

**Response (200 OK):**
```json
{
  "updated": 3
}
```

**Error Responses:**
- `404 Not Found`: Cookbook or recipe does not exist or user lacks access
- `400 Bad Request`: Validation failure

---

## 6. AI Parsing Endpoint

### 6.1 Parse Recipe with AI

**POST** `/ai/parse`

**Authentication Required:** Yes

Parses raw recipe text using AI service and returns structured data.

**Request Body:**
```json
{
  "raw_text": "Spaghetti Carbonara\n\nIngredients:\n400g spaghetti\n4 eggs\n100g pancetta\n...\n\nInstructions:\n1. Boil pasta..."
}
```

**Validation Rules:**
- `raw_text`: Required, non-empty, max 50,000 characters

**Timeout:** 10 seconds hard limit

**Response (200 OK):**
```json
{
  "title": "Spaghetti Carbonara",
  "preparation_description": "Classic Italian pasta dish with eggs, cheese, and pancetta. Cook spaghetti, mix with egg mixture and pancetta, serve immediately.", 
  "prep_time_minutes": 30,
  "ingredients": [
    {
      "display_order": 0,
      "name": "spaghetti",
      "quantity": "400g",
      "notes": "dried"
    },
    {
      "display_order": 1,
      "name": "eggs",
      "quantity": "4 large",
      "notes": "room temperature"
    },
    {
      "display_order": 2,
      "name": "pancetta",
      "quantity": "100g",
      "notes": "diced"
    }
  ],
  "suggested_tags": ["quick_tag", "dinner"],
  "parsing_duration_ms": 4532
}
```

**Error Responses:**
- `400 Bad Request`: Validation failure
  ```json
  {
    "error": "validation_error",
    "message": "Raw text is required",
    "fields": ["raw_text"]
  }
  ```
- `408 Request Timeout`: AI service timeout
  ```json
  {
    "error": "parse_timeout",
    "message": "AI parsing service timed out after 10 seconds. Please try again or enter recipe manually.",
    "timeout_ms": 10000
  }
  ```
- `500 Internal Server Error`: AI service error
  ```json
  {
    "error": "parse_error",
    "message": "Unable to parse recipe. Please try again or enter recipe manually.",
    "error_code": "ai_service_unavailable"
  }
  ```
- `429 Too Many Requests`: Rate limit exceeded
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Too many parse requests. Please wait 60 seconds and try again.",
    "retry_after": 60
  }
  ```

**Analytics Events:**
- On request: `recipe_parse_requested`
- On success: `recipe_parse_success` with `{ duration_ms, ingredient_count }`
- On timeout: `recipe_parse_timeout` with `{ timeout_ms: 10000 }`
- On error: `recipe_parse_error` with `{ error_code }`

**Rate Limiting:** 10 requests per minute per authenticated user

---

## 7. Tag Endpoints

### 7.1 List Tags

**GET** `/tags`

**Authentication Required:** Yes

Retrieves all predefined tags.

**Response (200 OK):**
```json
{
  "tags": [
    {
      "id": "uuid",
      "slug": "quick_tag",
      "label": "Quick (≤45 min)",
      "icon": "⚡",
      "description": "Recipes that can be prepared in 45 minutes or less",
      "created_at": "2025-11-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "slug": "vegetarian",
      "label": "Vegetarian",
      "icon": "🥗",
      "description": "Contains no meat or fish",
      "created_at": "2025-11-01T00:00:00Z"
    }
  ],
  "total": 12
}
```

---

### 7.2 Get Tag

**GET** `/tags/:id`

**Authentication Required:** Yes

Retrieves single tag by ID or slug.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "slug": "quick_tag",
  "label": "Quick (≤45 min)",
  "icon": "⚡",
  "description": "Recipes that can be prepared in 45 minutes or less",
  "created_at": "2025-11-01T00:00:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Tag does not exist

---

## 8. Image Upload Endpoint

### 8.1 Upload Recipe Image

**POST** `/images/upload`

**Authentication Required:** Yes

Uploads and processes recipe image. Returns storage URL.

**Request:** Multipart form data
- `file`: Image file (PNG, JPEG, WebP)

**Validation Rules:**
- File size: ≤2MB
- File type: PNG, JPEG, WebP
- Dimensions: ≤1024×1024 pixels
- Processing: Normalize to square (crop or letterbox), compress to WebP

**Response (201 Created):**
```json
{
  "image_url": "https://storage.example.com/recipes/abc123.webp",
  "width": 800,
  "height": 800,
  "size_bytes": 125000,
  "format": "webp"
}
```

**Error Responses:**
- `400 Bad Request`: Validation failure
  ```json
  {
    "error": "validation_error",
    "message": "File size exceeds maximum of 2MB",
    "fields": ["file"]
  }
  ```
- `415 Unsupported Media Type`: Invalid file type
  ```json
  {
    "error": "invalid_file_type",
    "message": "Only PNG, JPEG, and WebP images are supported"
  }
  ```
- `413 Payload Too Large`: File exceeds size limit
  ```json
  {
    "error": "file_too_large",
    "message": "Image file must be 2MB or smaller"
  }
  ```

**Rate Limiting:** 20 uploads per hour per authenticated user

---

## 9. Analytics Endpoints

### 9.1 Log Analytics Event

**POST** `/analytics/events`

**Authentication Required:** Yes

Logs user interaction event.

**Request Body:**
```json
{
  "event_type": "recipe_parse_success",
  "event_data": {
    "duration_ms": 4532,
    "ingredient_count": 8
  }
}
```

**Validation Rules:**
- `event_type`: Required, must match predefined list
  - Allowed: `session_start`, `session_end`, `recipe_parse_requested`, `recipe_parse_success`, `recipe_parse_timeout`, `recipe_parse_error`, `recipe_save`, `recipe_edit`, `recipe_delete`, `registration_complete`, `login_success`
- `event_data`: Optional JSONB object

**Response (201 Created):**
```json
{
  "event_id": "uuid",
  "created_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid event_type
  ```json
  {
    "error": "validation_error",
    "message": "Invalid event_type",
    "fields": ["event_type"]
  }
  ```

**Note:** This endpoint is called automatically by frontend for tracked events. Manual calls are supported but not typical.

## 10. Session Endpoints
Not applicable. Anonymous sessions and migration flows are no longer supported. All application operations require authentication.

## 11. Ingredient Catalog Endpoints (Future Enhancement)

### 11.1 Search Ingredients

**GET** `/ingredients/search`

**Authentication Required:** Yes

Searches global ingredient catalog for autocomplete/normalization.

**Query Parameters:**
- `q`: Search query (min 2 characters)
- `limit`: Max results (default: 10, max: 50)

**Response (200 OK):**
```json
{
  "ingredients": [
    {
      "id": "uuid",
      "name": "spaghetti",
      "description": "Long, thin Italian pasta"
    },
    {
      "id": "uuid",
      "name": "spaghetti squash",
      "description": "Vegetable with spaghetti-like flesh"
    }
  ],
  "total": 2
}
```

**Note:** Read-only for regular users. Catalog management reserved for administrators.

---

## 13. Error Response Standards

All error responses follow consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error description",
  "fields": ["field_name"],
  "timestamp": "2025-11-03T10:00:00Z",
  "request_id": "uuid"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `204 No Content`: Success with no response body
- `400 Bad Request`: Validation error or malformed request
- `401 Unauthorized`: Authentication required or invalid token
- `403 Forbidden`: Authenticated but lacks permission
- `404 Not Found`: Resource does not exist
- `408 Request Timeout`: AI parsing timeout
- `409 Conflict`: Resource conflict (duplicate, constraint violation)
- `413 Payload Too Large`: Request body exceeds size limit
- `415 Unsupported Media Type`: Invalid content type
- `422 Unprocessable Entity`: Semantic validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Service temporarily unavailable

---
## 16. Pagination Standards

List endpoints support pagination with consistent format:

**Query Parameters:**
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 20, min: 1, max: 100)

**Response Structure:**
```json
{
  "items": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 145,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## 17. Filtering and Sorting Standards

### Filtering

**Query Parameter Format:**
- Single filter: `?field=value`
- Multiple values (OR): `?tags=vegetarian,vegan`
- Range: `?prep_time_min=10&prep_time_max=45`

**Supported Filters:**
- Recipe listing: `tags`, `search`, `prep_time_min`, `prep_time_max`
- Cookbook listing: None (user sees only their own)

### Sorting

**Query Parameters:**
- `sort`: Field name
- `order`: `asc` or `desc` (default: `asc`)

**Supported Sort Fields:**
- Recipes: `display_order`, `title`, `created_at`, `updated_at`, `prep_time_minutes`
- Cookbooks: `title`, `created_at`, `updated_at`

---

## 18. Validation Rules Summary

### Recipe Validation
- **Title:** Required, non-empty after trim
- **Recipe Preparation Description:** Required, ≤5000 characters
- **Prep Time:** Optional, non-negative integer
- **Ingredients:** Max 50 items per recipe
  - **Name:** Required, non-empty after trim
  - **Quantity:** Optional string
  - **Notes:** Optional string
  - **Display Order:** Required, non-negative, unique per recipe
- **Tags:** Optional, must reference existing tag IDs
- **Image URL:** Optional, valid URL format
- **Alt Text:** Optional string

### Cookbook Validation
- **Title:** Required, non-empty after trim, unique per user
- **is_default:** Optional boolean, max one true per user

### Image Upload Validation
- **File Size:** ≤2MB
- **File Type:** PNG, JPEG, WebP
- **Dimensions:** ≤1024×1024 pixels
- **Processing:** Normalize to square, convert to WebP

---

## 19. Business Logic Implementation

### Authenticated User Flow

1. **Registration** (`POST /auth/register`)
   - Create user account
   - Establish authenticated session
   - Log `registration_complete` event

2. **Authenticated Usage**
   - AI parsing, image uploads, and CRUD operations require authentication
   - Persist recipes directly to the user’s cookbooks
   - Log analytics events with associated `user_id`

### AI Parsing Flow

1. **Parse Request** (`POST /ai/parse`)
   - Validate raw_text input
   - Log `recipe_parse_requested` event
   - Call AI service with 10-second timeout

2. **Success Path**
   - Parse response into structured format
   - Suggest tags based on content
   - Calculate parsing duration
   - Log `recipe_parse_success` event with metrics
   - Return structured data to frontend

3. **Timeout Path**
   - Abort AI request after 10 seconds
   - Log `recipe_parse_timeout` event
   - Return 408 error with manual entry guidance

4. **Error Path**
   - Catch AI service errors
   - Log `recipe_parse_error` event with error_code
   - Return 500 error with manual entry guidance

### Recipe Display Order Management

- **Automatic Ordering:** New recipes appended with `display_order = max(existing) + 1`
- **Manual Reordering:** Batch update via `PATCH /cookbooks/:id/recipes/reorder`
- **Conflict Resolution:** Unique constraint ensures no duplicate positions per cookbook

### Tag Assignment Logic

- **User Selection:** Users choose from predefined tag list
- **AI Suggestions:** AI parsing suggests relevant tags (user can override)
- **Quick Tag Auto-Assignment:** If `prep_time_minutes ≤ 45`, suggest `quick_tag`
- **Long Rest Auto-Assignment:** If recipe preparation description mentions overnight/12+ hours, suggest `long_rest`

### Image Processing Pipeline

1. **Upload Reception:** Validate file size, type, dimensions
2. **Normalization:** Detect aspect ratio, crop/letterbox to square
3. **Compression:** Convert to WebP with quality=85
4. **Storage:** Upload to object storage (Supabase Storage)
5. **URL Generation:** Return public URL with CDN path
6. **Cleanup:** Optionally delete orphaned uploads not associated with any recipe after a retention period

---

## 25. Implementation Notes

### Technology Stack Integration

**Astro 5 + React 19:**
- API consumed via Astro endpoints or React components
- Server-side rendering for recipe preview pages
- Client-side interactivity for edit mode and AI parsing

**Supabase:**
- Authentication via Supabase Auth SDK
- Database queries via Supabase client with RLS
- Storage via Supabase Storage SDK
- Real-time subscriptions for future collaborative features

**TypeScript 5:**
- Shared type definitions between frontend and API
- Generated types from database schema via Supabase CLI

**OpenRouter.ai:**
- AI parsing requests routed through backend proxy
- API key secured server-side
- Timeout and error handling centralized

---

This REST API plan provides a comprehensive foundation for the 10xCookbook MVP, supporting all requirements outlined in the PRD while maintaining security, performance, and extensibility for future enhancements.