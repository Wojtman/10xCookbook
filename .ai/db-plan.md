# 10xCookbook Database Schema

## 1. Tables

### users
Managed by Supabase Auth. Reference via `auth.users(id)`.

### cookbooks
Personal recipe collections for registered users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique cookbook identifier |
| user_id | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the cookbook |
| title | TEXT | NOT NULL | Cookbook name |
| is_default | BOOLEAN | NOT NULL, DEFAULT false | Future support for default cookbook |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

**Constraints:**
- UNIQUE (user_id, title) - prevent duplicate cookbook names per user
- CHECK: Only one is_default=true per user_id (partial unique index)

### recipes
Individual recipes within cookbooks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique recipe identifier |
| cookbook_id | UUID | NOT NULL, REFERENCES cookbooks(id) ON DELETE CASCADE | Parent cookbook |
| title | TEXT | NOT NULL, CHECK (length(trim(title)) > 0) | Recipe title (required, non-empty) |
| description | TEXT | NOT NULL, CHECK (length(description) <= 5000) | Recipe instructions (≤5,000 chars) |
| image_url | TEXT | NULL | Storage path or URL for recipe image |
| image_alt_text | TEXT | NULL | Image alt text for accessibility |
| prep_time_minutes | INTEGER | NULL, CHECK (prep_time_minutes >= 0) | Estimated preparation time |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | Sort order within cookbook |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

### ingredients
Global catalog of ingredients for normalization and future enrichment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique ingredient identifier |
| name | CITEXT | NOT NULL, UNIQUE | Normalized ingredient name (case-insensitive) |
| description | TEXT | NULL | Optional ingredient details |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

**Notes:**
- CITEXT extension enables case-insensitive searches and uniqueness
- Global catalog allows future dietary tagging, unit conversions, and normalization

### recipe_ingredients
Ordered list of ingredients for each recipe with flexible catalog linkage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique entry identifier |
| recipe_id | UUID | NOT NULL, REFERENCES recipes(id) ON DELETE CASCADE | Parent recipe |
| display_order | INTEGER | NOT NULL, CHECK (position >= 0) | Display order (0-indexed) |
| ingredient_id | UUID | NULL, REFERENCES ingredients(id) ON DELETE SET NULL | Link to catalog ingredient |
| name | TEXT | NOT NULL, CHECK (length(trim(name)) > 0) | Ingredient name (free-text or denormalized) |
| quantity | TEXT | NULL | Amount (e.g., "2 cups", "1 tsp") |
| notes | TEXT | NULL | Preparation notes (e.g., "diced", "optional") |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

**Constraints:**
- UNIQUE (recipe_id, position) - enforce ordering uniqueness
- Application enforces ≤50 ingredients per recipe

**Notes:**
- Nullable `ingredient_id` allows custom/free-text ingredients
- `name` is always stored to preserve data if catalog entries change
- Enables incremental migration to structured catalog over time

### tags
Predefined taxonomy for recipe categorization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique tag identifier |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier (e.g., "quick_tag", "vegetarian") |
| label | TEXT | NOT NULL | Display name (e.g., "Quick (≤45 min)", "Vegetarian") |
| icon | TEXT | NULL | Icon identifier for UI rendering |
| description | TEXT | NULL | Tag explanation for accessibility |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp |

**Notes:**
- Predefined taxonomy only (no user-created tags in MVP)
- Administrator-managed modifications

### recipe_tags
Many-to-many relationship between recipes and tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| recipe_id | UUID | NOT NULL, REFERENCES recipes(id) ON DELETE CASCADE | Recipe reference |
| tag_id | UUID | NOT NULL, REFERENCES tags(id) ON DELETE CASCADE | Tag reference |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |

**Constraints:**
- PRIMARY KEY (recipe_id, tag_id) - prevent duplicate tag assignments

### analytics_events
Optional analytics event log for engagement tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique event identifier |
| user_id | UUID | NULL, REFERENCES auth.users(id) ON DELETE SET NULL | User (NULL for anonymous) |
| session_id | TEXT | NOT NULL | Anonymous or authenticated session token |
| event_type | TEXT | NOT NULL | Event name (e.g., "recipe_parse_success") |
| event_data | JSONB | NULL | Structured event metadata |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Event timestamp |

**Constraints:**
- CHECK: event_type in predefined list or pattern validation

**Event Types (from PRD):**
- session_start, session_end
- recipe_parse_requested, recipe_parse_success, recipe_parse_timeout, recipe_parse_error
- recipe_save, recipe_edit, recipe_delete
- registration_complete, login_success

---

## 2. Relationships

```
users (Supabase Auth)
  └─── 1:N ───> cookbooks
                  └─── 1:N ───> recipes
                                  ├─── 1:N ───> recipe_ingredients
                                  │               └─── N:1 (optional) ───> ingredients
                                  └─── M:N ───> tags (via recipe_tags)

analytics_events ──── N:1 (optional) ───> users
```

### Cardinality Details
- **users → cookbooks**: One-to-many (one user owns multiple cookbooks)
- **cookbooks → recipes**: One-to-many (one cookbook contains multiple recipes)
- **recipes → recipe_ingredients**: One-to-many (one recipe has multiple ordered ingredients)
- **recipe_ingredients → ingredients**: Many-to-one optional (ingredient catalog lookup)
- **recipes ↔ tags**: Many-to-many via `recipe_tags` junction table
- **analytics_events → users**: Many-to-one optional (NULL for anonymous events)

### Cascading Deletes
- Delete cookbook → cascade to recipes → cascade to recipe_ingredients and recipe_tags
- Delete ingredient catalog entry → SET NULL on recipe_ingredients.ingredient_id (preserve name)
- Delete user → cascade to cookbooks (and downstream)
- Delete tag → cascade to recipe_tags (removes tag assignment)

---

## 3. Indexes

### Performance Indexes
```sql
-- Recipe lookups by cookbook
CREATE INDEX idx_recipes_cookbook_id ON recipes(cookbook_id);
CREATE INDEX idx_recipes_display_order ON recipes(cookbook_id, display_order);

-- Ingredient relationships
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_position ON recipe_ingredients(recipe_id, position);

-- Tag relationships
CREATE INDEX idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag_id ON recipe_tags(tag_id);

-- Cookbook ownership
CREATE INDEX idx_cookbooks_user_id ON cookbooks(user_id);

-- Ingredient catalog search (future-ready)
CREATE INDEX idx_ingredients_name_trgm ON ingredients USING gin(name gin_trgm_ops);

-- Analytics queries
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Partial unique index for default cookbook
CREATE UNIQUE INDEX idx_cookbooks_user_default 
  ON cookbooks(user_id) 
  WHERE is_default = true;
```

### Notes on Indexing Strategy
- **Low initial volume**: Minimal indexes to start; monitor query patterns
- **Trigram index** on ingredients.name prepared for fuzzy search (requires `pg_trgm` extension)
- **Composite indexes** on foreign key + sort field for common access patterns
- **Partial index** enforces single default cookbook per user without CHECK constraint complexity

---

## 4. Row-Level Security (RLS) Policies

### Enable RLS on All Tables
```sql
ALTER TABLE cookbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
```

### cookbooks Policies
```sql
-- Users can view their own cookbooks
CREATE POLICY "Users can view own cookbooks"
  ON cookbooks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cookbooks
CREATE POLICY "Users can create own cookbooks"
  ON cookbooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cookbooks
CREATE POLICY "Users can update own cookbooks"
  ON cookbooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cookbooks
CREATE POLICY "Users can delete own cookbooks"
  ON cookbooks FOR DELETE
  USING (auth.uid() = user_id);
```

### recipes Policies
```sql
-- Users can view recipes in their own cookbooks
CREATE POLICY "Users can view own recipes"
  ON recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can insert recipes into their own cookbooks
CREATE POLICY "Users can create recipes in own cookbooks"
  ON recipes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can update recipes in their own cookbooks
CREATE POLICY "Users can update own recipes"
  ON recipes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can delete recipes in their own cookbooks
CREATE POLICY "Users can delete own recipes"
  ON recipes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cookbooks
      WHERE cookbooks.id = recipes.cookbook_id
      AND cookbooks.user_id = auth.uid()
    )
  );
```

### recipe_ingredients Policies
```sql
-- Users can view ingredients for their own recipes
CREATE POLICY "Users can view own recipe ingredients"
  ON recipe_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can insert ingredients into their own recipes
CREATE POLICY "Users can create recipe ingredients"
  ON recipe_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can update ingredients in their own recipes
CREATE POLICY "Users can update recipe ingredients"
  ON recipe_ingredients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can delete ingredients from their own recipes
CREATE POLICY "Users can delete recipe ingredients"
  ON recipe_ingredients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );
```

### recipe_tags Policies
```sql
-- Users can view tags for their own recipes
CREATE POLICY "Users can view own recipe tags"
  ON recipe_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_tags.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can assign tags to their own recipes
CREATE POLICY "Users can create recipe tags"
  ON recipe_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_tags.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );

-- Users can remove tags from their own recipes
CREATE POLICY "Users can delete recipe tags"
  ON recipe_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      JOIN cookbooks ON cookbooks.id = recipes.cookbook_id
      WHERE recipes.id = recipe_tags.recipe_id
      AND cookbooks.user_id = auth.uid()
    )
  );
```

### analytics_events Policies
```sql
-- Users can insert their own analytics events
CREATE POLICY "Users can log own events"
  ON analytics_events FOR INSERT
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Only service role can query analytics (administrator/reporting only)
CREATE POLICY "Only admins can view analytics"
  ON analytics_events FOR SELECT
  TO service_role
  USING (true);
```

---

## 5. Database Functions & Triggers

### Automatic Timestamp Updates
```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_cookbooks_updated_at
  BEFORE UPDATE ON cookbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

  
  CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. Required PostgreSQL Extensions

```sql
-- Case-insensitive text type for ingredient names
CREATE EXTENSION IF NOT EXISTS citext;

-- Trigram similarity search for ingredient catalog
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 7. Design Notes & Rationale

### Hybrid Ingredient Model
- **Catalog table** enables future enrichment (dietary tags, normalization, unit conversions)
- **Nullable FK pattern** supports incremental migration from free-text to structured entries
- **Denormalized name storage** in recipe_ingredients preserves data integrity if catalog changes
- **Application enforces ≤50 ingredients** per recipe; database validates required fields only

### Security Architecture
- **Ownership anchored at cookbook level**: All downstream access (recipes, ingredients) verified via cookbook.user_id
- **RLS policies on every table**: Defense-in-depth even though application filters by cookbook
- **Service role restrictions**: Administrator-only modifications to tags and ingredient catalog
- **Anonymous analytics**: NULL user_id permitted in analytics_events with session_id tracking

### Scalability Considerations
- **Minimal initial indexing**: Low volume justifies lightweight index strategy
- **Future-ready trigram search**: Prepared for fuzzy ingredient matching when volume grows
- **JSONB event_data**: Flexible analytics schema without repeated migrations
- **Cascade deletes**: Automatic cleanup prevents orphaned records

### Data Integrity
- **Position-based ordering**: recipe_ingredients.position with unique constraint ensures stable sort
- **Check constraints**: Enforce business rules (description length, prep time non-negative)
- **Referential integrity**: Foreign keys with appropriate CASCADE/SET NULL behaviors
- **Partial unique index**: Enforces single default cookbook per user without complex CHECK constraints

### Normalization Level
- **3NF achieved** for core entities (cookbooks, recipes, ingredients, tags)
- **Controlled denormalization**: recipe_ingredients.name duplicates catalog for data preservation
- **Tag taxonomy**: Predefined list prevents user-generated taxonomy sprawl
- **Analytics**: Separate table with JSONB allows flexible event schema evolution

### Migration Path
1. Create extensions (citext, pg_trgm, uuid-ossp)
2. Create tables in dependency order (users → cookbooks → recipes → recipe_ingredients, etc.)
3. Create indexes after initial data load (if seeding)
4. Enable RLS and apply policies
5. Create triggers for timestamp automation
6. Seed predefined tags from PRD requirements

### Out of Scope (Noted for Future)
- Partitioning for analytics_events (when volume justifies)
- Full-text search indexes on recipe.description (deferred until search UI)
- Materialized views for reporting (no immediate analytics requirements)
- Multi-region replication (single-region deployment acceptable for MVP)
- Version history tracking (not in MVP scope)
- Nutrition data tables (future enhancement)

---

## 8. Sample Seed Data for Tags

Based on PRD requirements, predefined tags should include:

```sql
INSERT INTO tags (slug, label, icon, description) VALUES
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
```

---

## 9. Migration Execution Order

1. **Extensions**: citext, pg_trgm, uuid-ossp
2. **Tables** (in dependency order):
   - cookbooks
   - recipes
   - ingredients
   - recipe_ingredients
   - tags
   - recipe_tags
   - analytics_events
3. **Indexes**: Performance and unique constraint indexes
4. **Functions**: update_updated_at_column, validate_image_dimensions
5. **Triggers**: Timestamp automation, image validation
6. **RLS**: Enable and apply policies per table
7. **Seed Data**: Predefined tags

---

This schema provides a solid foundation for the 10xCookbook MVP while maintaining flexibility for future enhancements including dietary transformations, advanced search, nutrition profiling, and multi-cookbook support.
