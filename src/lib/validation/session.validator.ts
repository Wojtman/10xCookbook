import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Validation schema for migrating anonymous session data into an authenticated account.
 *
 * The payload is expected to originate from trusted clients (browser / app),
 * but we still apply strict validation to guard against malformed requests.
 */
export const SessionMigrationSchema = z
  .object({
    session_id: z
      .string({
        required_error: 'session_id is required',
        invalid_type_error: 'session_id must be a string',
      })
      .uuid('session_id must be a valid UUID'),
    target_cookbook_id: z
      .string({
        invalid_type_error: 'target_cookbook_id must be a string',
      })
      .uuid('target_cookbook_id must be a valid UUID')
      .optional(),
  })
  .strict();

export type SessionMigrationInput = z.infer<typeof SessionMigrationSchema>;

/**
 * Extracts the best-effort client IP address from a request.
 *
 * Order of precedence:
 * 1. Cloudflare `cf-connecting-ip`
 * 2. Standard `x-forwarded-for`
 * 3. `x-real-ip`
 *
 * Returns `null` when no header is provided or the value is empty.
 */
export function extractClientIp(request: Request): string | null {
  const headers = request.headers;

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim();
  }

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor?.trim()) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp?.trim()) {
    return xRealIp.trim();
  }

  return null;
}

/**
 * Derives a deterministic fingerprint for rate limiting anonymous callers using a SHA-256 hash.
 *
 * @param request - Incoming request containing proxy headers.
 * @returns Hex-encoded SHA-256 hash of the client IP or `null` when unavailable.
 */
export function deriveClientFingerprint(request: Request): string | null {
  const clientIp = extractClientIp(request);
  if (!clientIp) {
    return null;
  }

  return createHash('sha256').update(clientIp, 'utf8').digest('hex');
}

/**
 * Computes a SHA-256 hash of the supplied anonymous session token for secure persistence.
 *
 * @param token - Plaintext anonymous session token.
 * @returns Hex-encoded SHA-256 digest.
 */
export function hashAnonymousSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}


