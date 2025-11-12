import { z } from 'zod';
import type { AIParseResponseDTO } from '../../types';
import { VALIDATION_CONSTANTS } from '../../types';
import { sanitizeRawText } from '../validation/ai.validator';

/**
 * Error codes describing failure modes for the AI parsing pipeline.
 */
export type AIParsingErrorCode =
  | 'missing_api_key'
  | 'timeout'
  | 'request_failed'
  | 'invalid_response';

/**
 * Custom error class thrown when the AI parsing service fails.
 */
export class AIParsingError extends Error {
  constructor(
    message: string,
    public readonly code: AIParsingErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AIParsingError';
  }
}

interface ParseRecipeWithAIOptions {
  rawText: string;
  abortSignal?: AbortSignal;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-3-haiku-20240307';

/**
 * Zod schema to validate the AI provider JSON response before returning it to clients.
 */
const AIParseResponseSchema = z.object({
  title: z.string().min(1),
  preparation_description: z.string().default(''),
  prep_time_minutes: z.number().int().positive().optional(),
  ingredients: z
    .array(
      z.object({
        display_order: z.number().int().nonnegative(),
        name: z.string().min(1),
        quantity: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .default([]),
  suggested_tags: z.array(z.string()).default([]),
  parsing_duration_ms: z.number().int().nonnegative().default(0),
});

/**
 * Helper that composes the request payload sent to OpenRouter.
 */
function buildOpenRouterPayload(rawText: string) {
  const model = import.meta.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const responseSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', minLength: 1 },
      preparation_description: { type: 'string' },
      prep_time_minutes: { type: ['number', 'null'], minimum: 1 },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            display_order: { type: 'integer', minimum: 0 },
            name: { type: 'string', minLength: 1 },
            quantity: { type: ['string', 'null'] },
            notes: { type: ['string', 'null'] },
          },
          required: ['display_order', 'name'],
        },
      },
      suggested_tags: {
        type: 'array',
        items: { type: 'string' },
      },
      parsing_duration_ms: {
        type: ['number', 'null'],
        description: 'Duration in milliseconds that the provider reports for parsing (optional).',
      },
    },
    required: ['title', 'preparation_description', 'ingredients', 'suggested_tags'],
  };

  return {
    model,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_parse_response',
        schema: responseSchema,
        strict: true,
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You are an assistant that extracts structured recipe data. Return JSON that strictly matches the provided schema. If information is missing, infer reasonable defaults without hallucinating unavailable details.',
      },
      {
        role: 'user',
        content: `Parse the following recipe text and return JSON:\n\n${rawText}`,
      },
    ],
  };
}

/**
 * Calls the OpenRouter-powered AI parsing service and maps the result to an internal DTO.
 *
 * @throws AIParsingError when the provider or network request fails.
 */
export async function parseRecipeWithAI(
  options: ParseRecipeWithAIOptions,
): Promise<AIParseResponseDTO> {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIParsingError('Missing OpenRouter API key', 'missing_api_key');
  }

  const sanitizedText = sanitizeRawText(options.rawText);
  if (!sanitizedText) {
    throw new AIParsingError('Sanitized recipe text is empty', 'invalid_response');
  }

  const payload = buildOpenRouterPayload(sanitizedText);

  const controller = new AbortController();
  const signals: AbortSignal[] = [controller.signal];

  const { abortSignal } = options;
  let abortHandler: (() => void) | undefined;
  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort();
    } else {
      abortHandler = () => controller.abort();
      abortSignal.addEventListener('abort', abortHandler, { once: true });
      signals.push(abortSignal);
    }
  }

  const timeout = setTimeout(
    () => controller.abort(),
    VALIDATION_CONSTANTS.AI_PARSE.TIMEOUT_MS,
  );

  const startedAt = Date.now();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': import.meta.env.SITE_URL ?? 'https://10xcookbook.dev',
        'X-Title': '10xCookbook AI Parser',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const elapsed = Date.now() - startedAt;

    if (!response.ok) {
      const errorBody = await safeParseJSON(response);
      throw new AIParsingError(
        `AI provider responded with status ${response.status}`,
        'request_failed',
        response.status,
      );
    }

    const json = await response.json();

    const content = extractContentFromProvider(json);

    const validated = AIParseResponseSchema.parse({
      ...content,
      parsing_duration_ms: content.parsing_duration_ms ?? elapsed,
    });

    const normalized: AIParseResponseDTO = {
      title: validated.title,
      preparation_description: validated.preparation_description,
      prep_time_minutes: validated.prep_time_minutes ?? undefined,
      ingredients: validated.ingredients.map((ingredient) => ({
        display_order: ingredient.display_order,
        name: ingredient.name,
        quantity: ingredient.quantity ?? undefined,
        notes: ingredient.notes ?? undefined,
      })),
      suggested_tags: validated.suggested_tags,
      parsing_duration_ms: validated.parsing_duration_ms,
    };

    return normalized;
  } catch (error) {
    if (error instanceof AIParsingError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new AIParsingError('AI parsing request timed out', 'timeout');
    }
    throw new AIParsingError(
      error instanceof Error ? error.message : 'Unknown AI parsing error',
      'request_failed',
    );
  } finally {
    clearTimeout(timeout);
    if (abortSignal && abortHandler) {
      abortSignal.removeEventListener('abort', abortHandler);
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  );
}

async function safeParseJSON(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractContentFromProvider(providerPayload: any): Record<string, any> {
  const choices = providerPayload?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AIParsingError('AI provider returned no choices', 'invalid_response');
  }

  const message = choices[0]?.message;
  if (!message) {
    throw new AIParsingError('AI provider returned an empty message', 'invalid_response');
  }

  if (typeof message.content === 'string') {
    try {
      return JSON.parse(message.content);
    } catch (error) {
      throw new AIParsingError('AI provider response was not valid JSON', 'invalid_response');
    }
  }

  if (Array.isArray(message.content)) {
    const jsonPart = message.content.find((part: any) => part.type === 'output_text');
    if (jsonPart && typeof jsonPart.text === 'string') {
      try {
        return JSON.parse(jsonPart.text);
      } catch {
        throw new AIParsingError('AI provider response contained invalid structured JSON', 'invalid_response');
      }
    }
  }

  throw new AIParsingError('Unable to extract structured response from AI provider', 'invalid_response');
}


