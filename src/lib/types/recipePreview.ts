import type { RecipeIngredientDTO, TagDTO } from '@/types';

/**
 * View model for sidebar recipe list items.
 * Simplifies the payload used to render the recipe list.
 */
export interface SidebarRecipeListItemVM {
  id: string;
  title: string;
  ingredientCount: number;
  tags: Array<Pick<TagDTO, 'id' | 'slug' | 'label' | 'icon'>>;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * View model for recipe preview cards in the spread.
 */
export interface RecipePreviewVM {
  id: string;
  title: string;
  preparationDescription: string;
  imageUrl?: string | null;
  imageAltText?: string | null;
  ingredients: RecipeIngredientDTO[];
  tags: TagDTO[];
  prepTimeMinutes?: number | null;
}

/**
 * View model describing spread pagination state.
 */
export interface SpreadPaginationVM {
  page: number;
  limitPerSpread: number;
  total: number;
  totalSpreads: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface RecipeListQueryState {
  page: number;
  sort: 'display_order' | 'created_at' | 'updated_at' | 'title' | 'prep_time_minutes';
  order: 'asc' | 'desc';
  tags?: string;
  search?: string;
}

