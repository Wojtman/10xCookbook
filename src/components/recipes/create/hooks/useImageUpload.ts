import { useCallback, useMemo, useState } from 'react';

import type {
  ImageUploadResponseDTO,
} from '@/types';
import type {
  UseImageUploadArgs,
  UseImageUploadResult,
} from '../types';

interface ApiErrorResponse {
  error?: string;
  message?: string;
  retry_after?: number;
  fields?: string[];
}

export function useImageUpload({
  sessionId,
  analyticsSessionId,
  onUploadComplete,
  onError,
}: UseImageUploadArgs = {}): UseImageUploadResult {
  const [data, setData] = useState<ImageUploadResponseDTO | null | undefined>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const upload = useCallback<UseImageUploadResult['upload']>(
    async file => {
      if (!(file instanceof File)) {
        const message = 'Select an image file before uploading.';
        setError(message);
        onError?.(message);
        return null;
      }

      const identifier = sessionId ?? analyticsSessionId ?? undefined;

      const formData = new FormData();
      formData.append('file', file);
      if (identifier) {
        formData.append('session_id', identifier);
      }

      setUploading(true);
      setError(undefined);

      try {
        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const payload = (await response.json()) as ImageUploadResponseDTO;
          setData(payload);
          setUploading(false);
          setError(undefined);
          onUploadComplete?.(payload);
          return payload;
        }

        const errorBody = (await safeParseJson<ApiErrorResponse>(response)) ?? {};

        let message =
          errorBody.message ??
          (response.status === 429
            ? 'Too many image uploads. Please wait before trying again.'
            : response.status === 400
              ? 'The selected image did not meet the upload requirements.'
              : 'Image upload failed. Please try again.');

        if (errorBody.error === 'file_too_large') {
          message = 'Image exceeds the maximum size of 2MB.';
        } else if (errorBody.error === 'invalid_file_type') {
          message = 'Unsupported image format. Use PNG, JPEG, or WebP.';
        }

        setError(message);
        setUploading(false);
        onError?.(message);
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to upload image.';
        setError(message);
        setUploading(false);
        onError?.(message);
        return null;
      }
    },
    [analyticsSessionId, onError, onUploadComplete, sessionId],
  );

  const remove = useCallback(() => {
    setData(null);
    setError(undefined);
    setUploading(false);
  }, []);

  return useMemo(
    () => ({
      data,
      uploading,
      error,
      upload,
      remove,
    }),
    [data, error, remove, upload, uploading],
  );
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}


