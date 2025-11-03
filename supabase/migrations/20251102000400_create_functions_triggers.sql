-- Migration: Create Functions and Triggers
-- Purpose: Implement automatic timestamp updates for data modification tracking
-- Affected Tables: cookbooks, recipes, ingredients, recipe_ingredients, tags
-- Special Considerations: Function is reusable; triggers applied to all tables with updated_at column

-- ============================================================================
-- FUNCTION: update_updated_at_column
-- Description: Automatically sets updated_at to current timestamp on row updates
-- ============================================================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  -- set updated_at to current timestamp whenever row is updated
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- TRIGGER: cookbooks automatic timestamp update
-- ============================================================================

create trigger update_cookbooks_updated_at
  before update on cookbooks
  for each row
  execute function update_updated_at_column();

-- ============================================================================
-- TRIGGER: recipes automatic timestamp update
-- ============================================================================

create trigger update_recipes_updated_at
  before update on recipes
  for each row
  execute function update_updated_at_column();

-- ============================================================================
-- TRIGGER: ingredients automatic timestamp update
-- ============================================================================

create trigger update_ingredients_updated_at
  before update on ingredients
  for each row
  execute function update_updated_at_column();

-- ============================================================================
-- TRIGGER: recipe_ingredients automatic timestamp update
-- ============================================================================

create trigger update_recipe_ingredients_updated_at
  before update on recipe_ingredients
  for each row
  execute function update_updated_at_column();

-- ============================================================================
-- TRIGGER: tags automatic timestamp update
-- ============================================================================

create trigger update_tags_updated_at
  before update on tags
  for each row
  execute function update_updated_at_column();
