import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { CookbookService } from '../../../lib/services/cookbook.service';
import { 
  UUIDParamSchema,
  UpdateCookbookSchema,
} from '../../../lib/validation/cookbook.validator';
import { buildErrorResponse } from '../../../lib/utils/error-response';

export const prerender = false;

/**
 * GET /api/cookbooks/:id
 * Retrieve a single cookbook by ID with recipe count
 * 
 * URL Parameters:
 * - id: UUID of the cookbook
 * 
 * Requires authentication via Supabase Auth
 * Returns 404 if cookbook not found or user lacks access
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Extract and validate UUID from URL params
    const cookbookId = params.id;
    
    try {
      UUIDParamSchema.parse(cookbookId);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'invalid_id',
            'Invalid cookbook ID format',
            ['id']
          )),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

    // 2. Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify(buildErrorResponse('unauthorized', 'Authentication required')),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Get cookbook from database via service layer
    const cookbookService = new CookbookService(locals.supabase);
    const cookbook = await cookbookService.getCookbookById(cookbookId!, user.id);

    // 4. If cookbook not found, return 404
    if (!cookbook) {
      return new Response(
        JSON.stringify(buildErrorResponse(
          'not_found',
          'Cookbook not found or you do not have access to it'
        )),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Return successful response
    return new Response(
      JSON.stringify(cookbook),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error getting cookbook:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(
        'internal_error',
        'An unexpected error occurred while retrieving the cookbook'
      )),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * PATCH /api/cookbooks/:id
 * Update an existing cookbook (partial update supported)
 * 
 * URL Parameters:
 * - id: UUID of the cookbook
 * 
 * Request Body (all fields optional, at least one required):
 * {
 *   "title": string (1-100 characters),
 *   "is_default": boolean
 * }
 * 
 * Requires authentication via Supabase Auth
 * Returns 404 if cookbook not found or user lacks access
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Extract and validate UUID from URL params
    const cookbookId = params.id;
    
    try {
      UUIDParamSchema.parse(cookbookId);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'invalid_id',
            'Invalid cookbook ID format',
            ['id']
          )),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

    // 2. Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify(buildErrorResponse('unauthorized', 'Authentication required')),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify(buildErrorResponse('invalid_json', 'Invalid JSON in request body')),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let validatedCommand;
    try {
      validatedCommand = UpdateCookbookSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'validation_error',
            'Invalid request body',
            error.errors.map(e => e.path.join('.'))
          )),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

    // 4. Update cookbook via service layer
    const cookbookService = new CookbookService(locals.supabase);
    
    try {
      const updatedCookbook = await cookbookService.updateCookbook(
        cookbookId!,
        user.id,
        validatedCommand
      );

      // 5. If cookbook not found, return 404
      if (!updatedCookbook) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'not_found',
            'Cookbook not found or you do not have access to it'
          )),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 6. Return successful response
      return new Response(
        JSON.stringify(updatedCookbook),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      // Handle business logic errors (constraint violations)
      if (error instanceof Error) {
        if (error.message === 'DUPLICATE_TITLE') {
          return new Response(
            JSON.stringify(buildErrorResponse(
              'duplicate_title',
              'A cookbook with this title already exists',
              ['title']
            )),
            { 
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        if (error.message === 'MULTIPLE_DEFAULTS') {
          return new Response(
            JSON.stringify(buildErrorResponse(
              'multiple_defaults',
              'You already have a default cookbook. Please unset the existing default first.',
              ['is_default']
            )),
            { 
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }
      throw error;
    }

  } catch (error) {
    console.error('Error updating cookbook:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(
        'internal_error',
        'An unexpected error occurred while updating the cookbook'
      )),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * DELETE /api/cookbooks/:id
 * Delete a cookbook and all its recipes (cascade delete)
 * 
 * URL Parameters:
 * - id: UUID of the cookbook
 * 
 * Requires authentication via Supabase Auth
 * Returns 204 No Content on success
 * Returns 404 if cookbook not found or user lacks access
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Extract and validate UUID from URL params
    const cookbookId = params.id;
    
    try {
      UUIDParamSchema.parse(cookbookId);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'invalid_id',
            'Invalid cookbook ID format',
            ['id']
          )),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

    // 2. Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify(buildErrorResponse('unauthorized', 'Authentication required')),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Delete cookbook via service layer
    const cookbookService = new CookbookService(locals.supabase);
    const wasDeleted = await cookbookService.deleteCookbook(cookbookId!, user.id);

    // 4. If cookbook not found, return 404
    if (!wasDeleted) {
      return new Response(
        JSON.stringify(buildErrorResponse(
          'not_found',
          'Cookbook not found or you do not have access to it'
        )),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. Return successful response (204 No Content)
    return new Response(null, {
      status: 204,
    });

  } catch (error) {
    console.error('Error deleting cookbook:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(
        'internal_error',
        'An unexpected error occurred while deleting the cookbook'
      )),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
