import type {
  AIParseResponseDTO,
  CreateRecipeCommand,
  ImageUploadResponseDTO,
  RecipeIngredientInput,
  TagDTO,
} from '@/types';

export interface IngredientItemViewModel extends Omit<RecipeIngredientInput, 'display_order'> {
  id: string;
  display_order: number;
  error?: string;
}

export interface RecipeFormViewModel {
  title: string;
  preparationDescription: string;
  prepTimeMinutes?: number;
  ingredients: IngredientItemViewModel[];
  image?: ImageUploadResponseDTO | null;
  imageAltText: string;
  tagIds: string[];
  displayOrder?: number;
  isAiAssisted: boolean;
  aiSuggestedTagSlugs: string[];
}

export interface RawTextState {
  value: string;
  charCount: number;
}

export type AIParseStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout';

export interface AIParseError {
  code: string;
  message: string;
}

export interface FormValidationState {
  fields: Record<string, string | undefined>;
  isValid: boolean;
}

export interface ImageUploadState {
  data?: ImageUploadResponseDTO | null;
  uploading: boolean;
  error?: string;
}

export interface SaveRecipePayload extends CreateRecipeCommand {
  tag_ids: string[];
  ingredients: RecipeIngredientInput[];
  is_ai_assisted: boolean;
}

export interface TagOptionsState {
  tags: TagDTO[];
  isLoading: boolean;
  error?: string;
}

export interface RegistrationPromptState {
  visible: boolean;
  hasDismissed: boolean;
}

export type RegistrationPromptAction = 'register' | 'dismiss' | 'remind_later';

export interface UseRegistrationPromptArgs {
  isAnonymous: boolean;
}

export interface UseRegistrationPromptResult extends RegistrationPromptState {
  open: () => void;
  dismiss: () => void;
  remindLater: () => void;
  trackAiSuccess: () => void;
  trackLocalRecipeCreated: () => void;
}

export interface UseTagOptionsResult extends TagOptionsState {
  refresh: () => Promise<void>;
}

export interface UseRecipeFormArgs {
  initialState?: Partial<RecipeFormViewModel>;
  aiResult?: AIParseResponseDTO | null;
}

export interface UseRecipeFormResult {
  state: RecipeFormViewModel;
  validation: FormValidationState;
  isDirty: boolean;
  isSaveDisabled: boolean;
  updateField: <K extends keyof RecipeFormViewModel>(
    field: K,
    value: RecipeFormViewModel[K],
  ) => void;
  updateIngredient: (id: string, updates: Partial<IngredientItemViewModel>) => void;
  addIngredient: () => void;
  removeIngredient: (id: string) => void;
  reorderIngredients: (ids: string[]) => void;
  setImage: (image: ImageUploadResponseDTO | null) => void;
  setValidationErrors: (errors: Record<string, string | undefined>) => void;
  applyAiResult: (result: AIParseResponseDTO) => void;
  resetWithAi: (result: AIParseResponseDTO) => void;
  reset: () => void;
  hydrate: (state: RecipeFormViewModel) => void;
}

export interface UseAIParseArgs {
  sessionId?: string | null;
  analyticsSessionId?: string | null;
  onSuccess?: (result: AIParseResponseDTO) => void;
  onError?: (error: AIParseError) => void;
}

export interface UseAIParseResult {
  status: AIParseStatus;
  error?: AIParseError;
  elapsedMs?: number;
  parse: (rawText: string) => Promise<AIParseResponseDTO | null>;
  cancel: () => void;
}

export interface UseImageUploadArgs {
  sessionId?: string | null;
  analyticsSessionId?: string | null;
  onUploadComplete?: (image: ImageUploadResponseDTO) => void;
  onError?: (message: string) => void;
}

export interface UseImageUploadResult extends ImageUploadState {
  upload: (file: File) => Promise<ImageUploadResponseDTO | null>;
  remove: () => void;
}


