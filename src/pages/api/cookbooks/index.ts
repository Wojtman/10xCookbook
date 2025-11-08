import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { CookbookService } from '../../../lib/services/cookbook.service';
import { 
  CookbookListQuerySchema,
  CreateCookbookSchema,
} from '../../../lib/validation/cookbook.validator';
import { buildErrorResponse } from '../../../lib/utils/error-response';

export const prerender = false;

/**
 * GET /api/cookbooks
 * List all cookbooks for the authenticated user with optional sorting
 * 
 * Query Parameters:
 * - sort: 'created_at' | 'updated_at' | 'title' (default: 'created_at')
 * - order: 'asc' | 'desc' (default: 'desc')
 * 
 * Requires authentication via Supabase Auth
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // 1. Get authenticated user from Supabase session
    const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

    console.log('Authenticated user:', user);
    console.log('Authenticated error:', authError);
    if (authError || !user) {
      return new Response(
        JSON.stringify(buildErrorResponse('unauthorized', 'Authentication required')),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Extract and validate query parameters
    const queryParams = {
      sort: url.searchParams.get('sort') || undefined,
      order: url.searchParams.get('order') || undefined,
    };

    let validatedParams;
    try {
      validatedParams = CookbookListQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(buildErrorResponse(
            'validation_error',
            'Invalid query parameters',
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

    // 3. Get cookbooks from database via service layer
    const cookbookService = new CookbookService(locals.supabase);
    const result = await cookbookService.listCookbooks(user.id, validatedParams);

    // 4. Return successful response
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error listing cookbooks:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(
        'internal_error',
        'An unexpected error occurred while listing cookbooks'
      )),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * POST /api/cookbooks
 * Create a new cookbook for the authenticated user
 * 
 * Request Body:
 * {
 *   "title": string (required, 1-100 characters),
 *   "is_default": boolean (optional, default: false)
 * }
 * 
 * Requires authentication via Supabase Auth
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Get authenticated user from Supabase session
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

    // 2. Parse and validate request body
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
      validatedCommand = CreateCookbookSchema.parse(body);
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

    // 3. Create cookbook via service layer
    const cookbookService = new CookbookService(locals.supabase);
    
    try {
      const newCookbook = await cookbookService.createCookbook(user.id, validatedCommand);

      // 4. Return successful response with 201 Created
      return new Response(
        JSON.stringify(newCookbook),
        {
          status: 201,
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
    console.error('Error creating cookbook:', error);
    return new Response(
      JSON.stringify(buildErrorResponse(
        'internal_error',
        'An unexpected error occurred while creating the cookbook'
      )),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
