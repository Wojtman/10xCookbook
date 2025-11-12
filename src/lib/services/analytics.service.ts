import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type {
  AnalyticsEventResponseDTO,
  LogAnalyticsEventCommand,
} from '../../types';

/**
 * Error thrown when logging analytics events fails.
 */
export class AnalyticsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}

interface LogAnalyticsEventOptions {
  supabase: SupabaseClient<Database>;
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
    );
  }

  return {
    event_id: data.id,
    created_at: data.created_at,
  };
}


