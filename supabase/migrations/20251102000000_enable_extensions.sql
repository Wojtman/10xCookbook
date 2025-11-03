-- Migration: Enable Required PostgreSQL Extensions
-- Purpose: Enable citext for case-insensitive text, pg_trgm for similarity search, and uuid-ossp for UUID generation
-- Affected: Database-wide extensions
-- Special Considerations: These extensions are required before creating any tables that use them

-- enable case-insensitive text type for ingredient names
-- this allows for flexible ingredient matching and prevents duplicate entries with different casing
create extension if not exists citext;

-- enable trigram similarity search for ingredient catalog
-- prepared for future fuzzy ingredient matching when volume grows
create extension if not exists pg_trgm;

-- enable uuid generation functions
-- used for generating unique identifiers for all primary keys
create extension if not exists "uuid-ossp";
