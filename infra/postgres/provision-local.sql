-- ComiQR — provision the local dev + test databases on an existing PostgreSQL.
-- Run once as the postgres superuser:
--   psql -U postgres -h 127.0.0.1 -f infra/postgres/provision-local.sql
-- Idempotent: safe to re-run.

-- Role used by the app (matches apps/api/.env DB_USERNAME/DB_PASSWORD).
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'comiqr') THEN
        CREATE ROLE comiqr WITH LOGIN PASSWORD 'comiqr';
    END IF;
END
$$;

-- Dev + test databases owned by that role.
SELECT 'CREATE DATABASE comiqr OWNER comiqr'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'comiqr')\gexec

SELECT 'CREATE DATABASE comiqr_test OWNER comiqr'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'comiqr_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE comiqr TO comiqr;
GRANT ALL PRIVILEGES ON DATABASE comiqr_test TO comiqr;

-- Extensions (pg_trgm/unaccent/cube/earthdistance ship with contrib; `vector`
-- requires pgvector to be installed) are created by later migrations when the
-- features that need them land. Faz 0 needs none.
