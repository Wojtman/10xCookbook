import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { Button } from '@/components/ui/button';

import type {
  FormValidationState,
  IngredientItemViewModel,
  RecipeFormViewModel,
} from '../types';
import type { IngredientCatalogDTO, TagDTO } from '@/types';
import { TagDropdown } from './TagDropdown';

interface RecipeFormProps {
  mode: 'create' | 'edit';
  formState: RecipeFormViewModel;
  validationState: FormValidationState;
  availableTags: TagDTO[];
  isSaving: boolean;
  isSaveDisabled: boolean;
  imageUploading: boolean;
  imageError?: string;
  saveError?: string;
  onTriggerImageSelect: () => void;
  onFieldChange: <K extends keyof RecipeFormViewModel>(field: K, value: RecipeFormViewModel[K]) => void;
  onIngredientChange: (id: string, updates: Partial<IngredientItemViewModel>) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onToggleTag: (tagId: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onRemoveImage: () => void;
  onReorderIngredients: (ids: string[]) => void;
  onDiscard?: () => void;
  isDirty?: boolean;
  lastSavedAt?: string;
}

export function RecipeForm({
  mode,
  formState,
  validationState,
  availableTags,
  isSaving,
  isSaveDisabled,
  imageUploading,
  imageError,
  saveError,
  onTriggerImageSelect,
  onFieldChange,
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient,
  onToggleTag,
  onSubmit,
  onCancel,
  onRemoveImage,
  onReorderIngredients,
  onDiscard,
  isDirty = false,
  lastSavedAt,
}: RecipeFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const moveIngredient = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= formState.ingredients.length) {
      return;
    }
    const ids = formState.ingredients.map(ingredient => ingredient.id);
    const currentId = ids[index];
    ids[index] = ids[nextIndex];
    ids[nextIndex] = currentId;
    onReorderIngredients(ids);
  };

  const saveButtonLabel = mode === 'edit' ? 'Save changes' : 'Save recipe';
  const secondaryButtonLabel = mode === 'edit' ? 'Discard changes' : 'Cancel';
  const canUseDiscard = mode === 'edit' && typeof onDiscard === 'function';

  const formattedLastSaved =
    mode === 'edit' && lastSavedAt
      ? new Date(lastSavedAt).toLocaleString()
      : undefined;

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="flex flex-col gap-2 rounded-lg border border-[rgba(72,44,20,0.1)] bg-[rgba(255,253,244,0.85)] p-4 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(72,44,20,0.18)] bg-[rgba(255,250,235,0.9)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
            {mode === 'edit' ? 'Edit Mode' : 'Create Mode'}
          </span>
          {formattedLastSaved ? (
            <span className="text-xs text-ink-soft">
              Last saved {formattedLastSaved}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-ink-soft">
          Update the recipe details below. Fields marked with an asterisk are required.
        </p>
      </header>
      <section className="grid gap-4 rounded-lg border border-[rgba(72,44,20,0.12)] bg-[rgba(255,254,248,0.8)] p-4 shadow-inner ">
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput
            label="Title"
            required
            value={formState.title}
            error={validationState.fields.title}
            onChange={value => onFieldChange('title', value)}
          />
          <LabeledInput
            label="Prep Time (minutes)"
            type="number"
            min={0}
            value={formState.prepTimeMinutes?.toString() ?? ''}
            error={validationState.fields.prepTimeMinutes}
            onChange={value => {
              const parsed = value === '' ? undefined : Number.parseInt(value, 10);
              onFieldChange('prepTimeMinutes', Number.isFinite(parsed as number) ? (parsed as number) : undefined);
            }}
          />
          <div className="sm:col-span-2">
            <LabeledTextarea
              label="Preparation Description"
              rows={5}
              required
              value={formState.preparationDescription}
              error={validationState.fields.preparationDescription}
              onChange={value => onFieldChange('preparationDescription', value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(72,44,20,0.12)] bg-[rgba(255,254,248,0.82)] p-4 shadow-inner">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <LabelHeading text="Cover Image" />
              {formState.image ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveImage}
                  disabled={isSaving || imageUploading}
                >
                  Remove image
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3 rounded-md border border-[rgba(72,44,20,0.18)] bg-[rgba(255,253,244,0.85)] p-4">
              <div className="flex w-full items-center justify-center overflow-hidden rounded-md border border-[rgba(72,44,20,0.12)] bg-white/80">
                {formState.image ? (
                  <img
                    src={formState.image.image_url}
                    alt={formState.imageAltText || 'Recipe cover image'}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <p className="py-10 text-xs text-ink-soft">No image selected.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onTriggerImageSelect}
                  disabled={imageUploading || isSaving}
                >
                  {imageUploading ? 'Uploading…' : formState.image ? 'Replace image' : 'Upload image'}
                </Button>
                {imageUploading ? (
                  <span className="text-xs text-ink-soft">Uploading new image…</span>
                ) : null}
              </div>
              <LabeledInput
                label="Image Alt Text"
                required={Boolean(formState.image)}
                value={formState.imageAltText}
                error={validationState.fields.imageAltText}
                onChange={value => onFieldChange('imageAltText', value)}
              />
              {imageError ? (
                <p className="text-xs text-[rgba(143,58,32,0.9)]" role="alert">
                  {imageError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <LabelHeading text="Tags" />
            <TagDropdown availableTags={availableTags} selectedTagIds={formState.tagIds} onToggle={onToggleTag} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(72,44,20,0.12)] bg-[rgba(255,254,248,0.8)] p-3 shadow-inner">
        <div className="flex items-center justify-between">
          <LabelHeading text="Ingredients" />
          <Button type="button" variant="secondary" size="sm" onClick={onAddIngredient}>
            Add ingredient
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {formState.ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.id}
              index={index + 1}
              item={ingredient}
              error={validationState.fields[`ingredients.${ingredient.id}`]}
              onChange={updates => onIngredientChange(ingredient.id, updates)}
              onRemove={() => onRemoveIngredient(ingredient.id)}
              onMoveUp={() => moveIngredient(index, -1)}
              onMoveDown={() => moveIngredient(index, 1)}
              disableMoveUp={index === 0}
              disableMoveDown={index === formState.ingredients.length - 1}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(72,44,20,0.08)] pt-4">
        {canUseDiscard ? (
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={isSaving || !isDirty}>
            {secondaryButtonLabel}
          </Button>
        ) : onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
            {secondaryButtonLabel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSaveDisabled || isSaving}>
          {isSaving ? 'Saving…' : saveButtonLabel}
        </Button>
      </div>
      {saveError ? (
        <p className="text-sm text-[rgba(143,58,32,0.9)]" role="alert">
          {saveError}
        </p>
      ) : null}
    </form>
  );
}

interface LabelHeadingProps {
  text: string;
}

function LabelHeading({ text }: LabelHeadingProps) {
  return <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">{text}</h2>;
}

interface LabeledInputProps {
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function LabeledInput({ label, type = 'text', required, min, value, error, onChange }: LabeledInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
        {label}
        <input
          className="book-input mt-1 w-full rounded-md border border-[rgba(72,44,20,0.2)] bg-[rgba(255,252,244,0.9)] px-3 py-2 text-sm text-ink shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.6)]"
          type={type}
          min={min}
          required={required}
          value={value}
          onChange={handleChange}
        />
      </label>
      {error ? (
        <p className="text-xs text-[rgba(143,58,32,0.9)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface LabeledTextareaProps {
  label: string;
  rows?: number;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function LabeledTextarea({ label, rows = 4, required, value, error, onChange }: LabeledTextareaProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
        {label}
        <textarea
          className="book-input mt-1 w-full rounded-md border border-[rgba(72,44,20,0.2)] bg-[rgba(255,252,244,0.9)] px-3 py-2 text-sm text-ink shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.6)]"
          rows={rows}
          required={required}
          value={value}
          onChange={handleChange}
        />
      </label>
      {error ? (
        <p className="text-xs text-[rgba(143,58,32,0.9)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface IngredientRowProps {
  index: number;
  item: IngredientItemViewModel;
  error?: string;
  onChange: (updates: Partial<IngredientItemViewModel>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableMoveUp: boolean;
  disableMoveDown: boolean;
}

function IngredientRow({
  index,
  item,
  error,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: IngredientRowProps) {
  const [suggestions, setSuggestions] = useState<IngredientCatalogDTO[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);

  const fetchController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameFieldRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const actionButtonClasses =
    'flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(72,44,20,0.2)] bg-white text-xs text-ink-soft hover:border-[rgba(72,44,20,0.35)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40';
  const removeButtonClasses =
    'flex h-7 items-center justify-center rounded-md border border-[rgba(143,58,32,0.35)] bg-[rgba(143,58,32,0.06)] px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(143,58,32,0.9)] hover:bg-[rgba(143,58,32,0.12)]';

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ quantity: event.target.value });
  };

  const handleNotesChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ notes: event.target.value });
  };

  const closeSuggestions = () => {
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const handleNameFocus = () => {
    if (suggestions.length > 0 || isSearching) {
      setShowSuggestions(true);
    }
  };

  const handleNameInput = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange({
      name: value,
      ingredient_id: null,
    });
    if (value.trim().length === 0) {
      setSuggestions([]);
      closeSuggestions();
      return;
    }
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (suggestion: IngredientCatalogDTO) => {
    onChange({
      name: suggestion.name,
      ingredient_id: suggestion.id,
    });
    setSuggestions([]);
    closeSuggestions();
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
        if (suggestions.length > 0) {
          setActiveSuggestion(0);
        }
        return;
      }
      if (suggestions.length > 0) {
        setActiveSuggestion(prev => {
          const next = prev + 1;
          return next >= suggestions.length ? 0 : next;
        });
      }
      return;
    }

    if (event.key === 'ArrowUp' && showSuggestions) {
      event.preventDefault();
      if (suggestions.length > 0) {
        setActiveSuggestion(prev => {
          if (prev <= 0) {
            return suggestions.length - 1;
          }
          return prev - 1;
        });
      }
      return;
    }

    if (event.key === 'Enter' && showSuggestions && activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
      event.preventDefault();
      handleSelectSuggestion(suggestions[activeSuggestion]);
      return;
    }

    if (event.key === 'Escape') {
      closeSuggestions();
    }
  };

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [suggestions]);

  useEffect(() => {
    const term = item.name.trim();

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    fetchController.current?.abort();

    if (term.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      fetchController.current = controller;

      try {
        const response = await fetch(`/api/ingredients/search?q=${encodeURIComponent(term)}&limit=8`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Failed to fetch ingredient suggestions');
        }
        const data = (await response.json()) as { ingredients?: IngredientCatalogDTO[] };
        setSuggestions(Array.isArray(data.ingredients) ? data.ingredients : []);
        setShowSuggestions(true);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error(error);
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      fetchController.current?.abort();
    };
  }, [item.name]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!nameFieldRef.current || !nameFieldRef.current.contains(event.target as Node)) {
        closeSuggestions();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  return (
    <div className="rounded-md border border-[rgba(72,44,20,0.12)] bg-[rgba(255,252,244,0.85)] p-2 shadow-inner">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-ink-soft">
        <span>Ingredient {index}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={actionButtonClasses}
            onClick={onMoveUp}
            disabled={disableMoveUp}
            aria-label="Move ingredient up"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className={actionButtonClasses}
            onClick={onMoveDown}
            disabled={disableMoveDown}
            aria-label="Move ingredient down"
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" className={removeButtonClasses} onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[1.5fr_1fr_1fr]">
        <div ref={nameFieldRef} className="relative">
          <input
            ref={nameInputRef}
            className="book-input w-full rounded-md border border-[rgba(72,44,20,0.18)] bg-white px-3 py-2 text-sm text-ink shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(248,232,196,0.8)]"
            placeholder="Name"
            aria-label="Ingredient name"
            autoComplete="off"
            value={item.name}
            onChange={handleNameInput}
            onKeyDown={handleNameKeyDown}
            onFocus={handleNameFocus}
          />
          {showSuggestions && (isSearching || suggestions.length > 0) ? (
            <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-[rgba(72,44,20,0.2)] bg-[rgba(255,252,244,0.98)] shadow-lg">
              {isSearching ? (
                <div className="px-3 py-2 text-xs text-ink-soft">Searching ingredients…</div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-ink-soft">No matching ingredients found.</div>
              ) : (
                suggestions.map((suggestion, suggestionIndex) => {
                  const isActive = suggestionIndex === activeSuggestion;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-[rgba(248,232,196,0.45)] text-ink' : 'text-ink-soft hover:bg-[rgba(248,232,196,0.3)] hover:text-ink'
                      }`}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <span className="font-medium text-ink">{suggestion.name}</span>
                      {suggestion.description ? (
                        <span className="text-xs text-ink-soft">{suggestion.description}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
        <IngredientInput
          placeholder="Quantity"
          value={item.quantity ?? ''}
          onChange={handleQuantityChange}
          ariaLabel="Ingredient quantity"
        />
        <IngredientInput
          placeholder="Notes"
          value={item.notes ?? ''}
          onChange={handleNotesChange}
          ariaLabel="Ingredient notes"
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs text-[rgba(143,58,32,0.9)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface IngredientInputProps {
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
}

function IngredientInput({ placeholder, value, onChange, ariaLabel }: IngredientInputProps) {
  return (
    <input
      className="book-input rounded-md border border-[rgba(72,44,20,0.18)] bg-white px-3 py-2 text-sm text-ink shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(248,232,196,0.8)]"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
    />
  );
}


