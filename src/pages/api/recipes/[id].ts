import type { APIContext, APIRoute } from "astro";
import { ZodError } from "zod";

import { RecipeService } from "../../../lib/services/recipe.service";
import { buildErrorResponse } from "../../../lib/utils/error-response";
import { UUIDParamSchema, UpdateRecipeSchema } from "../../../lib/validation/recipe.validator";

export const prerender = false;

type LocalsType = APIContext["locals"];

interface AuthenticatedUser {
  id: string;
}

type AuthResult = { user: AuthenticatedUser } | { response: Response };

async function requireAuthenticatedUser(locals: LocalsType): Promise<AuthResult> {
  const {
    data: { user },
    error,
  } = await locals.supabase.auth.getUser();

  if (error || !user) {
    return {
      response: new Response(JSON.stringify(buildErrorResponse("unauthorized", "Authentication required")), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    } as const;
  }

  return { user: { id: user.id } };
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    let recipeId: string;
    try {
      recipeId = UUIDParamSchema.parse(params.id);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(JSON.stringify(buildErrorResponse("invalid_id", "Invalid recipe ID format", ["id"])), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    const authResult = await requireAuthenticatedUser(locals);
    if ("response" in authResult) {
      return authResult.response;
    }

    const recipeService = new RecipeService(locals.supabase);
    const recipe = await recipeService.getRecipeById(recipeId, authResult.user.id);

    if (!recipe) {
      return new Response(
        JSON.stringify(buildErrorResponse("not_found", "Recipe not found or you do not have access to it")),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(recipe), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error retrieving recipe: ", error);
    return new Response(
      JSON.stringify(buildErrorResponse("internal_error", "An unexpected error occurred while retrieving the recipe")),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    let recipeId: string;
    try {
      recipeId = UUIDParamSchema.parse(params.id);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(JSON.stringify(buildErrorResponse("invalid_id", "Invalid recipe ID format", ["id"])), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    const authResult = await requireAuthenticatedUser(locals);
    if ("response" in authResult) {
      return authResult.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify(buildErrorResponse("invalid_json", "Invalid JSON in request body")), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let validatedCommand;
    try {
      validatedCommand = UpdateRecipeSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(
          JSON.stringify(
            buildErrorResponse(
              "validation_error",
              "Invalid request body",
              error.errors.map((issue) => issue.path.join("."))
            )
          ),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    const recipeService = new RecipeService(locals.supabase);

    try {
      const updatedRecipe = await recipeService.updateRecipe(recipeId, authResult.user.id, validatedCommand);

      return new Response(JSON.stringify(updatedRecipe), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Recipe not found or access denied") {
          return new Response(
            JSON.stringify(buildErrorResponse("not_found", "Recipe not found or you do not have access to it")),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (error.message.startsWith("One or more")) {
          return new Response(JSON.stringify(buildErrorResponse("validation_error", error.message)), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      throw error;
    }
  } catch (error) {
    console.error("Error updating recipe: ", error);
    return new Response(
      JSON.stringify(buildErrorResponse("internal_error", "An unexpected error occurred while updating the recipe")),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    let recipeId: string;
    try {
      recipeId = UUIDParamSchema.parse(params.id);
    } catch (error) {
      if (error instanceof ZodError) {
        return new Response(JSON.stringify(buildErrorResponse("invalid_id", "Invalid recipe ID format", ["id"])), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    const authResult = await requireAuthenticatedUser(locals);
    if ("response" in authResult) {
      return authResult.response;
    }

    const recipeService = new RecipeService(locals.supabase);

    try {
      await recipeService.deleteRecipe(recipeId, authResult.user.id);

      return new Response(null, {
        status: 204,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Recipe not found or access denied") {
        return new Response(
          JSON.stringify(buildErrorResponse("not_found", "Recipe not found or you do not have access to it")),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Error deleting recipe: ", error);
    return new Response(
      JSON.stringify(buildErrorResponse("internal_error", "An unexpected error occurred while deleting the recipe")),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
