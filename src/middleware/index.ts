import { defineMiddleware } from 'astro:middleware';

import { supabaseClient } from '../db/supabase.client.ts';

export const onRequest = defineMiddleware((context, next) => {
  const client =  supabaseClient;

  context.locals.supabase = client;
  return next();
});
