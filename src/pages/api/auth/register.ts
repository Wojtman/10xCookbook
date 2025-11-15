import type { APIRoute } from "astro";
import { ZodError, z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client";

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
