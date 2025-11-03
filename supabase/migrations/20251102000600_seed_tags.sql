-- Migration: Seed Predefined Tags
-- Purpose: Insert initial tag taxonomy for recipe categorization
-- Affected Tables: tags
-- Special Considerations: Tags are administrator-managed; modifications require database migrations

-- ============================================================================
-- SEED DATA: Predefined Recipe Tags
-- Description: Initial set of tags based on PRD requirements
-- ============================================================================

-- insert predefined tags with slug, label, icon, and description
insert into tags (slug, label, icon, description) values
  ('quick_tag', 'Quick (≤45 min)', '⚡', 'Recipes that can be prepared in 45 minutes or less'),
  ('long_rest', 'Long Rest (>12h)', '🕐', 'Recipes requiring more than 12 hours of passive time'),
  ('vegetarian', 'Vegetarian', '🥗', 'Contains no meat or fish'),
  ('vegan', 'Vegan', '🌱', 'Contains no animal products'),
  ('gluten_free', 'Gluten-Free', '🌾', 'Contains no gluten'),
  ('dairy_free', 'Dairy-Free', '🥛', 'Contains no dairy products'),
  ('one_pot', 'One Pot', '🍲', 'Minimal cleanup with single cooking vessel'),
  ('baking', 'Baking', '🍰', 'Baked goods and desserts'),
  ('breakfast', 'Breakfast', '🍳', 'Morning meals'),
  ('dinner', 'Dinner', '🍽️', 'Evening meals'),
  ('appetizer', 'Appetizer', '🥨', 'Starters and small bites'),
  ('dessert', 'Dessert', '🍨', 'Sweet treats');
