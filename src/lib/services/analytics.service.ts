import type { SupabaseClient } from '../../db/supabase.client';
import type {
  AnalyticsEventResponseDTO,
  LogAnalyticsEventCommand,
} from '../../types';

/**
 * Error thrown when logging analytics events fails.
 * Attaches the original Supabase error via the `cause` property for debugging.
 */
export class AnalyticsServiceError extends Error {
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'AnalyticsServiceError';
    this.cause = cause;
  }
}

interface LogAnalyticsEventOptions {
  supabase: SupabaseClient;
  userId?: string | null;
  command: LogAnalyticsEventCommand;
}

/**
 * Persists an analytics event into Supabase with optional user linkage.
 *
 * @param options - Supabase client, optional user ID, and event payload
 * @returns Inserted analytics event metadata
 */
export async function logAnalyticsEvent(
  options: LogAnalyticsEventOptions,
): Promise<AnalyticsEventResponseDTO> {
  const { supabase, userId, command } = options;

  const { data, error } = await supabase
    .from('analytics_events')
    .insert({
      user_id: userId ?? null,
      session_id: command.session_id,
      event_type: command.event_type,
      event_data: command.event_data ?? null,
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    throw new AnalyticsServiceError(
      `Failed to log analytics event: ${error?.message ?? 'Unknown error'}`,
      error instanceof Error ? error : undefined,
    );
  }

  return {
    event_id: data.id,
    created_at: data.created_at,
  };
}


