import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const { supabase } = locals;

  if (!supabase) {
    return buildJsonResponse(
      {
        error: "Authentication client is not available.",
      },
      500
    );
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return buildJsonResponse(
      {
        error: error.message,
      },
      400
    );
  }

  locals.user = null;

  return buildJsonResponse({ success: true }, 200);
};

export const ALL: APIRoute = async () => {
  return buildJsonResponse(
    {
      error: "Method Not Allowed",
    },
    405
  );
};

function buildJsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
