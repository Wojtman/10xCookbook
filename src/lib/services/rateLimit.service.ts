import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { AnalyticsEventType } from "../../types";

/**
 * Error thrown when a caller exceeds the configured rate limit.
 */
export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

/**
 * Error thrown when the rate limiter fails due to database issues.
 */
export class RateLimitServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitServiceError";
  }
}

interface EnsureWithinRateLimitOptions {
  supabase: SupabaseClient<Database>;
  identifier: {
    userId?: string | null;
    sessionId?: string | null;
  };
  eventType: AnalyticsEventType;
  maxRequests: number;
  windowMs: number;
}

/**
 * Ensures the caller has not exceeded the configured number of events within the time window.
 *
 * @throws RateLimitExceededError when the caller exceeds the limit.
 * @throws RateLimitServiceError when Supabase query fails.
 */
export async function ensureWithinRateLimit(options: EnsureWithinRateLimitOptions): Promise<void> {
  const { supabase, identifier, eventType, maxRequests, windowMs } = options;

  const filterColumn = identifier.userId ? "user_id" : "session_id";
  const filterValue = identifier.userId ?? identifier.sessionId ?? null;

  if (!filterValue) {
    throw new RateLimitServiceError("Rate limiter requires either a userId or sessionId to be provided");
  }

  const windowStartIso = new Date(Date.now() - windowMs).toISOString();

  const query = supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", windowStartIso)
    .eq(filterColumn, filterValue);

  const { count, error } = await query;

  if (error) {
    throw new RateLimitServiceError(`Failed to evaluate rate limit: ${error.message}`);
  }

  if ((count ?? 0) >= maxRequests) {
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    throw new RateLimitExceededError("Rate limit exceeded", retryAfterSeconds);
  }
}
