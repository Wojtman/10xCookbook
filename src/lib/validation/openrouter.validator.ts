import { z } from 'zod';

const MAX_MESSAGES = 30;
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_VALUE_LENGTH = 1_000;
const MAX_TIMEOUT_MS = 120_000;

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(MAX_METADATA_VALUE_LENGTH),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const ChatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z
      .string({
        required_error: 'content is required',
        invalid_type_error: 'content must be a string',
      })
      .trim()
      .min(1, 'content must not be empty'),
  })
  .transform((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));

const ModelParametersSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(8_192).optional(),
    top_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().min(0).max(2).optional(),
    presence_penalty: z.number().min(0).max(2).optional(),
    stop: z
      .union([z.string(), z.array(z.string().min(1))])
      .optional(),
    repetition_penalty: z.number().min(0).max(2).optional(),
    seed: z.number().int().optional(),
    top_k: z.number().int().positive().max(500).optional(),
  })
  .strict();

const JsonSchemaDefinitionSchema = z
  .object({
    name: z
      .string({
        required_error: 'schema.name is required',
        invalid_type_error: 'schema.name must be a string',
      })
      .trim()
      .min(1, 'schema.name must not be empty'),
    schema: z
      .any()
      .refine(
        (val) => typeof val === 'object' && val !== null,
        'schema.schema must be a JSON object',
      ),
    strict: z.boolean().optional(),
  })
  .strict();

const MetadataSchema = z
  .record(JsonValueSchema)
  .optional()
  .superRefine((metadata, ctx) => {
    if (!metadata) {
      return;
    }

    const keys = Object.keys(metadata);
    if (keys.length > MAX_METADATA_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata cannot contain more than ${MAX_METADATA_KEYS} entries`,
      });
    }
  });

export const OpenRouterChatRequestSchema = z
  .object({
    messages: z
      .array(ChatMessageSchema)
      .min(1, 'messages must include at least one entry')
      .max(MAX_MESSAGES, `messages cannot exceed ${MAX_MESSAGES} entries`),
    model: z
      .string()
      .trim()
      .min(1, 'model must not be empty')
      .optional(),
    parameters: ModelParametersSchema.optional(),
    metadata: MetadataSchema,
    schema: JsonSchemaDefinitionSchema.optional(),
    timeout_ms: z
      .number()
      .int()
      .positive()
      .max(MAX_TIMEOUT_MS)
      .optional(),
    idempotency_key: z
      .string()
      .trim()
      .min(1, 'idempotency_key must not be empty')
      .max(255)
      .optional(),
  })
  .strict();

export type OpenRouterChatRequestInput = z.infer<
  typeof OpenRouterChatRequestSchema
>;


