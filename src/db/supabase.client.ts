import type { AstroCookies } from "astro";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.ts";

interface SupabaseServerContext {
  headers: Headers;
  cookies: AstroCookies;
}

interface ParsedCookie {
  name: string;
  value: string;
}

function pickEnvValue(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

const browserSupabaseUrl = pickEnvValue(
  import.meta.env.PUBLIC_SUPABASE_DB_URL
  // import.meta.env.SUPABASE_URL,
  // import.meta.env.PRIVATE_SUPABASE_URL
);
const browserSupabaseAnonKey = pickEnvValue(
  import.meta.env.PUBLIC_SUPABASE_DB_ANON_KEY
  // import.meta.env.PUBLIC_SUPABASE_KEY,
  // import.meta.env.SUPABASE_ANON_KEY,
  // import.meta.env.SUPABASE_KEY,
  // import.meta.env.PRIVATE_SUPABASE_ANON_KEY
);

if (!browserSupabaseUrl || !browserSupabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please ensure SUPABASE_URL and SUPABASE_KEY are set in your .env file."
  );
}

export const supabaseClient = createClient<Database>(browserSupabaseUrl, browserSupabaseAnonKey);

export type SupabaseClient = typeof supabaseClient;

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD,
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string | null): ParsedCookie[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [name, ...rest] = cookie.split("=");
      return {
        name,
        value: rest.join("="),
      };
    })
    .filter((cookie) => cookie.name.length > 0);
}

export const createSupabaseServerInstance = ({ headers, cookies }: SupabaseServerContext) => {
  const serverSupabaseUrl = pickEnvValue(
    // import.meta.env.SUPABASE_URL,
    // import.meta.env.PRIVATE_SUPABASE_URL,
    browserSupabaseUrl
  );
  const serverSupabaseKey = pickEnvValue(
    // import.meta.env.SUPABASE_KEY,
    // import.meta.env.PRIVATE_SUPABASE_ANON_KEY,
    browserSupabaseAnonKey
  );

  if (!serverSupabaseUrl || !serverSupabaseKey) {
    throw new Error("Missing Supabase configuration for server client.");
  }

  return createServerClient<Database>(serverSupabaseUrl, serverSupabaseKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(headers.get("cookie"));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...cookieOptions,
            ...options,
          });
        });
      },
    },
  });
};
