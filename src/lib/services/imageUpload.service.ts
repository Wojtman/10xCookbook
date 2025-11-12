import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { SupabaseClient } from '../../db/supabase.client';
import type { ImageUploadResponseDTO } from '../../types';
import { VALIDATION_CONSTANTS } from '../../types';
import {
  ensureWithinRateLimit,
  RateLimitExceededError,
  RateLimitServiceError,
} from './rateLimit.service';
import {
  logAnalyticsEvent,
  AnalyticsServiceError,
} from './analytics.service';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: string[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ImageUploadValidationError extends ImageUploadError {
  constructor(
    message: string,
    fields?: string[],
    code = 'validation_error',
    status = 400,
  ) {
    super(message, status, code, fields);
  }
}

export class ImageUploadRateLimitError extends ImageUploadError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message, 429, 'too_many_requests');
  }
}

export class ImageUploadProcessingError extends ImageUploadError {
  constructor(message: string) {
    super(message, 500, 'image_processing_failed');
  }
}

export class ImageUploadStorageError extends ImageUploadError {
  constructor(message: string) {
    super(message, 500, 'storage_error');
  }
}

export class ImageUploadRateLimitServiceError extends ImageUploadError {
  constructor(message: string) {
    super(message, 500, 'rate_limit_failed');
  }
}

export class ImageUploadConfigurationError extends ImageUploadError {
  constructor(message: string) {
    super(message, 500, 'configuration_error');
  }
}

interface UploadRecipeImageOptions {
  supabase: SupabaseClient;
  file: File;
  identifiers: {
    userId?: string | null;
    sessionId?: string | null;
  };
  analyticsSessionId: string;
  bucketName?: string;
}

interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
}

const MAX_FILE_SIZE = VALIDATION_CONSTANTS.IMAGE.MAX_FILE_SIZE_BYTES;
const MAX_DIMENSION = VALIDATION_CONSTANTS.IMAGE.MAX_DIMENSIONS;
const RATE_LIMIT_MAX_REQUESTS =
  VALIDATION_CONSTANTS.RATE_LIMITS.IMAGE_UPLOAD_PER_HOUR;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Validates that the uploaded file satisfies pre-processing constraints.
 *
 * Throws specialized validation errors so API routes can map them to
 * the specification's response codes (400, 413, 415).
 */
function validateImageFile(file: File): void {
  if (!file) {
    throw new ImageUploadValidationError('Image file is required', ['file']);
  }

  if (file.size === 0) {
    throw new ImageUploadValidationError('Uploaded file is empty', ['file']);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ImageUploadValidationError(
      `Image exceeds maximum file size of ${Math.floor(MAX_FILE_SIZE / (1024 * 1024))} MB`,
      ['file'],
      'file_too_large',
      413,
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ImageUploadValidationError(
      'Unsupported image format. Allowed formats are PNG, JPEG, and WebP.',
      ['file'],
      'invalid_file_type',
      415,
    );
  }
}

/**
 * Ensures the caller has not exhausted the hourly upload allowance.
 *
 * Rate limiting leverages the shared analytics event log so we can reuse
 * existing infrastructure (see `logImageUploadEvent` for the insert that
 * records each successful upload).
 */
async function enforceRateLimit(options: {
  supabase: SupabaseClient;
  identifiers: UploadRecipeImageOptions['identifiers'];
}): Promise<void> {
  const { supabase, identifiers } = options;

  try {
    await ensureWithinRateLimit({
      supabase,
      identifier: identifiers.userId
        ? { userId: identifiers.userId }
        : { sessionId: identifiers.sessionId ?? null },
      eventType: 'image_upload',
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new ImageUploadRateLimitError(
        'Too many image uploads. Please wait before trying again.',
        error.retryAfterSeconds,
      );
    }

    if (error instanceof RateLimitServiceError) {
      throw new ImageUploadRateLimitServiceError(
        'Unable to verify upload limits at this time.',
      );
    }

    throw error;
  }
}

/**
 * Loads the file into Sharp, normalises it to a square WebP within the
 * configured dimension constraints, and returns metadata about the result.
 */
async function processImage(file: File): Promise<ProcessedImageResult> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const sharpModule = await import('sharp');
    const sharp = sharpModule.default ?? sharpModule;

    const image = sharp(buffer, { failOnError: true });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageUploadProcessingError(
        'Unable to determine image dimensions.',
      );
    }

    const resizeTarget = Math.min(
      MAX_DIMENSION,
      Math.max(metadata.width, metadata.height),
    );

    const { data, info } = await image
      .resize({
        width: resizeTarget,
        height: resizeTarget,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    if (info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) {
      throw new ImageUploadValidationError(
        `Processed image exceeds maximum dimension of ${MAX_DIMENSION}px.`,
        ['file'],
        'invalid_dimensions',
        400,
      );
    }

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
      format: 'webp',
    };
  } catch (error) {
    if (error instanceof ImageUploadError) {
      throw error;
    }

    throw new ImageUploadProcessingError(
      error instanceof Error ? error.message : 'Failed to process image.',
    );
  }
}

/**
 * Resolves the Supabase Storage bucket used for recipe images.
 * Prefers the provided name, otherwise pulls from env configuration.
 */
function resolveBucketName(providedBucket?: string): string {
  const bucket =
    providedBucket ??
    process.env.SUPABASE_RECIPE_IMAGES_BUCKET ??
    import.meta.env.SUPABASE_RECIPE_IMAGES_BUCKET;

  if (!bucket) {
    throw new ImageUploadConfigurationError(
      'SUPABASE_RECIPE_IMAGES_BUCKET environment variable is not configured.',
    );
  }

  return bucket;
}

/**
 * Generates a deterministic storage folder based on owner type followed by
 * a UUID filename so there are no collisions across users/sessions.
 */
function buildStoragePath(identifiers: UploadRecipeImageOptions['identifiers']): string {
  const ownerFolder = identifiers.userId
    ? path.join('users', identifiers.userId)
    : path.join('sessions', identifiers.sessionId ?? 'anonymous');

  return path.join(ownerFolder, `${randomUUID()}.webp`);
}

/**
 * Uploads the processed image buffer to Supabase Storage.
 */
async function uploadToStorage(options: {
  supabase: SupabaseClient;
  bucketName: string;
  storagePath: string;
  buffer: Buffer;
}): Promise<void> {
  const { supabase, bucketName, storagePath, buffer } = options;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, buffer, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) {
    throw new ImageUploadStorageError(
      `Failed to upload image to storage: ${error.message}`,
    );
  }
}

/**
 * Derives a public URL for the uploaded asset using Supabase's helper.
 */
function buildPublicUrl(options: {
  supabase: SupabaseClient;
  bucketName: string;
  storagePath: string;
}): string {
  const { supabase, bucketName, storagePath } = options;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new ImageUploadStorageError(
      'Failed to generate image URL.',
    );
  }

  return data.publicUrl;
}

/**
 * Writes an analytics event so the rate limiter has a durable record and
 * product has visibility into upload behaviour.
 */
async function logImageUploadEvent(options: {
  supabase: SupabaseClient;
  userId?: string | null;
  analyticsSessionId: string;
  storagePath: string;
  metadata: ProcessedImageResult;
}): Promise<void> {
  const { supabase, userId, analyticsSessionId, storagePath, metadata } =
    options;

  try {
    await logAnalyticsEvent({
      supabase,
      userId: userId ?? null,
      command: {
        session_id: analyticsSessionId,
        event_type: 'image_upload',
        event_data: {
          storage_path: storagePath,
          width: metadata.width,
          height: metadata.height,
          size_bytes: metadata.sizeBytes,
        },
      },
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      console.error('Failed to log image_upload event:', error);
      return;
    }
    throw error;
  }
}

/**
 * Main service entry point for recipe image uploads.
 *
 * 1. Validates the incoming file and caller identity.
 * 2. Enforces per-user/per-session rate limits via analytics_events.
 * 3. Processes the image with Sharp and stores it in Supabase Storage.
 * 4. Logs an analytics event for observability and rate-limit accounting.
 *
 * Returns a DTO with the final image metadata on success.
 */
export async function uploadRecipeImage(
  options: UploadRecipeImageOptions,
): Promise<ImageUploadResponseDTO> {
  const { supabase, file, identifiers, analyticsSessionId, bucketName } =
    options;

  if (!identifiers.userId && !identifiers.sessionId) {
    throw new ImageUploadValidationError(
      'Either userId or sessionId must be provided.',
      ['session_id'],
    );
  }

  if (!analyticsSessionId) {
    throw new ImageUploadValidationError(
      'analyticsSessionId is required.',
      ['session_id'],
    );
  }

  validateImageFile(file);

  await enforceRateLimit({ supabase, identifiers });

  const processedImage = await processImage(file);

  const resolvedBucket = resolveBucketName(bucketName);

  const maxUploadAttempts = 3;
  let storagePath = '';
  for (let attempt = 0; attempt < maxUploadAttempts; attempt += 1) {
    storagePath = buildStoragePath(identifiers);

    try {
      await uploadToStorage({
        supabase,
        bucketName: resolvedBucket,
        storagePath,
        buffer: processedImage.buffer,
      });
      break;
    } catch (error) {
      if (
        error instanceof ImageUploadStorageError &&
        error.message.includes('already exists') &&
        attempt < maxUploadAttempts - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  const imageUrl = buildPublicUrl({
    supabase,
    bucketName: resolvedBucket,
    storagePath,
  });

  await logImageUploadEvent({
    supabase,
    userId: identifiers.userId ?? null,
    analyticsSessionId,
    storagePath,
    metadata: processedImage,
  });

  return {
    image_url: imageUrl,
    width: processedImage.width,
    height: processedImage.height,
    size_bytes: processedImage.sizeBytes,
    format: processedImage.format,
  };
}


