import { defineMiddleware } from 'astro:middleware';

import { supabaseClient } from '../db/supabase.client.ts';
import { enableAuthMocking, shouldMockAuth } from '../lib/utils/auth-mock.ts';

export const onRequest = defineMiddleware((context, next) => {
  // Enable auth mocking for development/testing if requested
  const client = shouldMockAuth() ? enableAuthMocking(supabaseClient) : supabaseClient;
  context.locals.supabase = client;
  return next();
});
