import type { APIRoute } from "astro";
import { ZodError, z } from "zod";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerInstance } from "../../../db/supabase.client";
import type { Database } from "../../../db/database.types";
import { CookbookService } from "../../../lib/services/cookbook.service";

const registerRequestSchema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const payload = await request.json();
    const { email, password } = registerRequestSchema.parse(payload);

    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildEmailRedirectUrl(request.headers.get("origin")),
      },
    });

    if (error) {
      return buildJsonResponse({ error: error.message }, 400);
    }

    const userId = data.user?.id;

    if (userId) {
      try {
        const serviceClient = createServiceRoleClient();
        const cookbookService = new CookbookService(serviceClient ?? supabase);
        await cookbookService.ensureDefaultCookbook(userId);
      } catch (cookbookError) {
        const message = cookbookError instanceof Error ? cookbookError.message : "Failed to create default cookbook";
        return buildJsonResponse({ error: message }, 500);
      }
    }

    return buildJsonResponse(
      {
        user: data.user,
        message: "Check your email for a confirmation link to activate your account.",
      },
      200
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const [{ message }] = error.issues;
      return buildJsonResponse({ error: message }, 400);
    }

    return buildJsonResponse({ error: "Unable to complete registration" }, 500);
  }
};

export const ALL: APIRoute = async () => buildJsonResponse({ error: "Method Not Allowed" }, 405);

function buildJsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function buildEmailRedirectUrl(origin: string | null): string | undefined {
  if (!origin) {
    return undefined;
  }

  try {
    const url = new URL(origin);
    url.pathname = "/auth/login";
    return url.toString();
  } catch {
    return undefined;
  }
}

function createServiceRoleClient(): SupabaseClient<Database> | null {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
  const serviceUrl =
    import.meta.env.SUPABASE_URL ??
    import.meta.env.PRIVATE_SUPABASE_URL ??
    import.meta.env.PUBLIC_SUPABASE_URL ??
    import.meta.env.PUBLIC_SUPABASE_DB_URL ??
    null;

  return !serviceRoleKey || !serviceUrl
    ? null
    : createClient<Database>(serviceUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
}
