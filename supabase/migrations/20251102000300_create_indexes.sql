-- Migration: Create Performance Indexes
-- Purpose: Add indexes for common query patterns and enforce unique constraints
-- Affected Tables: cookbooks, recipes, recipe_ingredients, recipe_tags, ingredients, analytics_events
-- Special Considerations: Minimal indexing strategy for low initial volume; prepared for future scaling

-- ============================================================================
-- INDEXES: cookbooks
-- ============================================================================

-- cookbook ownership lookup for filtering user's cookbooks
create index idx_cookbooks_user_id on cookbooks(user_id);

-- partial unique index enforces single default cookbook per user
-- only indexes rows where is_default = true, avoiding check constraint complexity
create unique index idx_cookbooks_user_default 
  on cookbooks(user_id) 
  where is_default = true;

-- ============================================================================
-- INDEXES: recipes
-- ============================================================================

-- recipe lookups by cookbook for listing all recipes in a collection
create index idx_recipes_cookbook_id on recipes(cookbook_id);

-- composite index supports ordered recipe retrieval within cookbook
create index idx_recipes_display_order on recipes(cookbook_id, display_order);

-- ============================================================================
-- INDEXES: recipe_ingredients
-- ============================================================================

-- ingredient lookups by recipe for retrieving recipe ingredient lists
create index idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);

-- composite index supports ordered ingredient retrieval within recipe
create index idx_recipe_ingredients_display_order on recipe_ingredients(recipe_id, display_order);

-- ============================================================================
-- INDEXES: recipe_tags
-- ============================================================================

-- tag lookups by recipe for retrieving all tags assigned to a recipe
create index idx_recipe_tags_recipe_id on recipe_tags(recipe_id);

-- recipe lookups by tag for filtering recipes by specific tags
create index idx_recipe_tags_tag_id on recipe_tags(tag_id);

-- ============================================================================
-- INDEXES: ingredients
-- ============================================================================

-- trigram index prepared for fuzzy ingredient matching when volume grows
-- requires pg_trgm extension enabled in previous migration
-- enables similarity search like: select * from ingredients where name % 'tomatoe'
create index idx_ingredients_name_trgm on ingredients using gin(name gin_trgm_ops);

-- ============================================================================
-- INDEXES: analytics_events
-- ============================================================================

-- analytics queries by user for user-specific event tracking
create index idx_analytics_events_user_id on analytics_events(user_id);

-- analytics queries by session for tracking anonymous and authenticated sessions
create index idx_analytics_events_session_id on analytics_events(session_id);

-- analytics queries by event type for filtering specific events
create index idx_analytics_events_event_type on analytics_events(event_type);

-- time-based analytics queries (descending for recent-first sorting)
create index idx_analytics_events_created_at on analytics_events(created_at desc);
