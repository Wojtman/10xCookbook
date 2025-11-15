import type { SupabaseClient } from "../../db/supabase.client";
import type { TagDTO, TagListResponseDTO } from "../../types";
import { isUuid } from "../validation/tag.validator";

/**
 * Error thrown when a tag lookup by identifier yields no result.
 */
export class TagNotFoundError extends Error {
  constructor(public readonly identifier: string) {
    super(`Tag not found for identifier "${identifier}"`);
    this.name = "TagNotFoundError";
  }
}

/**
 * Error representing an unexpected Supabase failure within the tag service layer.
 */
export class TagServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TagServiceError";
  }
}

/**
 * Fetches the complete tag collection ordered by label, along with the total count.
 *
 * @param client - Supabase client scoped to the current request context
 * @returns Tag list DTO containing ordered tags and total row count
 * @throws TagServiceError when Supabase returns an error or an unexpected response shape
 */
export async function fetchAllTags(client: SupabaseClient): Promise<TagListResponseDTO> {
  const query = client.from("tags").select("*", { count: "exact" }).order("label", { ascending: true });

  const { data, error, count } = await query;

  if (error) {
    throw new TagServiceError("Failed to fetch tags from Supabase", error);
  }

  if (!Array.isArray(data)) {
    throw new TagServiceError("Supabase returned an unexpected response when fetching tags");
  }

  return {
    tags: data as TagDTO[],
    total: typeof count === "number" ? count : data.length,
  };
}

/**
 * Fetches a single tag by UUID or slug identifier.
 *
 * @param client - Supabase client scoped to the current request context
 * @param identifier - UUID or slug identifying the tag
 * @returns The matching tag DTO
 * @throws TagNotFoundError when no tag matches the provided identifier
 * @throws TagServiceError when Supabase returns an error
 */
export async function fetchTagByIdentifier(client: SupabaseClient, identifier: string): Promise<TagDTO> {
  const baseQuery = client.from("tags").select("*").limit(1);

  const refinedQuery = isUuid(identifier) ? baseQuery.eq("id", identifier) : baseQuery.eq("slug", identifier);

  const { data, error } = await refinedQuery.maybeSingle<TagDTO>();

  if (error) {
    throw new TagServiceError(`Failed to fetch tag "${identifier}" from Supabase`, error);
  }

  if (!data) {
    throw new TagNotFoundError(identifier);
  }

  return data;
}
