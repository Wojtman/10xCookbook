-- Migration: Rename description to preparation_description in recipes table
-- Purpose: Clarify that this field contains recipe preparation instructions, not a general description
-- Affected Table: recipes

-- Rename the column
alter table recipes rename column description to preparation_description;

-- Update the constraint name to match the new column name
alter table recipes rename constraint check_description_length to check_preparation_description_length;

-- Update the constraint to reference the new column name
alter table recipes drop constraint check_preparation_description_length;
alter table recipes add constraint check_preparation_description_length 
  check (length(preparation_description) <= 5000);

