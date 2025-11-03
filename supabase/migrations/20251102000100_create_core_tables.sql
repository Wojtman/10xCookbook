-- Migration: Create Core Tables (Cookbooks, Recipes, Ingredients, Recipe Ingredients)
-- Purpose: Establish the foundational schema for personal recipe collections
-- Affected Tables: cookbooks, recipes, ingredients, recipe_ingredients
-- Special Considerations: Tables will have RLS enabled but policies applied in a separate migration

-- ============================================================================
-- TABLE: cookbooks
-- Description: Personal recipe collections for registered users
-- ============================================================================
create table cookbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- prevent duplicate cookbook names per user
  constraint unique_user_cookbook_title unique (user_id, title)
);

-- enable row level security (policies will be applied in separate migration)
alter table cookbooks enable row level security;

-- ============================================================================
-- TABLE: recipes
-- Description: Individual recipes within cookbooks
-- ============================================================================
create table recipes (
  id uuid primary key default gen_random_uuid(),
  cookbook_id uuid not null references cookbooks(id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  image_alt_text text,
  prep_time_minutes integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- ensure title is non-empty after trimming whitespace
  constraint check_title_not_empty check (length(trim(title)) > 0),
  
  -- limit description to 5,000 characters
  constraint check_description_length check (length(description) <= 5000),
  
  -- prep time must be non-negative
  constraint check_prep_time_positive check (prep_time_minutes >= 0)
);

-- enable row level security (policies will be applied in separate migration)
alter table recipes enable row level security;

-- ============================================================================
-- TABLE: ingredients
-- Description: Global catalog of ingredients for normalization and future enrichment
-- ============================================================================
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  -- citext enables case-insensitive searches and uniqueness
  name citext not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- enable row level security (policies will be applied in separate migration)
alter table ingredients enable row level security;

-- ============================================================================
-- TABLE: recipe_ingredients
-- Description: Ordered list of ingredients for each recipe with flexible catalog linkage
-- ============================================================================
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  display_order integer not null,
  -- nullable ingredient_id allows custom/free-text ingredients
  -- on delete set null preserves data if catalog entry is removed
  ingredient_id uuid references ingredients(id) on delete set null,
  -- name is always stored to preserve data if catalog entries change
  name text not null,
  quantity text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- ensure name is non-empty after trimming whitespace
  constraint check_name_not_empty check (length(trim(name)) > 0),
  
  -- display_order must be non-negative
  constraint check_display_order_positive check (display_order >= 0),
  
  -- enforce unique ordering within each recipe
  constraint unique_recipe_ingredient_order unique (recipe_id, display_order)
);

-- enable row level security (policies will be applied in separate migration)
alter table recipe_ingredients enable row level security;
