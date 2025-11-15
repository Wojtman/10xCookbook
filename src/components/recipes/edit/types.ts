import type { AIParseResponseDTO, RecipeDetailDTO, RecipeIngredientDTO, TagDTO } from "@/types";

export type PreviewSource = "current" | "aiDraft";

export interface IngredientFormItem {
  uuid: string;
  displayOrder: number;
  name: string;
  quantity?: string;
  notes?: string;
  ingredientId?: string | null;
}

export interface ImageUploadState {
  imageUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
  altText: string;
  uploading: boolean;
}

export interface AIState {
  status: "idle" | "loading" | "success" | "timeout" | "error";
  startedAt?: number;
  durationMs?: number;
  errorCode?: string;
  message?: string;
}

export interface SaveState {
  status: "idle" | "saving" | "success" | "error";
  error?: string;
  lastSavedAt?: string;
}

export interface FormValidationState {
  fields: Record<string, string | undefined>;
  isValid: boolean;
}

export interface RecipeFormState {
  id: string;
  cookbookId: string;
  title: string;
  rawText: string;
  preparationDescription: string;
  prepTimeMinutes: number | null;
  image: ImageUploadState | null;
  imageAltText: string;
  ingredients: IngredientFormItem[];
  tagIds: string[];
  aiDraft: AIParseResponseDTO | null;
  aiSuggestedTags: string[];
  aiStatus: AIState["status"];
  aiError?: string;
  updatedAt: string;
  isDirty: boolean;
}

export interface TagOption {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
  description?: string | null;
  selected: boolean;
}

export interface RecipeEditSnapshot {
  recipe: RecipeDetailDTO;
  form: RecipeFormState;
}

export interface RecipeEditData {
  recipe: RecipeDetailDTO;
  tags: TagDTO[];
}
