import { defineMiddleware } from 'astro:middleware';

import { createSupabaseServerClient } from '../lib/auth/supabaseServer';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient({
    request: context.request,
    cookies: context.cookies,
  });

  context.locals.supabase = supabase;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    context.locals.user = null;
  } else {
    context.locals.user = user ?? null;
  }

  return next();
});
