# API Endpoint Implementation Plan: Cookbook Endpoints

## 1. Endpoint Overview

This plan covers the implementation of five REST API endpoints for managing cookbooks in the 10xCookbook application:

1. **GET /cookbooks** - List all cookbooks for authenticated user with optional sorting
2. **GET /cookbooks/:id** - Retrieve single cookbook with metadata and recipe count
3. **POST /cookbooks** - Create new cookbook for authenticated user
4. **PATCH /cookbooks/:id** - Update cookbook metadata (title and/or default status)
5. **DELETE /cookbooks/:id** - Delete cookbook and all contained recipes (cascade)

All endpoints require user authentication via Supabase Auth. The cookbook resource represents a personal recipe collection, with each user able to maintain multiple cookbooks. Business rules enforce unique titles per user and allow only one default cookbook per user.

---

## 2. Request Details

### 2.1 List Cookbooks

- **HTTP Method:** GET
- **URL Structure:** `/api/cookbooks`
- **Authentication:** Required (Supabase Auth JWT)
- **Parameters:**
  - **Optional Query Parameters:**
    - `sort`: Sort field - Options: `created_at` (default), `updated_at`, `title`
    - `order`: Sort order - Options: `asc`, `desc` (default)
- **Request Body:** None

### 2.2 Get Cookbook

- **HTTP Method:** GET
- **URL Structure:** `/api/cookbooks/:id`
- **Authentication:** Required (Supabase Auth JWT)
- **Parameters:**
  - **Required URL Parameters:**
    - `id`: Cookbook UUID (must be valid UUID v4 format)
- **Request Body:** None

### 2.3 Create Cookbook

- **HTTP Method:** POST
- **URL Structure:** `/api/cookbooks`
- **Authentication:** Required (Supabase Auth JWT)
- **Parameters:** None
- **Request Body:**
  ```json
  {
    "title": "Summer Recipes",
    "is_default": false
  }
  ```
  - **Required Fields:**
    - `title`: String, non-empty after trim, unique per user
  - **Optional Fields:**
    - `is_default`: Boolean (default: false)

### 2.4 Update Cookbook

- **HTTP Method:** PATCH
- **URL Structure:** `/api/cookbooks/:id`
- **Authentication:** Required (Supabase Auth JWT)
- **Parameters:**
  - **Required URL Parameters:**
    - `id`: Cookbook UUID (must be valid UUID v4 format)
- **Request Body:** (All fields optional, partial update supported)
  ```json
  {
    "title": "Updated Title",
    "is_default": true
  }
  ```
  - **Optional Fields:**
    - `title`: String, non-empty after trim, unique per user
    - `is_default`: Boolean

### 2.5 Delete Cookbook

- **HTTP Method:** DELETE
- **URL Structure:** `/api/cookbooks/:id`
- **Authentication:** Required (Supabase Auth JWT)
- **Parameters:**
  - **Required URL Parameters:**
    - `id`: Cookbook UUID (must be valid UUID v4 format)
- **Request Body:** None

---

## 3. Used Types

### 3.1 Existing DTOs (from `src/types.ts`)

```typescript
// Response types
interface CookbookDTO extends Tables<'cookbooks'> {
  recipe_count: number;
}

interface CookbookListResponseDTO {
  cookbooks: CookbookDTO[];
  total: number;
}

// Query parameters
interface CookbookListQueryParams {
  sort?: 'created_at' | 'updated_at' | 'title';
  order?: 'asc' | 'desc';
}

// Command models
type CreateCookbookCommand = Omit<
  TablesInsert<'cookbooks'>,
  'id' | 'created_at' | 'updated_at' | 'user_id'
>;

type UpdateCookbookCommand = Partial<
  Omit<TablesUpdate<'cookbooks'>, 'id' | 'created_at' | 'updated_at' | 'user_id'>
>;

// Error response
interface ErrorResponseDTO {
  error: string;
  message: string;
  fields?: string[];
  timestamp?: string;
  request_id?: string;
}
```

### 3.2 Zod Validation Schemas (to be created)

Create new file: `src/lib/validation/cookbook.validator.ts`

```typescript
import { z } from 'zod';

// Query parameter validation
export const CookbookListQuerySchema = z.object({
  sort: z.enum(['created_at', 'updated_at', 'title']).optional().default('created_at'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Create cookbook validation
export const CreateCookbookSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .transform(val => val.trim())
    .refine(val => val.length > 0, {
      message: 'Title must not be empty after trimming whitespace',
    }),
  is_default: z.boolean().optional().default(false),
});

// Update cookbook validation (partial)
export const UpdateCookbookSchema = z.object({
  title: z.string()
    .transform(val => val.trim())
    .refine(val => val.length > 0, {
      message: 'Title must not be empty after trimming whitespace',
    })
    .optional(),
  is_default: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// UUID parameter validation
export const UUIDParamSchema = z.string().uuid({
  message: 'Invalid cookbook ID format',
});
```

### 3.3 Service Layer (to be created)

Create new file: `src/lib/services/cookbook.service.ts`

```typescript
import type { SupabaseClient } from '../db/supabase.client';
import type { 
  CookbookDTO, 
  CookbookListQueryParams, 
  CreateCookbookCommand, 
  UpdateCookbookCommand 
} from '../../types';

export class CookbookService {
  constructor(private supabase: SupabaseClient) {}

  async listCookbooks(
    userId: string, 
    queryParams: CookbookListQueryParams
  ): Promise<{ cookbooks: CookbookDTO[]; total: number }>;

  async getCookbookById(
    cookbookId: string, 
    userId: string
  ): Promise<CookbookDTO | null>;

  async createCookbook(
    userId: string, 
    command: CreateCookbookCommand
  ): Promise<CookbookDTO>;

  async updateCookbook(
    cookbookId: string, 
    userId: string, 
    command: UpdateCookbookCommand
  ): Promise<CookbookDTO>;

  async deleteCookbook(
    cookbookId: string, 
    userId: string
  ): Promise<void>;
}
```

---

## 4. Response Details

### 4.1 List Cookbooks (GET /cookbooks)

**Success Response (200 OK):**
```json
{
  "cookbooks": [
    {
      "id": "a1b2c3d4-e5f6-4890-a1b2-c3d4e5f6a1b2",
      "user_id": "b2c3d4e5-f6a1-4b2c-3d4e-5f6a1b2c3d4e",
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

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

### 4.2 Get Cookbook (GET /cookbooks/:id)

**Success Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-4890-a1b2-c3d4e5f6a1b2",
  "user_id": "b2c3d4e5-f6a1-4b2c-3d4e-5f6a1b2c3d4e",
  "title": "My Cookbook",
  "is_default": true,
  "recipe_count": 15,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-03T10:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid UUID format
- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Cookbook does not exist or user lacks access
- `500 Internal Server Error`: Database error

### 4.3 Create Cookbook (POST /cookbooks)

**Success Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-4890-a1b2-c3d4e5f6a1b2",
  "user_id": "b2c3d4e5-f6a1-4b2c-3d4e-5f6a1b2c3d4e",
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
    "fields": ["title"],
    "timestamp": "2025-11-03T10:00:00Z"
  }
  ```
- `401 Unauthorized`: User not authenticated
- `409 Conflict`: Duplicate title or multiple default cookbooks
  ```json
  {
    "error": "duplicate_title",
    "message": "A cookbook with this title already exists",
    "timestamp": "2025-11-03T10:00:00Z"
  }
  ```
- `500 Internal Server Error`: Database error

### 4.4 Update Cookbook (PATCH /cookbooks/:id)

**Success Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-4890-a1b2-c3d4e5f6a1b2",
  "user_id": "b2c3d4e5-f6a1-4b2c-3d4e-5f6a1b2c3d4e",
  "title": "Updated Title",
  "is_default": true,
  "recipe_count": 15,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-03T10:15:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid UUID format or validation failure
- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Cookbook does not exist or user lacks access
- `409 Conflict`: Duplicate title or multiple default cookbooks
- `500 Internal Server Error`: Database error

### 4.5 Delete Cookbook (DELETE /cookbooks/:id)

**Success Response (204 No Content):**
Empty body

**Error Responses:**
- `400 Bad Request`: Invalid UUID format
- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Cookbook does not exist or user lacks access
- `500 Internal Server Error`: Database error

---

## 5. Data Flow

### 5.1 List Cookbooks Flow

```
Client Request (GET /cookbooks?sort=title&order=asc)
    ↓
API Endpoint (index.ts)
    ↓
1. Extract and validate query parameters using Zod
2. Get authenticated user from Supabase session (context.locals.supabase.auth.getUser())
3. If no user → return 401 Unauthorized
    ↓
CookbookService.listCookbooks(userId, queryParams)
    ↓
4. Query database:
   - SELECT cookbooks.*, COUNT(recipes.id) as recipe_count
   - FROM cookbooks
   - LEFT JOIN recipes ON recipes.cookbook_id = cookbooks.id
   - WHERE cookbooks.user_id = userId
   - GROUP BY cookbooks.id
   - ORDER BY {sort field} {order}
5. RLS policies automatically filter to user's cookbooks
    ↓
6. Return { cookbooks: CookbookDTO[], total: number }
    ↓
API Response (200 OK with CookbookListResponseDTO)
```

### 5.2 Get Cookbook Flow

```
Client Request (GET /cookbooks/:id)
    ↓
API Endpoint ([id].ts)
    ↓
1. Extract and validate UUID from URL params
2. If invalid UUID → return 400 Bad Request
3. Get authenticated user from Supabase session
4. If no user → return 401 Unauthorized
    ↓
CookbookService.getCookbookById(cookbookId, userId)
    ↓
5. Query database:
   - SELECT cookbooks.*, COUNT(recipes.id) as recipe_count
   - FROM cookbooks
   - LEFT JOIN recipes ON recipes.cookbook_id = cookbooks.id
   - WHERE cookbooks.id = cookbookId
   - AND cookbooks.user_id = userId (enforced by RLS)
   - GROUP BY cookbooks.id
6. If cookbook not found → return null
    ↓
7. If result is null → return 404 Not Found
8. Otherwise return CookbookDTO
    ↓
API Response (200 OK with CookbookDTO)
```

### 5.3 Create Cookbook Flow

```
Client Request (POST /cookbooks with body)
    ↓
API Endpoint (index.ts)
    ↓
1. Parse and validate request body using Zod
2. If validation fails → return 400 Bad Request with field errors
3. Get authenticated user from Supabase session
4. If no user → return 401 Unauthorized
    ↓
CookbookService.createCookbook(userId, command)
    ↓
5. Insert into database:
   - INSERT INTO cookbooks (user_id, title, is_default)
   - VALUES (userId, command.title, command.is_default)
   - RETURNING *
6. Database enforces constraints:
   - UNIQUE (user_id, title) - prevents duplicate titles
   - Partial unique index on (user_id) WHERE is_default = true
7. If duplicate title → PostgreSQL error 23505
8. If multiple defaults → PostgreSQL error 23505
    ↓
9. Catch constraint violations:
   - If error code 23505 and constraint contains 'title' → return 409 Conflict (duplicate_title)
   - If error code 23505 and constraint contains 'default' → return 409 Conflict (multiple_defaults)
10. Query recipe count (will be 0 for new cookbook)
11. Return CookbookDTO
    ↓
API Response (201 Created with CookbookDTO)
```

### 5.4 Update Cookbook Flow

```
Client Request (PATCH /cookbooks/:id with body)
    ↓
API Endpoint ([id].ts)
    ↓
1. Extract and validate UUID from URL params
2. If invalid UUID → return 400 Bad Request
3. Parse and validate request body using Zod
4. If validation fails → return 400 Bad Request with field errors
5. Get authenticated user from Supabase session
6. If no user → return 401 Unauthorized
    ↓
CookbookService.updateCookbook(cookbookId, userId, command)
    ↓
7. Update database:
   - UPDATE cookbooks
   - SET title = COALESCE(command.title, title),
        is_default = COALESCE(command.is_default, is_default),
        updated_at = now()
   - WHERE id = cookbookId
   - AND user_id = userId (enforced by RLS)
   - RETURNING *
8. Database enforces same constraints as create
9. If no rows affected → cookbook not found or not owned by user
    ↓
10. If update returned no rows → return 404 Not Found
11. Catch constraint violations (same as create)
12. Query recipe count
13. Return CookbookDTO
    ↓
API Response (200 OK with CookbookDTO)
```

### 5.5 Delete Cookbook Flow

```
Client Request (DELETE /cookbooks/:id)
    ↓
API Endpoint ([id].ts)
    ↓
1. Extract and validate UUID from URL params
2. If invalid UUID → return 400 Bad Request
3. Get authenticated user from Supabase session
4. If no user → return 401 Unauthorized
    ↓
CookbookService.deleteCookbook(cookbookId, userId)
    ↓
5. Delete from database:
   - DELETE FROM cookbooks
   - WHERE id = cookbookId
   - AND user_id = userId (enforced by RLS)
   - RETURNING id
6. Database CASCADE deletes:
   - All recipes in cookbook (ON DELETE CASCADE)
   - All recipe_ingredients for those recipes (ON DELETE CASCADE)
   - All recipe_tags for those recipes (ON DELETE CASCADE)
7. If no rows affected → cookbook not found or not owned by user
    ↓
8. If delete returned no rows → return 404 Not Found
9. Otherwise return success
    ↓
API Response (204 No Content)
```

---

## 6. Security Considerations

### 6.1 Authentication & Authorization

**Authentication:**
- All endpoints require valid Supabase Auth JWT token
- Extract user from session: `const { data: { user }, error } = await supabase.auth.getUser()`
- If `user` is null or error exists → return 401 Unauthorized
- Use `user.id` as `userId` for all service layer calls

**Authorization:**
- Supabase RLS (Row Level Security) policies automatically filter cookbooks by `user_id`
- Service layer explicitly checks `user_id` in WHERE clauses
- Double protection: RLS + application-level checks
- Users can only see/modify their own cookbooks

**Implementation Pattern:**
```typescript
// In each endpoint handler
const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();

if (authError || !user) {
  return createErrorResponse(401, 'unauthorized', 'Authentication required');
}

const userId = user.id;
```

### 6.2 Input Validation

**UUID Validation:**
- Validate all URL parameters containing UUIDs using `isValidUUID()` utility
- Prevents SQL injection attempts via malformed IDs
- Returns 400 Bad Request with clear error message

**Request Body Validation:**
- Use Zod schemas to validate all request bodies
- Automatically trim whitespace from strings
- Enforce type safety (string, boolean, etc.)
- Return 400 Bad Request with specific field errors

**Query Parameter Validation:**
- Validate sort/order values against allowed enums
- Use default values for missing parameters
- Prevent SQL injection via invalid sort fields

### 6.3 Data Sanitization

**Title Field:**
- Trim whitespace on input (handled by Zod transform)
- Store raw value in database (no HTML escaping)
- Frontend responsible for XSS prevention on display
- Database stores trusted data, UI layer handles untrusted rendering

**Protected Fields:**
- Command types explicitly omit `id`, `user_id`, `created_at`, `updated_at`
- Prevents mass assignment attacks
- TypeScript ensures these fields cannot be set by client

### 6.4 Database Constraints

**Uniqueness Enforcement:**
- `UNIQUE (user_id, title)` constraint prevents duplicate cookbook names per user
- Partial unique index `idx_cookbooks_user_default` enforces single default per user
- Database-level enforcement provides strong guarantee

**Cascade Deletions:**
- `ON DELETE CASCADE` on recipes → cookbook deletion removes all recipes
- Prevents orphaned data
- Transaction ensures atomicity

### 6.5 Rate Limiting

**Not implemented in MVP but should consider:**
- Implement rate limiting per user/IP for create/update/delete operations
- Prevents abuse and resource exhaustion
- Can use Supabase Edge Functions rate limiting or application-level middleware

### 6.6 Error Information Disclosure

**Safe Error Messages:**
- Never expose internal database errors to client
- Generic messages like "An unexpected error occurred"
- Include `request_id` for debugging (server-side logging)
- Specific field errors only for validation (400 responses)

**Example:**
```typescript
try {
  // database operation
} catch (error) {
  console.error('[Cookbook API] Database error:', error);
  const requestId = crypto.randomUUID();
  return createInternalErrorResponse(requestId);
}
```

---

## 7. Error Handling

### 7.1 Error Response Format

All errors follow the standardized `ErrorResponseDTO` format:

```typescript
interface ErrorResponseDTO {
  error: string;         // Machine-readable error code
  message: string;       // Human-readable error message
  fields?: string[];     // Optional array of problematic field names
  timestamp?: string;    // ISO 8601 timestamp
  request_id?: string;   // Unique ID for server error tracking
}
```

### 7.2 Error Categories & Status Codes

**400 Bad Request - Client Input Errors**

| Scenario | Error Code | Message | Fields |
|----------|------------|---------|--------|
| Invalid UUID format | `invalid_uuid` | "Invalid cookbook ID format" | `["id"]` |
| Invalid query params | `invalid_query_params` | "Invalid sort or order parameter" | `["sort"]` or `["order"]` |
| Missing title | `validation_error` | "Title is required" | `["title"]` |
| Empty title after trim | `validation_error` | "Title must not be empty after trimming whitespace" | `["title"]` |
| Invalid is_default type | `validation_error` | "is_default must be a boolean" | `["is_default"]` |
| No fields to update | `validation_error` | "At least one field must be provided for update" | `[]` |

**401 Unauthorized - Authentication Errors**

| Scenario | Error Code | Message |
|----------|------------|---------|
| Missing/invalid JWT | `unauthorized` | "Authentication required" |
| Expired session | `unauthorized` | "Authentication required" |

**404 Not Found - Resource Errors**

| Scenario | Error Code | Message |
|----------|------------|---------|
| Cookbook doesn't exist | `not_found` | "Cookbook not found" |
| User doesn't own cookbook | `not_found` | "Cookbook not found" |

**409 Conflict - Business Rule Violations**

| Scenario | Error Code | Message |
|----------|------------|---------|
| Duplicate title (create) | `duplicate_title` | "A cookbook with this title already exists" |
| Duplicate title (update) | `duplicate_title` | "A cookbook with this title already exists" |
| Multiple defaults (create) | `multiple_defaults` | "You already have a default cookbook" |
| Multiple defaults (update) | `multiple_defaults` | "You already have a default cookbook" |

**500 Internal Server Error - Server Errors**

| Scenario | Error Code | Message |
|----------|------------|---------|
| Database connection failure | `internal_server_error` | "An unexpected error occurred. Please try again later." |
| Unexpected database error | `internal_server_error` | "An unexpected error occurred. Please try again later." |
| Supabase client error | `internal_server_error` | "An unexpected error occurred. Please try again later." |

### 7.3 Error Detection & Handling

**PostgreSQL Error Codes:**

```typescript
// In service layer
try {
  await supabase.from('cookbooks').insert(data);
} catch (error: any) {
  // Unique constraint violation
  if (error.code === '23505') {
    // Check which constraint was violated
    if (error.constraint?.includes('title')) {
      throw new ConflictError('duplicate_title', 'A cookbook with this title already exists');
    }
    if (error.constraint?.includes('default')) {
      throw new ConflictError('multiple_defaults', 'You already have a default cookbook');
    }
  }
  // Rethrow as internal error
  throw error;
}
```

**Supabase Response Patterns:**

```typescript
// Empty result = not found
const { data, error } = await supabase
  .from('cookbooks')
  .select('*')
  .eq('id', cookbookId)
  .single();

if (error || !data) {
  throw new NotFoundError('not_found', 'Cookbook not found');
}
```

### 7.4 Error Handling Implementation Pattern

**Endpoint Layer (Astro API routes):**

```typescript
export const GET: APIRoute = async (context) => {
  try {
    // 1. Authentication check
    const { data: { user }, error: authError } = 
      await context.locals.supabase.auth.getUser();
    
    if (authError || !user) {
      return createErrorResponse(401, 'unauthorized', 'Authentication required');
    }

    // 2. Input validation
    const cookbookId = context.params.id;
    if (!cookbookId || !isValidUUID(cookbookId)) {
      return createErrorResponse(400, 'invalid_uuid', 'Invalid cookbook ID format', ['id']);
    }

    // 3. Service layer call
    const cookbookService = new CookbookService(context.locals.supabase);
    const cookbook = await cookbookService.getCookbookById(cookbookId, user.id);

    // 4. Not found check
    if (!cookbook) {
      return createErrorResponse(404, 'not_found', 'Cookbook not found');
    }

    // 5. Success response
    return new Response(JSON.stringify(cookbook), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 6. Handle known errors
    if (error instanceof ConflictError) {
      return createErrorResponse(409, error.code, error.message);
    }
    
    // 7. Log and return generic error
    console.error('[Cookbook API] Unexpected error:', error);
    const requestId = crypto.randomUUID();
    return createInternalErrorResponse(requestId);
  }
};
```

**Service Layer:**

```typescript
export class CookbookService {
  async getCookbookById(cookbookId: string, userId: string): Promise<CookbookDTO | null> {
    try {
      const { data, error } = await this.supabase
        .from('cookbooks')
        .select(`
          *,
          recipes(count)
        `)
        .eq('id', cookbookId)
        .eq('user_id', userId) // Explicit ownership check
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // PostgREST "not found" code
          return null;
        }
        throw error;
      }

      return {
        ...data,
        recipe_count: data.recipes?.[0]?.count ?? 0,
      };
    } catch (error) {
      console.error('[CookbookService] Error fetching cookbook:', error);
      throw error;
    }
  }
}
```

### 7.5 Custom Error Classes

Create file: `src/lib/utils/errors.ts`

```typescript
export class ConflictError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(public code: string, message: string, public fields: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

---

## 8. Performance Considerations

### 8.1 Database Query Optimization

**Indexes in Use:**
- `idx_cookbooks_user_id` on `cookbooks(user_id)` - Fast user cookbook lookups
- `idx_cookbooks_user_default` on `cookbooks(user_id) WHERE is_default = true` - Enforce uniqueness
- `idx_recipes_cookbook_id` on `recipes(cookbook_id)` - Fast recipe count aggregation

**Query Patterns:**

**List Cookbooks:**
```sql
-- Optimized with indexes
SELECT 
  cookbooks.*,
  COUNT(recipes.id) as recipe_count
FROM cookbooks
LEFT JOIN recipes ON recipes.cookbook_id = cookbooks.id
WHERE cookbooks.user_id = $1
GROUP BY cookbooks.id
ORDER BY cookbooks.created_at DESC;

-- Expected performance: <50ms for typical user (≤100 cookbooks)
```

**Get Single Cookbook:**
```sql
-- Uses primary key + user_id index
SELECT 
  cookbooks.*,
  COUNT(recipes.id) as recipe_count
FROM cookbooks
LEFT JOIN recipes ON recipes.cookbook_id = cookbooks.id
WHERE cookbooks.id = $1 AND cookbooks.user_id = $2
GROUP BY cookbooks.id;

-- Expected performance: <10ms
```

### 8.2 N+1 Query Prevention

**Current Implementation:**
- Recipe count computed in single query with LEFT JOIN
- No separate query per cookbook
- Aggregate function (COUNT) handles grouping efficiently

**Alternative (if performance degrades with many recipes):**
- Consider materialized view for cookbook stats
- Update trigger on recipes table to maintain count
- Cache recipe counts in Redis (post-MVP)

### 8.3 Caching Strategy

**MVP (No Caching):**
- Direct database queries for all operations
- Supabase handles connection pooling
- PostgreSQL query cache handles repeated queries

**Future Enhancement:**
- Cache cookbook lists in Redis (key: `user:{userId}:cookbooks`)
- Invalidate on create/update/delete
- TTL: 5-10 minutes
- Implement cache-aside pattern

### 8.4 Pagination

**List Cookbooks (MVP):**
- No pagination required initially
- Assumption: Users have <100 cookbooks
- Returns all cookbooks in single response

**Future Enhancement:**
- Add `page` and `limit` query parameters
- Implement cursor-based pagination for better performance
- Default limit: 20 cookbooks per page
- Include pagination metadata in response

```typescript
// Future pagination support
interface CookbookListQueryParams {
  sort?: 'created_at' | 'updated_at' | 'title';
  order?: 'asc' | 'desc';
  page?: number;    // Future
  limit?: number;   // Future
}
```

### 8.5 Response Size Optimization

**Current Response:**
- Each cookbook includes all fields (id, user_id, title, is_default, timestamps)
- Recipe count computed but lightweight (single integer)
- Typical response size: ~500 bytes per cookbook

**Optimization Opportunities:**
- Consider field selection if mobile bandwidth is concern
- GZIP compression (handled by Astro/web server)
- Omit `user_id` from client responses (redundant, always current user)

### 8.6 Database Connection Management

**Supabase Client:**
- Connection pooling handled automatically
- Persistent connections reused across requests
- No manual connection management needed

**Best Practices:**
- Use single Supabase client instance (from context.locals)
- Avoid creating new clients per request
- Let Supabase handle connection lifecycle

### 8.7 Monitoring & Performance Metrics

**Key Metrics to Track:**
- Average response time per endpoint
- Database query duration
- Error rate by endpoint
- Request volume per user

**Tools:**
- Supabase Dashboard: Query performance insights
- Astro DevTools: Request timing
- Future: Application Performance Monitoring (APM) tool

---

## 9. Implementation Steps

### Step 1: Create Validation Schemas

**File:** `src/lib/validation/cookbook.validator.ts`

**Tasks:**
1. Create `CookbookListQuerySchema` with enum validation for sort/order
2. Create `CreateCookbookSchema` with title trimming and non-empty validation
3. Create `UpdateCookbookSchema` with partial validation and at-least-one-field check
4. Create `UUIDParamSchema` for URL parameter validation
5. Export all schemas

**Dependencies:** `zod` package

**Testing:**
- Verify schema accepts valid inputs
- Verify schema rejects invalid inputs
- Test edge cases (empty strings, whitespace-only, special characters)

---

### Step 2: Create Custom Error Classes

**File:** `src/lib/utils/errors.ts`

**Tasks:**
1. Create `ConflictError` class extending Error
2. Create `NotFoundError` class extending Error
3. Create `ValidationError` class extending Error
4. Each error should store error code and relevant metadata

**Dependencies:** None (native Error class)

**Testing:**
- Verify errors can be constructed with correct properties
- Verify errors can be caught and inspected

---

### Step 3: Create Cookbook Service

**File:** `src/lib/services/cookbook.service.ts`

**Tasks:**
1. Create `CookbookService` class with Supabase client dependency injection
2. Implement `listCookbooks(userId, queryParams)` method:
   - Build query with dynamic sort/order
   - LEFT JOIN recipes for count
   - Filter by user_id
   - Return typed result
3. Implement `getCookbookById(cookbookId, userId)` method:
   - Query single cookbook with recipe count
   - Explicit user_id check
   - Return null if not found
4. Implement `createCookbook(userId, command)` method:
   - Insert new cookbook
   - Handle constraint violations
   - Throw ConflictError for duplicates
5. Implement `updateCookbook(cookbookId, userId, command)` method:
   - Update with partial data
   - Check affected rows
   - Throw NotFoundError if no rows updated
   - Handle constraint violations
6. Implement `deleteCookbook(cookbookId, userId)` method:
   - Delete cookbook
   - Check affected rows
   - Throw NotFoundError if no rows deleted

**Dependencies:** 
- `src/db/supabase.client.ts`
- `src/types.ts`
- `src/lib/utils/errors.ts`

**Testing:**
- Unit tests with mocked Supabase client
- Integration tests with test database
- Verify RLS policies are applied
- Test constraint violations

---

### Step 4: Create GET /cookbooks Endpoint

**File:** `src/pages/api/cookbooks/index.ts`

**Tasks:**
1. Add `export const prerender = false` for dynamic rendering
2. Implement `GET` handler:
   - Extract query parameters
   - Validate with `CookbookListQuerySchema`
   - Get authenticated user
   - Check authentication (return 401 if not authenticated)
   - Call `CookbookService.listCookbooks()`
   - Format response as `CookbookListResponseDTO`
   - Return 200 OK

**Dependencies:**
- `src/lib/services/cookbook.service.ts`
- `src/lib/validation/cookbook.validator.ts`
- `src/lib/utils/error-response.ts`

**Testing:**
- Test with valid query parameters
- Test with invalid query parameters
- Test without authentication
- Test with authenticated user
- Verify sorting works correctly

---

### Step 5: Create POST /cookbooks Endpoint

**File:** `src/pages/api/cookbooks/index.ts` (same file as GET)

**Tasks:**
1. Implement `POST` handler:
   - Parse request body as JSON
   - Validate with `CreateCookbookSchema`
   - Get authenticated user
   - Check authentication (return 401 if not authenticated)
   - Call `CookbookService.createCookbook()`
   - Handle ConflictError (return 409)
   - Return 201 Created with Location header

**Dependencies:**
- Same as Step 4

**Testing:**
- Test with valid cookbook data
- Test with missing title
- Test with empty/whitespace title
- Test duplicate title for same user
- Test multiple default cookbooks
- Test without authentication

---

### Step 6: Create GET /cookbooks/:id Endpoint

**File:** `src/pages/api/cookbooks/[id].ts`

**Tasks:**
1. Add `export const prerender = false`
2. Implement `GET` handler:
   - Extract `id` from URL params
   - Validate UUID format
   - Get authenticated user
   - Check authentication (return 401 if not authenticated)
   - Call `CookbookService.getCookbookById()`
   - Return 404 if cookbook not found
   - Return 200 OK with cookbook data

**Dependencies:**
- `src/lib/services/cookbook.service.ts`
- `src/lib/validation/uuid.validator.ts`
- `src/lib/utils/error-response.ts`

**Testing:**
- Test with valid cookbook ID (owned by user)
- Test with invalid UUID format
- Test with non-existent cookbook ID
- Test with cookbook owned by another user
- Test without authentication

---

### Step 7: Create PATCH /cookbooks/:id Endpoint

**File:** `src/pages/api/cookbooks/[id].ts` (same file as GET)

**Tasks:**
1. Implement `PATCH` handler:
   - Extract `id` from URL params
   - Validate UUID format
   - Parse request body as JSON
   - Validate with `UpdateCookbookSchema`
   - Get authenticated user
   - Check authentication (return 401 if not authenticated)
   - Call `CookbookService.updateCookbook()`
   - Handle NotFoundError (return 404)
   - Handle ConflictError (return 409)
   - Return 200 OK with updated cookbook

**Dependencies:**
- Same as Step 6

**Testing:**
- Test with valid partial updates (title only, is_default only, both)
- Test with empty request body
- Test with invalid UUID
- Test with non-existent cookbook
- Test with cookbook owned by another user
- Test duplicate title update
- Test multiple defaults conflict
- Test without authentication

---

### Step 8: Create DELETE /cookbooks/:id Endpoint

**File:** `src/pages/api/cookbooks/[id].ts` (same file as GET/PATCH)

**Tasks:**
1. Implement `DELETE` handler:
   - Extract `id` from URL params
   - Validate UUID format
   - Get authenticated user
   - Check authentication (return 401 if not authenticated)
   - Call `CookbookService.deleteCookbook()`
   - Handle NotFoundError (return 404)
   - Return 204 No Content

**Dependencies:**
- Same as Step 6

**Testing:**
- Test with valid cookbook ID (owned by user)
- Test with invalid UUID
- Test with non-existent cookbook
- Test with cookbook owned by another user
- Test without authentication
- Verify cascade deletion of recipes

---

### Step 9: Integration Testing

**Tasks:**
1. Create end-to-end test suite for cookbook API
2. Test complete workflows:
   - Create → List → Get → Update → Delete
   - Multiple cookbooks for same user
   - Default cookbook switching
3. Test error scenarios:
   - Unauthorized access attempts
   - Invalid data inputs
   - Constraint violations
4. Test edge cases:
   - Unicode characters in titles
   - Very long titles
   - Concurrent requests
5. Verify RLS policies work correctly
6. Test cascade deletions

**Dependencies:**
- Test framework (Vitest recommended)
- Supabase test client
- Mock authentication

---

### Step 10: Documentation & Code Review

**Tasks:**
1. Add JSDoc comments to all service methods
2. Add inline comments for complex logic
3. Update API documentation with examples
4. Create Postman/Insomnia collection for manual testing
5. Document error scenarios and status codes
6. Code review checklist:
   - Authentication checks in all endpoints
   - Input validation before service calls
   - Proper error handling and logging
   - TypeScript types used correctly
   - No SQL injection vulnerabilities
   - Consistent error response format
7. Performance review:
   - Check query execution plans
   - Verify indexes are used
   - Monitor response times

---

### Step 11: Deployment Preparation

**Tasks:**
1. Verify environment variables are set:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
2. Test with production-like Supabase instance
3. Run database migrations if needed
4. Verify RLS policies are enabled in production
5. Set up monitoring and alerting:
   - Error rate alerts
   - Slow query alerts
   - High request volume alerts
6. Prepare rollback plan
7. Document deployment steps
8. Smoke test after deployment

---

## 10. Summary & Next Steps

### Implementation Checklist

- [ ] Create validation schemas (Step 1)
- [ ] Create custom error classes (Step 2)
- [ ] Implement CookbookService (Step 3)
- [ ] Implement GET /cookbooks (Step 4)
- [ ] Implement POST /cookbooks (Step 5)
- [ ] Implement GET /cookbooks/:id (Step 6)
- [ ] Implement PATCH /cookbooks/:id (Step 7)
- [ ] Implement DELETE /cookbooks/:id (Step 8)
- [ ] Run integration tests (Step 9)
- [ ] Complete documentation (Step 10)
- [ ] Deploy to production (Step 11)

### Post-MVP Enhancements

1. **Pagination:** Add cursor-based pagination for cookbook lists
2. **Caching:** Implement Redis caching for frequently accessed cookbooks
3. **Batch Operations:** Support batch create/update/delete
4. **Soft Deletes:** Add `deleted_at` timestamp instead of hard deletes
5. **Audit Log:** Track all cookbook modifications
6. **Search:** Full-text search across cookbook titles
7. **Export/Import:** Export cookbooks as JSON, import from file
8. **Sharing:** Share cookbooks with other users (new permissions model)

### Dependencies for Other Features

**Recipe Endpoints** depend on:
- Cookbook endpoints must be implemented first
- Recipe creation requires valid `cookbook_id`
- Recipe lists can filter by `cookbook_id`



### Success Criteria

Implementation is complete when:
- ✅ All 5 endpoints return correct responses
- ✅ All error scenarios handled properly
- ✅ Authentication enforced on all endpoints
- ✅ RLS policies prevent unauthorized access
- ✅ Constraints prevent data integrity violations
- ✅ Integration tests pass 100%
- ✅ Response times <100ms for typical operations
- ✅ No SQL injection vulnerabilities
- ✅ Documentation complete and accurate

---

**End of Implementation Plan**
