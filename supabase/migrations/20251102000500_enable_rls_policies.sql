-- Migration: Enable Row Level Security and Apply Policies
-- Purpose: Implement comprehensive security policies for data isolation and access control
-- Affected Tables: cookbooks, recipes, recipe_ingredients, recipe_tags, tags, ingredients, analytics_events
-- Special Considerations: 
--   - Ownership anchored at cookbook level for all downstream access
--   - Granular policies: separate for each operation (select, insert, update, delete) and role (anon, authenticated)
--   - Service role restrictions on administrative tables

-- ============================================================================
-- COOKBOOKS: RLS Policies
-- Description: Users can only access their own cookbooks
-- ============================================================================

-- policy: users can view their own cookbooks
create policy "Users can view own cookbooks"
  on cookbooks for select
  to authenticated
  using (auth.uid() = user_id);

-- policy: users can create their own cookbooks
create policy "Users can create own cookbooks"
  on cookbooks for insert
  to authenticated
  with check (auth.uid() = user_id);

-- policy: users can update their own cookbooks
create policy "Users can update own cookbooks"
  on cookbooks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- policy: users can delete their own cookbooks
-- cascades to recipes, recipe_ingredients, and recipe_tags automatically
create policy "Users can delete own cookbooks"
  on cookbooks for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- RECIPES: RLS Policies
-- Description: Users can access recipes in their own cookbooks
-- ============================================================================

-- policy: users can view recipes in their own cookbooks
create policy "Users can view own recipes"
  on recipes for select
  to authenticated
  using (
    exists (
      select 1 from cookbooks
      where cookbooks.id = recipes.cookbook_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can insert recipes into their own cookbooks
create policy "Users can create recipes in own cookbooks"
  on recipes for insert
  to authenticated
  with check (
    exists (
      select 1 from cookbooks
      where cookbooks.id = recipes.cookbook_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can update recipes in their own cookbooks
create policy "Users can update own recipes"
  on recipes for update
  to authenticated
  using (
    exists (
      select 1 from cookbooks
      where cookbooks.id = recipes.cookbook_id
      and cookbooks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cookbooks
      where cookbooks.id = recipes.cookbook_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can delete recipes in their own cookbooks
-- cascades to recipe_ingredients and recipe_tags automatically
create policy "Users can delete own recipes"
  on recipes for delete
  to authenticated
  using (
    exists (
      select 1 from cookbooks
      where cookbooks.id = recipes.cookbook_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RECIPE_INGREDIENTS: RLS Policies
-- Description: Users can access ingredients for their own recipes
-- ============================================================================

-- policy: users can view ingredients for their own recipes
create policy "Users can view own recipe ingredients"
  on recipe_ingredients for select
  to authenticated
  using (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_ingredients.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can insert ingredients into their own recipes
create policy "Users can create recipe ingredients"
  on recipe_ingredients for insert
  to authenticated
  with check (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_ingredients.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can update ingredients in their own recipes
create policy "Users can update recipe ingredients"
  on recipe_ingredients for update
  to authenticated
  using (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_ingredients.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_ingredients.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can delete ingredients from their own recipes
create policy "Users can delete recipe ingredients"
  on recipe_ingredients for delete
  to authenticated
  using (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_ingredients.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RECIPE_TAGS: RLS Policies
-- Description: Users can manage tags for their own recipes
-- ============================================================================

-- policy: users can view tags for their own recipes
create policy "Users can view own recipe tags"
  on recipe_tags for select
  to authenticated
  using (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_tags.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can assign tags to their own recipes
create policy "Users can create recipe tags"
  on recipe_tags for insert
  to authenticated
  with check (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_tags.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- policy: users can remove tags from their own recipes
-- note: no update policy needed as primary key columns cannot be modified
create policy "Users can delete recipe tags"
  on recipe_tags for delete
  to authenticated
  using (
    exists (
      select 1 from recipes
      join cookbooks on cookbooks.id = recipes.cookbook_id
      where recipes.id = recipe_tags.recipe_id
      and cookbooks.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TAGS: RLS Policies
-- Description: Tags are read-only for all users; only service role can modify
-- ============================================================================

-- policy: all authenticated users can view predefined tags
create policy "Authenticated users can view tags"
  on tags for select
  to authenticated
  using (true);

-- policy: anonymous users can view predefined tags for public recipes
create policy "Anonymous users can view tags"
  on tags for select
  to anon
  using (true);

-- note: only service role (administrators) can insert/update/delete tags
-- no policies needed as service_role bypasses rls by default

-- ============================================================================
-- INGREDIENTS: RLS Policies
-- Description: Global ingredient catalog is readable by all; modifications restricted
-- ============================================================================

-- policy: all authenticated users can view ingredient catalog
create policy "Authenticated users can view ingredients"
  on ingredients for select
  to authenticated
  using (true);

-- policy: anonymous users can view ingredient catalog for public recipes
create policy "Anonymous users can view ingredients"
  on ingredients for select
  to anon
  using (true);

-- policy: authenticated users can suggest new ingredients
-- application layer should review/approve before adding to catalog
create policy "Authenticated users can suggest ingredients"
  on ingredients for insert
  to authenticated
  with check (true);

-- note: only service role can update/delete ingredient catalog entries
-- preserves data integrity and prevents unauthorized modifications

-- ============================================================================
-- ANALYTICS_EVENTS: RLS Policies
-- Description: Users can log events; only service role can query
-- ============================================================================

-- policy: authenticated users can log their own events
create policy "Authenticated users can log own events"
  on analytics_events for insert
  to authenticated
  with check (
    user_id is null or user_id = auth.uid()
  );

-- policy: anonymous users can log events with null user_id
create policy "Anonymous users can log events"
  on analytics_events for insert
  to anon
  with check (user_id is null);

-- policy: only service role (administrators/reporting) can query analytics
-- prevents users from accessing other users' event data
create policy "Only service role can view analytics"
  on analytics_events for select
  to service_role
  using (true);

-- note: no update or delete policies for analytics_events
-- events are immutable audit logs
