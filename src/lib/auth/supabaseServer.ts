import type { AstroCookies } from 'astro';
import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer, CookieOptionsWithName } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../db/database.types';

const cookieDefaults: CookieOptionsWithName = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
};

type SupabaseCookieList = Parameters<NonNullable<CookieMethodsServer['setAll']>>[0];
interface ParsedCookie {
  name: string;
  value: string;
}

interface CreateSupabaseServerClientOptions {
  request: Request;
  cookies: AstroCookies;
}

function parseCookieHeader(cookieHeader: string | null): ParsedCookie[] {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .map(cookie => {
      const [name, ...rest] = cookie.split('=');
      return {
        name,
        value: rest.join('='),
      };
    })
    .filter(cookie => cookie.name.length > 0);
}

export function createSupabaseServerClient({
  request,
  cookies,
}: CreateSupabaseServerClientOptions): SupabaseClient<Database> {
  const supabaseUrl =
    import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? import.meta.env.PRIVATE_SUPABASE_URL;
  const supabaseAnonKey =
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
    import.meta.env.PUBLIC_SUPABASE_KEY ??
    import.meta.env.SUPABASE_ANON_KEY ??
    import.meta.env.SUPABASE_KEY ??
    import.meta.env.PRIVATE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration for server client.');
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie'));
      },
      setAll(cookieList: SupabaseCookieList) {
        cookieList.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...cookieDefaults,
            ...options,
          });
        });
      },
    },
  });
}

