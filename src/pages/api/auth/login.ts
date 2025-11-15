import type { APIRoute } from "astro";
import { ZodError, z } from "zod";

import { createSupabaseServerInstance } from "../../../db/supabase.client";

const loginRequestSchema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const payload = await request.json();
    const { email, password } = loginRequestSchema.parse(payload);

    const supabase = createSupabaseServerInstance({
      cookies,
      headers: request.headers,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return buildJsonResponse({ error: error.message }, 400);
    }

    return buildJsonResponse({ user: data.user }, 200);
  } catch (error) {
    if (error instanceof ZodError) {
      const [{ message }] = error.issues;
      return buildJsonResponse({ error: message }, 400);
    }

    return buildJsonResponse({ error: "Unable to sign in" }, 500);
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
