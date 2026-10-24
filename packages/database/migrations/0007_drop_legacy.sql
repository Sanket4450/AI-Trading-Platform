-- Remove the bootstrap-only table and the old Drizzle journal from the
-- pre-R1 scaffold. The R1 schema is owned by schema_migrations.
DROP TABLE IF EXISTS "system_heartbeats";
DROP SCHEMA IF EXISTS "drizzle" CASCADE;
