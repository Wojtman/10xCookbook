import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance } from "../db/supabase.client";

const AUTH_PUBLIC_PATH_PREFIXES = ["/auth", "/api/auth"] as const;
const STATIC_PATH_PREFIXES = ["/_astro", "/_image", "/_next", "/assets"] as const;
const STATIC_PATHS = new Set(["/favicon.ico", "/favicon.png", "/robots.txt", "/manifest.webmanifest"]);

function isStaticPath(pathname: string): boolean {
  return STATIC_PATHS.has(pathname) || STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthPublicPath(pathname: string): boolean {
  return AUTH_PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const onRequest = defineMiddleware(async ({ locals, cookies, request, url, redirect }, next) => {
  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });

  locals.supabase = supabase;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  locals.session = error ? null : (session ?? null);
  locals.user = error ? null : (session?.user ?? null);

  const pathname = url.pathname;

  if (!locals.user && !isAuthPublicPath(pathname) && !isStaticPath(pathname)) {
    const acceptHeader = request.headers.get("accept") ?? "";
    const expectsJson = acceptHeader.includes("application/json");

    if (request.method !== "GET" || expectsJson) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    return redirect("/auth/login");
  }

  return next();
});
