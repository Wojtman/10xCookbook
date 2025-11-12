import { randomUUID } from 'node:crypto';
import type { Tables, TablesInsert } from '../../db/database.types';
import type { SupabaseClient } from '../../db/supabase.client';
import type { MigrationResponseDTO, SessionResponseDTO } from '../../types';
import { VALIDATION_CONSTANTS } from '../../types';
import { hashAnonymousSessionToken } from '../validation/session.validator';
import { ensureWithinRateLimit } from './rateLimit.service';
import { logAnalyticsEvent, AnalyticsServiceError } from './analytics.service';

const SESSION_CREATION_MESSAGE =
  'Anonymous session created. Save this session ID to continue working on your drafts for the next 24 hours.';

export class SessionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionServiceError';
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super('Anonymous session not found');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends Error {
  constructor(public readonly expiresAt: string) {
    super('Anonymous session has expired');
    this.name = 'SessionExpiredError';
  }
}

export class SessionAlreadyMigratedError extends Error {
  constructor(public readonly migratedAt: string) {
    super('Anonymous session has already been migrated');
    this.name = 'SessionAlreadyMigratedError';
  }
}

export class SessionMigrationConflictError extends Error {
  constructor(message = 'Concurrent migration detected') {
    super(message);
    this.name = 'SessionMigrationConflictError';
  }
}

export class CookbookOwnershipError extends Error {
  constructor() {
    super('Cookbook not found or access denied');
    this.name = 'CookbookOwnershipError';
  }
}

export class AnonymousRecipesNotFoundError extends Error {
  constructor() {
    super('No anonymous drafts found for session');
    this.name = 'AnonymousRecipesNotFoundError';
  }
}

export interface CreateAnonymousSessionOptions {
  /**
   * SHA-256 hash derived from the requester IP (or other fingerprint).
   * Used both for rate-limiting and persistence in the anonymous_sessions table.
   */
  clientFingerprint: string | null;
}

export interface MigrateAnonymousSessionOptions {
  sessionToken: string;
  targetCookbookId?: string;
  userId: string;
}

type AnonymousSessionRow = Tables<'anonymous_sessions'>;
type AnonymousRecipeRow = Tables<'anonymous_recipes'>;
type AnonymousRecipeIngredientRow = Tables<'anonymous_recipe_ingredients'>;
type AnonymousRecipeTagRow = Tables<'anonymous_recipe_tags'>;

interface AnonymousRecipeWithRelations extends AnonymousRecipeRow {
  anonymous_recipe_ingredients: AnonymousRecipeIngredientRow[];
  anonymous_recipe_tags: AnonymousRecipeTagRow[];
}

type RecipeInsertRow = TablesInsert<'recipes'>;
type RecipeIngredientInsertRow = TablesInsert<'recipe_ingredients'>;
type RecipeTagInsertRow = TablesInsert<'recipe_tags'>;

export class SessionService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Issues a new anonymous session token, enforcing rate limits and persisting the session metadata.
   *
   * @throws RateLimitExceededError when the caller exceeds the configured rate limit.
   * @throws RateLimitServiceError when rate limit evaluation fails.
   * @throws SessionServiceError when Supabase persistence fails unexpectedly.
   */
  async createAnonymousSession(
    options: CreateAnonymousSessionOptions,
  ): Promise<SessionResponseDTO> {
    const { clientFingerprint } = options;

    if (clientFingerprint) {
      await ensureWithinRateLimit({
        supabase: this.supabase,
        identifier: { sessionId: clientFingerprint },
        eventType: 'anonymous_session_request',
        maxRequests: VALIDATION_CONSTANTS.RATE_LIMITS.ANONYMOUS_SESSION_PER_HOUR,
        windowMs: VALIDATION_CONSTANTS.RATE_LIMITS.ANONYMOUS_SESSION_WINDOW_MS,
      });
    }

    const sessionToken = randomUUID();
    const tokenHash = hashAnonymousSessionToken(sessionToken);
    const expiresAt = new Date(
      Date.now() +
        VALIDATION_CONSTANTS.SESSION.ANONYMOUS_SESSION_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase
      .from('anonymous_sessions')
      .insert({
        token_hash: tokenHash,
        expires_at: expiresAt,
        client_fingerprint: clientFingerprint,
      })
      .select('expires_at, id')
      .single();

    if (error || !data) {
      // If the token unexpectedly collides, retry once with a fresh token.
      if (error?.code === '23505') {
        return this.retryCreateAnonymousSession(clientFingerprint, expiresAt);
      }
      throw new SessionServiceError(
        `Failed to persist anonymous session: ${error?.message ?? 'Unknown error'}`,
      );
    }

    await this.logSessionCreationAnalytics({
      issuedToken: sessionToken,
      expiresAt,
      clientFingerprint,
    });

    return {
      session_id: sessionToken,
      expires_at: data.expires_at,
      message: SESSION_CREATION_MESSAGE,
    };
  }

  private async retryCreateAnonymousSession(
    clientFingerprint: string | null,
    expiresAtIso: string,
  ): Promise<SessionResponseDTO> {
    const fallbackToken = randomUUID();
    const tokenHash = hashAnonymousSessionToken(fallbackToken);

    const { data, error } = await this.supabase
      .from('anonymous_sessions')
      .insert({
        token_hash: tokenHash,
        expires_at: expiresAtIso,
        client_fingerprint: clientFingerprint,
      })
      .select('expires_at, id')
      .single();

    if (error || !data) {
      throw new SessionServiceError(
        `Failed to persist anonymous session after retry: ${error?.message ?? 'Unknown error'}`,
      );
    }

    await this.logSessionCreationAnalytics({
      issuedToken: fallbackToken,
      expiresAt: expiresAtIso,
      clientFingerprint,
    });

    return {
      session_id: fallbackToken,
      expires_at: data.expires_at,
      message: SESSION_CREATION_MESSAGE,
    };
  }

  async migrateAnonymousSession(
    options: MigrateAnonymousSessionOptions,
  ): Promise<MigrationResponseDTO> {
    const { sessionToken, targetCookbookId, userId } = options;

    const sessionRow = await this.fetchActiveAnonymousSession(sessionToken);
    const destinationCookbookId = await this.resolveTargetCookbookId(
      userId,
      targetCookbookId ?? null,
    );
    const drafts = await this.fetchAnonymousDrafts(sessionRow.id);

    const { recipeRows, ingredientRows, tagRows, recipeIds } = this.buildMigrationPayloads(
      drafts,
      destinationCookbookId,
    );

    const insertedRecipeIds: string[] = [];

    try {
      const { data: insertedRecipes, error: recipeInsertError } = await this.supabase
        .from('recipes')
        .insert(recipeRows)
        .select('id');

      if (recipeInsertError) {
        throw new SessionServiceError(
          `Failed to insert migrated recipes: ${recipeInsertError.message}`,
        );
      }

      insertedRecipeIds.push(
        ...(insertedRecipes?.map((recipe) => recipe.id) ?? recipeIds),
      );

      if (ingredientRows.length > 0) {
        const { error: ingredientInsertError } = await this.supabase
          .from('recipe_ingredients')
          .insert(ingredientRows);

        if (ingredientInsertError) {
          throw new SessionServiceError(
            `Failed to insert migrated ingredients: ${ingredientInsertError.message}`,
          );
        }
      }

      if (tagRows.length > 0) {
        const { error: tagInsertError } = await this.supabase
          .from('recipe_tags')
          .insert(tagRows);

        if (tagInsertError) {
          throw new SessionServiceError(
            `Failed to insert migrated recipe tags: ${tagInsertError.message}`,
          );
        }
      }
    } catch (error) {
      await this.rollbackInsertedRecipes(insertedRecipeIds);
      throw error instanceof Error ? error : new SessionServiceError('Unknown migration failure');
    }

    const migratedAt = new Date().toISOString();

    const { data: sessionUpdateRows, error: sessionUpdateError } = await this.supabase
      .from('anonymous_sessions')
      .update({
        migrated_at: migratedAt,
        migrated_by_user_id: userId,
        target_cookbook_id: destinationCookbookId,
      })
      .eq('id', sessionRow.id)
      .is('migrated_at', null)
      .select('id');

    if (sessionUpdateError) {
      await this.rollbackInsertedRecipes(insertedRecipeIds);
      throw new SessionServiceError(
        `Failed to update anonymous session status: ${sessionUpdateError.message}`,
      );
    }

    if (!sessionUpdateRows || sessionUpdateRows.length === 0) {
      await this.rollbackInsertedRecipes(insertedRecipeIds);
      throw new SessionMigrationConflictError();
    }

    await this.cleanupAnonymousDrafts(drafts.map((draft) => draft.id));

    await this.logSessionEndAnalytics({
      sessionToken,
      migratedRecipes: drafts.length,
      targetCookbookId: destinationCookbookId,
    });

    const successMessage =
      drafts.length === 1
        ? 'Migrated 1 recipe into your cookbook.'
        : `Migrated ${drafts.length} recipes into your cookbook.`;

    return {
      migrated_recipes: drafts.length,
      target_cookbook_id: destinationCookbookId,
      message: successMessage,
    };
  }

  private async logSessionCreationAnalytics({
    issuedToken,
    expiresAt,
    clientFingerprint,
  }: {
    issuedToken: string;
    expiresAt: string;
    clientFingerprint: string | null;
  }): Promise<void> {
    try {
      await logAnalyticsEvent({
        supabase: this.supabase,
        userId: null,
        command: {
          session_id: issuedToken,
          event_type: 'session_start',
          event_data: {
            expires_at: expiresAt,
          },
        },
      });
    } catch (error) {
      if (error instanceof AnalyticsServiceError) {
        console.error('Failed to log session_start analytics event', error);
      } else {
        console.error('Unexpected error while logging session_start analytics event', error);
      }
    }

    if (!clientFingerprint) {
      return;
    }

    try {
      await logAnalyticsEvent({
        supabase: this.supabase,
        userId: null,
        command: {
          session_id: clientFingerprint,
          event_type: 'anonymous_session_request',
          event_data: {
            issued_session_id: issuedToken,
          },
        },
      });
    } catch (error) {
      if (error instanceof AnalyticsServiceError) {
        console.error(
          'Failed to log anonymous_session_request analytics event for rate limiting',
          error,
        );
      } else {
        console.error(
          'Unexpected error while logging anonymous_session_request analytics event',
          error,
        );
      }
    }
  }

  private async logSessionEndAnalytics({
    sessionToken,
    migratedRecipes,
    targetCookbookId,
  }: {
    sessionToken: string;
    migratedRecipes: number;
    targetCookbookId: string;
  }): Promise<void> {
    try {
      await logAnalyticsEvent({
        supabase: this.supabase,
        userId: null,
        command: {
          session_id: sessionToken,
          event_type: 'session_end',
          event_data: {
            migrated_recipes: migratedRecipes,
            target_cookbook_id: targetCookbookId,
          },
        },
      });
    } catch (error) {
      if (error instanceof AnalyticsServiceError) {
        console.error('Failed to log session_end analytics event', error);
      } else {
        console.error('Unexpected error while logging session_end analytics event', error);
      }
    }
  }

  private async fetchActiveAnonymousSession(sessionToken: string): Promise<AnonymousSessionRow> {
    const tokenHash = hashAnonymousSessionToken(sessionToken);

    const { data, error } = await this.supabase
      .from('anonymous_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new SessionNotFoundError();
      }
      throw new SessionServiceError(`Failed to load anonymous session: ${error.message}`);
    }

    if (!data) {
      throw new SessionNotFoundError();
    }

    const expiresAtMs = new Date(data.expires_at).getTime();
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) {
      throw new SessionExpiredError(data.expires_at);
    }

    if (data.migrated_at) {
      throw new SessionAlreadyMigratedError(data.migrated_at);
    }

    return data;
  }

  private async resolveTargetCookbookId(
    userId: string,
    requestedCookbookId?: string | null,
  ): Promise<string> {
    if (requestedCookbookId) {
      const { data, error } = await this.supabase
        .from('cookbooks')
        .select('id')
        .eq('id', requestedCookbookId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new SessionServiceError(
          `Failed to verify target cookbook ownership: ${error.message}`,
        );
      }

      if (!data) {
        throw new CookbookOwnershipError();
      }

      return data.id;
    }

    const { data: defaultCookbook, error: defaultError } = await this.supabase
      .from('cookbooks')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (defaultError) {
      throw new SessionServiceError(`Failed to look up default cookbook: ${defaultError.message}`);
    }

    if (defaultCookbook) {
      return defaultCookbook.id;
    }

    const baseTitle = 'Imported Recipes';
    let attempt = 0;

    while (attempt < 3) {
      const title = attempt === 0 ? baseTitle : `${baseTitle} (${attempt + 1})`;

      const { data: createdCookbook, error: createError } = await this.supabase
        .from('cookbooks')
        .insert({
          user_id: userId,
          title,
          is_default: true,
        })
        .select('id')
        .single();

      if (!createError && createdCookbook) {
        return createdCookbook.id;
      }

      if (createError?.code === '23505') {
        if (createError.message.includes('default')) {
          const { data: concurrentDefault, error: concurrentError } = await this.supabase
            .from('cookbooks')
            .select('id')
            .eq('user_id', userId)
            .eq('is_default', true)
            .maybeSingle();

          if (concurrentError) {
            throw new SessionServiceError(
              `Failed to resolve default cookbook after conflict: ${concurrentError.message}`,
            );
          }

          if (concurrentDefault) {
            return concurrentDefault.id;
          }
        }

        attempt += 1;
        continue;
      }

      if (createError) {
        throw new SessionServiceError(`Failed to create default cookbook: ${createError.message}`);
      }
    }

    const { data: fallbackCookbook, error: fallbackError } = await this.supabase
      .from('cookbooks')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      throw new SessionServiceError(
        `Failed to resolve fallback cookbook: ${fallbackError.message}`,
      );
    }

    if (!fallbackCookbook) {
      throw new SessionServiceError('Unable to determine target cookbook for migration');
    }

    return fallbackCookbook.id;
  }

  private async fetchAnonymousDrafts(sessionId: string): Promise<AnonymousRecipeWithRelations[]> {
    const { data, error } = await this.supabase
      .from('anonymous_recipes')
      .select(
        `
          id,
          title,
          preparation_description,
          image_url,
          image_alt_text,
          prep_time_minutes,
          display_order,
          created_at,
          updated_at,
          anonymous_recipe_ingredients (
            id,
            recipe_id,
            ingredient_id,
            name,
            quantity,
            notes,
            display_order,
            created_at,
            updated_at
          ),
          anonymous_recipe_tags (
            recipe_id,
            tag_id,
            created_at
          )
        `,
      )
      .eq('session_id', sessionId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new SessionServiceError(`Failed to load anonymous recipes: ${error.message}`);
    }

    const drafts = (data ?? []) as unknown as AnonymousRecipeWithRelations[];

    if (drafts.length === 0) {
      throw new AnonymousRecipesNotFoundError();
    }

    return drafts.map((draft) => ({
      ...draft,
      anonymous_recipe_ingredients: [...(draft.anonymous_recipe_ingredients ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
      anonymous_recipe_tags: draft.anonymous_recipe_tags ?? [],
    }));
  }

  private buildMigrationPayloads(
    drafts: AnonymousRecipeWithRelations[],
    destinationCookbookId: string,
  ): {
    recipeRows: RecipeInsertRow[];
    ingredientRows: RecipeIngredientInsertRow[];
    tagRows: RecipeTagInsertRow[];
    recipeIds: string[];
  } {
    const recipeRows: RecipeInsertRow[] = [];
    const ingredientRows: RecipeIngredientInsertRow[] = [];
    const tagRows: RecipeTagInsertRow[] = [];
    const recipeIds: string[] = [];

    drafts.forEach((draft, index) => {
      const recipeId = randomUUID();
      recipeIds.push(recipeId);

      recipeRows.push({
        id: recipeId,
        cookbook_id: destinationCookbookId,
        title: draft.title,
        preparation_description: draft.preparation_description,
        image_url: draft.image_url,
        image_alt_text: draft.image_alt_text,
        prep_time_minutes: draft.prep_time_minutes,
        display_order: draft.display_order ?? index,
        created_at: draft.created_at ?? undefined,
        updated_at: draft.updated_at ?? undefined,
      });

      (draft.anonymous_recipe_ingredients ?? []).forEach((ingredient) => {
        ingredientRows.push({
          id: randomUUID(),
          recipe_id: recipeId,
          display_order: ingredient.display_order,
          name: ingredient.name,
          quantity: ingredient.quantity,
          notes: ingredient.notes,
          ingredient_id: ingredient.ingredient_id,
          created_at: ingredient.created_at ?? undefined,
          updated_at: ingredient.updated_at ?? undefined,
        });
      });

      (draft.anonymous_recipe_tags ?? []).forEach((tag) => {
        if (!tag.tag_id) {
          return;
        }
        tagRows.push({
          recipe_id: recipeId,
          tag_id: tag.tag_id,
          created_at: tag.created_at ?? draft.created_at ?? undefined,
        });
      });
    });

    return { recipeRows, ingredientRows, tagRows, recipeIds };
  }

  private async rollbackInsertedRecipes(recipeIds: string[]): Promise<void> {
    if (recipeIds.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(recipeIds));

    const { error: tagDeleteError } = await this.supabase
      .from('recipe_tags')
      .delete()
      .in('recipe_id', uniqueIds);

    if (tagDeleteError) {
      console.error('Failed to rollback recipe tags after migration failure', tagDeleteError);
    }

    const { error: ingredientDeleteError } = await this.supabase
      .from('recipe_ingredients')
      .delete()
      .in('recipe_id', uniqueIds);

    if (ingredientDeleteError) {
      console.error(
        'Failed to rollback recipe ingredients after migration failure',
        ingredientDeleteError,
      );
    }

    const { error: recipeDeleteError } = await this.supabase
      .from('recipes')
      .delete()
      .in('id', uniqueIds);

    if (recipeDeleteError) {
      console.error('Failed to rollback recipes after migration failure', recipeDeleteError);
    }
  }

  private async cleanupAnonymousDrafts(recipeIds: string[]): Promise<void> {
    if (recipeIds.length === 0) {
      return;
    }

    const uniqueIds = Array.from(new Set(recipeIds));

    const { error: ingredientDeleteError } = await this.supabase
      .from('anonymous_recipe_ingredients')
      .delete()
      .in('recipe_id', uniqueIds);

    if (ingredientDeleteError) {
      console.error(
        'Failed to cleanup anonymous recipe ingredients after migration',
        ingredientDeleteError,
      );
    }

    const { error: tagDeleteError } = await this.supabase
      .from('anonymous_recipe_tags')
      .delete()
      .in('recipe_id', uniqueIds);

    if (tagDeleteError) {
      console.error(
        'Failed to cleanup anonymous recipe tags after migration',
        tagDeleteError,
      );
    }

    const { error: recipeDeleteError } = await this.supabase
      .from('anonymous_recipes')
      .delete()
      .in('id', uniqueIds);

    if (recipeDeleteError) {
      console.error('Failed to cleanup anonymous recipes after migration', recipeDeleteError);
    }
  }
}


