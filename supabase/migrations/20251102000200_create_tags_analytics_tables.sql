-- Migration: Create Tags and Analytics Tables
-- Purpose: Establish predefined tag taxonomy and analytics event logging
-- Affected Tables: tags, recipe_tags, analytics_events
-- Special Considerations: Tags are administrator-managed; analytics_events supports anonymous tracking

-- ============================================================================
-- TABLE: tags
-- Description: Predefined taxonomy for recipe categorization
-- ============================================================================
create table tags (
  id uuid primary key default gen_random_uuid(),
  -- url-safe identifier (e.g., "quick_tag", "vegetarian")
  slug text not null unique,
  -- display name (e.g., "Quick (≤45 min)", "Vegetarian")
  label text not null,
  -- icon identifier for ui rendering (e.g., "⚡", "🥗")
  icon text,
  -- tag explanation for accessibility
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- enable row level security (policies will be applied in separate migration)
alter table tags enable row level security;

-- ============================================================================
-- TABLE: recipe_tags
-- Description: Many-to-many relationship between recipes and tags
-- ============================================================================
create table recipe_tags (
  recipe_id uuid not null references recipes(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  -- prevent duplicate tag assignments to the same recipe
  primary key (recipe_id, tag_id)
);

-- enable row level security (policies will be applied in separate migration)
alter table recipe_tags enable row level security;

-- ============================================================================
-- TABLE: analytics_events
-- Description: Optional analytics event log for engagement tracking
-- ============================================================================
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  -- user_id is null for anonymous events
  user_id uuid references auth.users(id) on delete set null,
  -- session_id tracks anonymous or authenticated sessions
  session_id text not null,
  -- event name (e.g., "recipe_parse_success", "recipe_save")
  event_type text not null,
  -- structured event metadata stored as jsonb for flexibility
  event_data jsonb,
  created_at timestamptz not null default now()
);

-- enable row level security (policies will be applied in separate migration)
alter table analytics_events enable row level security;
