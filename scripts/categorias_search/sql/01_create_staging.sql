-- 01_create_staging.sql
-- Staging for update_categoria_pasadas.csv (one-off recovery; not a migration).

CREATE TABLE IF NOT EXISTS public._stg_pasadas_categoria (
  id uuid PRIMARY KEY,
  file_name text,
  patente text,
  tarifa numeric,
  categoria text,
  concesion text
);

TRUNCATE public._stg_pasadas_categoria;
