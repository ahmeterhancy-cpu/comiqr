-- Enabled on the local dev database at first boot.
-- On Neon these are enabled via the console / `CREATE EXTENSION` in a migration.
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector: AI embeddings (menu recommendation)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram search (menu/venue text search)
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- accent-insensitive search (TR/DE/RU)
CREATE EXTENSION IF NOT EXISTS "cube";        -- required by earthdistance
CREATE EXTENSION IF NOT EXISTS "earthdistance"; -- "near me" geo queries (M20 portal)
