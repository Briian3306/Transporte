-- pgTAP: F14-16 Task 2 schema + Task 3 current-pointer / immutable history
-- + Task 6 shadow resolver / 1% validator / association RPCs
-- + Task 7 unique-lineage backfill
-- + Task 8 compatibility readers (RED: pwbi_tarifas_v2 absent; legacy RPCs stay).
-- Empty tables; fixture inserts only. Do not load the Cruzado workbook.
BEGIN;
SELECT plan(185);

-- -----------------------------------------------------------------------------
-- Hard constraint: tarifas_normalizadas stays as compatibility path
-- -----------------------------------------------------------------------------
SELECT has_table(
  'public',
  'tarifas_normalizadas',
  'F14-16 tarifas_normalizadas sigue existiendo'
);

SELECT has_column(
  'public',
  'pasadas',
  'tarifa_normalizada_id',
  'F14-16 pasadas.tarifa_normalizada_id se retiene'
);

SELECT fk_ok(
  'pasadas',
  'tarifa_normalizada_id',
  'tarifas_normalizadas',
  'id',
  'F14-16 FK legado pasadas.tarifa_normalizada_id → tarifas_normalizadas.id intacta'
);

SELECT hasnt_column(
  'public',
  'pasadas',
  'peaje_id',
  'F14-16 RN-05: pasadas sin peaje_id'
);

-- -----------------------------------------------------------------------------
-- public.tarifas
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'tarifas', 'F14-16 tarifas existe');

SELECT col_is_pk('public', 'tarifas', 'id', 'F14-16 tarifas.id es PK');
SELECT col_type_is('public', 'tarifas', 'id', 'uuid', 'F14-16 tarifas.id uuid');

SELECT has_column('public', 'tarifas', 'peaje_id', 'F14-16 tarifas.peaje_id');
SELECT col_not_null('public', 'tarifas', 'peaje_id', 'F14-16 tarifas.peaje_id NOT NULL');
SELECT col_type_is('public', 'tarifas', 'peaje_id', 'uuid', 'F14-16 tarifas.peaje_id uuid');
SELECT fk_ok(
  'tarifas',
  'peaje_id',
  'peajes',
  'id',
  'F14-16 tarifas.peaje_id → peajes.id'
);

SELECT has_column('public', 'tarifas', 'estacion_id', 'F14-16 tarifas.estacion_id');
SELECT col_not_null('public', 'tarifas', 'estacion_id', 'F14-16 tarifas.estacion_id NOT NULL');
SELECT col_type_is('public', 'tarifas', 'estacion_id', 'uuid', 'F14-16 tarifas.estacion_id uuid');
SELECT fk_ok(
  'tarifas',
  'estacion_id',
  'estaciones',
  'id',
  'F14-16 tarifas.estacion_id → estaciones.id'
);

SELECT has_column('public', 'tarifas', 'status', 'F14-16 tarifas.status');
SELECT col_not_null('public', 'tarifas', 'status', 'F14-16 tarifas.status NOT NULL');
SELECT col_type_is('public', 'tarifas', 'status', 'text', 'F14-16 tarifas.status text');

SELECT has_column('public', 'tarifas', 'categoria', 'F14-16 tarifas.categoria');
SELECT col_not_null('public', 'tarifas', 'categoria', 'F14-16 tarifas.categoria NOT NULL');
SELECT col_type_is('public', 'tarifas', 'categoria', 'smallint', 'F14-16 tarifas.categoria smallint');

SELECT has_column('public', 'tarifas', 'sentido', 'F14-16 tarifas.sentido');
SELECT col_not_null('public', 'tarifas', 'sentido', 'F14-16 tarifas.sentido NOT NULL');
SELECT col_type_is('public', 'tarifas', 'sentido', 'text', 'F14-16 tarifas.sentido text');
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifas'
      AND a.attname = 'sentido'
      AND NOT a.attisdropped
  ) LIKE '%AMBAS%',
  'F14-16 tarifas.sentido default AMBAS'
);

SELECT has_column(
  'public',
  'tarifas',
  'requiere_normalizacion_iva',
  'F14-16 tarifas.requiere_normalizacion_iva'
);
SELECT col_not_null(
  'public',
  'tarifas',
  'requiere_normalizacion_iva',
  'F14-16 tarifas.requiere_normalizacion_iva NOT NULL'
);
SELECT col_type_is(
  'public',
  'tarifas',
  'requiere_normalizacion_iva',
  'boolean',
  'F14-16 tarifas.requiere_normalizacion_iva boolean'
);
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifas'
      AND a.attname = 'requiere_normalizacion_iva'
      AND NOT a.attisdropped
  ) ILIKE '%false%',
  'F14-16 tarifas.requiere_normalizacion_iva default false'
);

SELECT has_column('public', 'tarifas', 'current_tarifa_id', 'F14-16 tarifas.current_tarifa_id');
SELECT col_type_is(
  'public',
  'tarifas',
  'current_tarifa_id',
  'uuid',
  'F14-16 tarifas.current_tarifa_id uuid'
);
SELECT col_is_null(
  'public',
  'tarifas',
  'current_tarifa_id',
  'F14-16 tarifas.current_tarifa_id nullable en bootstrap Task 2'
);

SELECT has_column('public', 'tarifas', 'fecha_actualizacion', 'F14-16 tarifas.fecha_actualizacion');
SELECT col_not_null(
  'public',
  'tarifas',
  'fecha_actualizacion',
  'F14-16 tarifas.fecha_actualizacion NOT NULL'
);
SELECT col_type_is(
  'public',
  'tarifas',
  'fecha_actualizacion',
  'timestamp with time zone',
  'F14-16 tarifas.fecha_actualizacion timestamptz'
);

SELECT has_column('public', 'tarifas', 'created_at', 'F14-16 tarifas.created_at');
SELECT col_not_null('public', 'tarifas', 'created_at', 'F14-16 tarifas.created_at NOT NULL');
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifas'
      AND a.attname = 'created_at'
      AND NOT a.attisdropped
  ) ILIKE '%now()%',
  'F14-16 tarifas.created_at default now()'
);

SELECT has_column('public', 'tarifas', 'updated_at', 'F14-16 tarifas.updated_at');
SELECT col_not_null('public', 'tarifas', 'updated_at', 'F14-16 tarifas.updated_at NOT NULL');
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifas'
      AND a.attname = 'updated_at'
      AND NOT a.attisdropped
  ) ILIKE '%now()%',
  'F14-16 tarifas.updated_at default now()'
);

SELECT col_is_unique(
  'public',
  'tarifas',
  ARRAY['peaje_id', 'estacion_id', 'status', 'categoria', 'sentido']::name[],
  'F14-16 tarifas unique (peaje_id, estacion_id, status, categoria, sentido)'
);

-- -----------------------------------------------------------------------------
-- public.tarifa_importe
-- -----------------------------------------------------------------------------
SELECT has_table('public', 'tarifa_importe', 'F14-16 tarifa_importe existe');

SELECT col_is_pk('public', 'tarifa_importe', 'id', 'F14-16 tarifa_importe.id es PK');
SELECT col_type_is('public', 'tarifa_importe', 'id', 'uuid', 'F14-16 tarifa_importe.id uuid');

SELECT has_column('public', 'tarifa_importe', 'tarifa_id', 'F14-16 tarifa_importe.tarifa_id');
SELECT col_not_null('public', 'tarifa_importe', 'tarifa_id', 'F14-16 tarifa_importe.tarifa_id NOT NULL');
SELECT fk_ok(
  'tarifa_importe',
  'tarifa_id',
  'tarifas',
  'id',
  'F14-16 tarifa_importe.tarifa_id → tarifas.id'
);

SELECT has_column('public', 'tarifa_importe', 'importe', 'F14-16 tarifa_importe.importe');
SELECT col_not_null('public', 'tarifa_importe', 'importe', 'F14-16 tarifa_importe.importe NOT NULL');
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'importe',
  'numeric(14,2)',
  'F14-16 tarifa_importe.importe numeric(14,2)'
);

SELECT has_column('public', 'tarifa_importe', 'importe_base', 'F14-16 tarifa_importe.importe_base');
SELECT ok(
  (
    SELECT c.data_type = 'numeric'
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tarifa_importe'
      AND c.column_name = 'importe_base'
  ),
  'F14-16 tarifa_importe.importe_base es numeric'
);

SELECT has_column('public', 'tarifa_importe', 'desvio', 'F14-16 tarifa_importe.desvio');
SELECT ok(
  (
    SELECT c.data_type = 'numeric'
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tarifa_importe'
      AND c.column_name = 'desvio'
  ),
  'F14-16 tarifa_importe.desvio es numeric'
);

SELECT has_column('public', 'tarifa_importe', 'hora_min', 'F14-16 tarifa_importe.hora_min');
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'hora_min',
  'numeric(5,2)',
  'F14-16 tarifa_importe.hora_min numeric(5,2)'
);
SELECT col_is_null('public', 'tarifa_importe', 'hora_min', 'F14-16 tarifa_importe.hora_min nullable');

SELECT has_column('public', 'tarifa_importe', 'hora_max', 'F14-16 tarifa_importe.hora_max');
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'hora_max',
  'numeric(5,2)',
  'F14-16 tarifa_importe.hora_max numeric(5,2)'
);
SELECT col_is_null('public', 'tarifa_importe', 'hora_max', 'F14-16 tarifa_importe.hora_max nullable');

SELECT has_column('public', 'tarifa_importe', 'hora_media', 'F14-16 tarifa_importe.hora_media');
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'hora_media',
  'numeric(5,2)',
  'F14-16 tarifa_importe.hora_media numeric(5,2)'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'hora_media',
  'F14-16 tarifa_importe.hora_media nullable'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'categoria_calculated',
  'F14-16 tarifa_importe.categoria_calculated'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'categoria_calculated',
  'smallint',
  'F14-16 tarifa_importe.categoria_calculated smallint'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'categoria_calculated',
  'F14-16 tarifa_importe.categoria_calculated nullable'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'fecha_aparicion',
  'F14-16 tarifa_importe.fecha_aparicion'
);
SELECT col_not_null(
  'public',
  'tarifa_importe',
  'fecha_aparicion',
  'F14-16 tarifa_importe.fecha_aparicion NOT NULL'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'fecha_aparicion',
  'timestamp with time zone',
  'F14-16 tarifa_importe.fecha_aparicion timestamptz'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'fecha_vigencia_inicio',
  'F14-19 tarifa_importe.fecha_vigencia_inicio'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'fecha_vigencia_inicio',
  'date',
  'F14-19 tarifa_importe.fecha_vigencia_inicio date'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'fecha_vigencia_inicio',
  'F14-19 tarifa_importe.fecha_vigencia_inicio nullable'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'fecha_vigencia_fin',
  'F14-19 tarifa_importe.fecha_vigencia_fin'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'fecha_vigencia_fin',
  'date',
  'F14-19 tarifa_importe.fecha_vigencia_fin date'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'fecha_vigencia_fin',
  'F14-19 tarifa_importe.fecha_vigencia_fin nullable'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'diagnostico',
  'F14-19 tarifa_importe.diagnostico'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'diagnostico',
  'text',
  'F14-19 tarifa_importe.diagnostico text'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'diagnostico',
  'F14-19 tarifa_importe.diagnostico nullable'
);

SELECT has_column(
  'public',
  'tarifa_importe',
  'tarifas_normalizadas_id',
  'F14-16 tarifa_importe.tarifas_normalizadas_id'
);
SELECT col_is_null(
  'public',
  'tarifa_importe',
  'tarifas_normalizadas_id',
  'F14-16 tarifa_importe.tarifas_normalizadas_id nullable'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'tarifas_normalizadas_id',
  'uuid',
  'F14-16 tarifa_importe.tarifas_normalizadas_id uuid'
);
SELECT fk_ok(
  'tarifa_importe',
  'tarifas_normalizadas_id',
  'tarifas_normalizadas',
  'id',
  'F14-16 tarifa_importe.tarifas_normalizadas_id → tarifas_normalizadas.id'
);

SELECT has_column('public', 'tarifa_importe', 'created_at', 'F14-16 tarifa_importe.created_at');
SELECT col_not_null(
  'public',
  'tarifa_importe',
  'created_at',
  'F14-16 tarifa_importe.created_at NOT NULL'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'created_at',
  'timestamp with time zone',
  'F14-16 tarifa_importe.created_at timestamptz'
);
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifa_importe'
      AND a.attname = 'created_at'
      AND NOT a.attisdropped
  ) ILIKE '%now()%',
  'F14-16 tarifa_importe.created_at default now()'
);

SELECT has_column('public', 'tarifa_importe', 'updated_at', 'F14-16 tarifa_importe.updated_at');
SELECT col_not_null(
  'public',
  'tarifa_importe',
  'updated_at',
  'F14-16 tarifa_importe.updated_at NOT NULL'
);
SELECT col_type_is(
  'public',
  'tarifa_importe',
  'updated_at',
  'timestamp with time zone',
  'F14-16 tarifa_importe.updated_at timestamptz'
);
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tarifa_importe'
      AND a.attname = 'updated_at'
      AND NOT a.attisdropped
  ) ILIKE '%now()%',
  'F14-16 tarifa_importe.updated_at default now()'
);

SELECT hasnt_column(
  'public',
  'tarifa_importe',
  'status',
  'F14-16 status vive solo en tarifas, no en tarifa_importe'
);
SELECT hasnt_column(
  'public',
  'tarifa_importe',
  'categoria',
  'F14-16 categoria vive solo en tarifas, no en tarifa_importe'
);

SELECT col_is_unique(
  'public',
  'tarifa_importe',
  ARRAY['tarifa_id', 'id']::name[],
  'F14-16 tarifa_importe unique (tarifa_id, id) para FK compuesto Task 3'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tarifa_importe'
      AND i.indisunique
      AND i.indpred IS NOT NULL
      AND pg_get_indexdef(i.indexrelid) ILIKE '%tarifas_normalizadas_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%IS NOT NULL%'
  ),
  'F14-16 tarifa_importe unique parcial tarifas_normalizadas_id WHERE NOT NULL'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tarifa_importe'
      AND (
        SELECT array_agg(a.attname::text ORDER BY x.ordinality)
        FROM unnest(i.indkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
      ) = ARRAY['tarifa_id', 'fecha_aparicion', 'created_at', 'id']::text[]
      AND pg_get_indexdef(i.indexrelid) ILIKE '%fecha_aparicion DESC%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%created_at DESC%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%, id DESC%'
  ),
  'F14-16 índice tarifa_importe (tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC)'
);

-- -----------------------------------------------------------------------------
-- pasadas shadow columns
-- -----------------------------------------------------------------------------
SELECT has_column('public', 'pasadas', 'sentido', 'F14-16 pasadas.sentido existe');
SELECT col_not_null('public', 'pasadas', 'sentido', 'F14-16 pasadas.sentido NOT NULL');
SELECT col_type_is('public', 'pasadas', 'sentido', 'text', 'F14-16 pasadas.sentido text');
SELECT ok(
  (
    SELECT pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'pasadas'
      AND a.attname = 'sentido'
      AND NOT a.attisdropped
  ) LIKE '%AMBAS%',
  'F14-16 pasadas.sentido default AMBAS'
);

SELECT has_column(
  'public',
  'pasadas',
  'tarifa_importe_id',
  'F14-16 pasadas.tarifa_importe_id existe'
);
SELECT col_is_null(
  'public',
  'pasadas',
  'tarifa_importe_id',
  'F14-16 pasadas.tarifa_importe_id nullable'
);
SELECT col_type_is(
  'public',
  'pasadas',
  'tarifa_importe_id',
  'uuid',
  'F14-16 pasadas.tarifa_importe_id uuid'
);
SELECT fk_ok(
  'pasadas',
  'tarifa_importe_id',
  'tarifa_importe',
  'id',
  'F14-16 pasadas.tarifa_importe_id → tarifa_importe.id'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'pasadas'
      AND (
        SELECT array_agg(a.attname::text ORDER BY x.ordinality)
        FROM unnest(i.indkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
      ) = ARRAY['tarifa_importe_id']::text[]
  ),
  'F14-16 índice pasadas (tarifa_importe_id)'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'pasadas'
      AND i.indpred IS NOT NULL
      AND pg_get_indexdef(i.indexrelid) ILIKE '%estacion_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%categoria%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%tarifa_status%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%sentido%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%precio%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%tarifa_importe_id IS NULL%'
  ),
  'F14-16 índice parcial shadow-backlog pasadas WHERE tarifa_importe_id IS NULL'
);

-- -----------------------------------------------------------------------------
-- RLS / grants (authenticated-all, same pattern as tarifas_normalizadas)
-- Catalog lookups so missing tables fail as TAP, not as undefined_table.
-- -----------------------------------------------------------------------------
SELECT ok(
  COALESCE(
    (
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tarifas'
        AND c.relkind = 'r'
    ),
    false
  ),
  'F14-16 tarifas tiene RLS habilitado'
);

SELECT ok(
  COALESCE(
    (
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tarifa_importe'
        AND c.relkind = 'r'
    ),
    false
  ),
  'F14-16 tarifa_importe tiene RLS habilitado'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tarifas'
      AND 'authenticated' = ANY (roles)
      AND cmd = 'ALL'
  ),
  'F14-16 tarifas policy authenticated ALL'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tarifa_importe'
      AND 'authenticated' = ANY (roles)
      AND cmd = 'ALL'
  ),
  'F14-16 tarifa_importe policy authenticated ALL'
);

SELECT ok(
  COALESCE(
    (
      SELECT has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'INSERT')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'DELETE')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tarifas'
        AND c.relkind = 'r'
    ),
    false
  ),
  'F14-16 authenticated SELECT/INSERT/UPDATE/DELETE on tarifas'
);

SELECT ok(
  COALESCE(
    (
      SELECT has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'INSERT')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE')
         AND has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'DELETE')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tarifa_importe'
        AND c.relkind = 'r'
    ),
    false
  ),
  'F14-16 authenticated SELECT/INSERT/UPDATE/DELETE on tarifa_importe'
);

-- -----------------------------------------------------------------------------
-- Seed catálogos existentes (no v2) para CHECKs vía throws_ok / lives_ok
-- -----------------------------------------------------------------------------
INSERT INTO public.peajes (id, nombre) VALUES
  ('16200000-aaaa-4aa1-8aa1-000000000001', 'Peaje F14-16 v2');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '16200000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    'ESTACION F14-16'
  );

INSERT INTO public.patentes (id, patente, categoria) VALUES
  ('16200000-aaaa-4aa1-8aa1-000000000003', 'F16PAT', 'FLOTA CAMIONES');

INSERT INTO public.pases (id, pase, patente_id) VALUES
  (
    '16200000-aaaa-4aa1-8aa1-000000000004',
    'F16-PASE',
    '16200000-aaaa-4aa1-8aa1-000000000003'
  );

INSERT INTO public.documentos (
  id, factura, cuenta, empresa_id, fecha_factura, tipo,
  importe_sin_iva, percepciones, iva, importe_total, bonificacion
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000005',
  'F16-DOC-1', NULL, '__global__', DATE '2026-07-01', 'FC',
  3000, 0, 0, 3000, 0
);

INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000030',
  '16200000-aaaa-4aa1-8aa1-000000000001',
  '16200000-aaaa-4aa1-8aa1-000000000002',
  NULL, 1000, 1000, 0, 'A', 'REVISAR', 'PENDIENTE'
);

-- -----------------------------------------------------------------------------
-- CHECK / unique / default behavior (wrapped so missing tables TAP-fail)
-- -----------------------------------------------------------------------------
SELECT throws_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000111',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PENDIENTE',
    2,
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifas.status rechaza PENDIENTE'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000112',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    2,
    'NORTE',
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifas.sentido rechaza NORTE'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000113',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    11,
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifas.categoria rechaza 11'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000114',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    -1,
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifas.categoria rechaza -1'
);

SELECT lives_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000010',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    0,
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  'F14-16 tarifas acepta status PICO, categoria 0 y sentido default AMBAS'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000011',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    0,
    'AMBAS',
    timestamptz '2026-07-02 00:00:00+00'
  )
  $$,
  '23505',
  NULL,
  'F14-16 tarifas unique rechaza duplicado (peaje, estacion, status, categoria, sentido)'
);

SELECT lives_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000012',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO',
    10,
    'IDA',
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  'F14-16 tarifas acepta NO_PICO, categoria 10 y sentido IDA'
);

SELECT lives_ok(
  $$
  INSERT INTO public.tarifas (
    id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000013',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO',
    1,
    'VUELTA',
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  'F14-16 tarifas acepta sentido VUELTA'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifa_importe (
    id, tarifa_id, importe, fecha_aparicion
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000021',
    '16200000-aaaa-4aa1-8aa1-000000000010',
    0,
    timestamptz '2026-07-01 00:00:00+00'
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifa_importe.importe rechaza 0'
);

SELECT lives_ok(
  $$
  INSERT INTO public.tarifa_importe (
    id, tarifa_id, importe, fecha_aparicion, tarifas_normalizadas_id
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000020',
    '16200000-aaaa-4aa1-8aa1-000000000010',
    1000.00,
    timestamptz '2026-07-01 00:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000030'
  )
  $$,
  'F14-16 tarifa_importe acepta importe > 0 y linaje a tarifas_normalizadas'
);

SELECT throws_ok(
  $$
  INSERT INTO public.tarifa_importe (
    id, tarifa_id, importe, fecha_aparicion, categoria_calculated
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000022',
    '16200000-aaaa-4aa1-8aa1-000000000012',
    500.00,
    timestamptz '2026-07-01 00:00:00+00',
    11
  )
  $$,
  '23514',
  NULL,
  'F14-16 tarifa_importe.categoria_calculated rechaza 11'
);

SELECT throws_ok(
  $$
  INSERT INTO public.pasadas (
    id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
    precio, bonificacion, quantity, importe_neto, sentido
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000041',
    timestamptz '2026-07-10 12:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000,
    'NORTE'
  )
  $$,
  '23514',
  NULL,
  'F14-16 pasadas.sentido rechaza NORTE'
);

SELECT lives_ok(
  $$
  INSERT INTO public.pasadas (
    id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
    precio, bonificacion, quantity, importe_neto, sentido
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000042',
    timestamptz '2026-07-10 13:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000,
    'VUELTA'
  )
  $$,
  'F14-16 pasadas acepta sentido VUELTA'
);

SELECT lives_ok(
  $$
  INSERT INTO public.pasadas (
    id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
    precio, bonificacion, quantity, importe_neto, tarifa_normalizada_id
  ) VALUES (
    '16200000-aaaa-4aa1-8aa1-000000000040',
    timestamptz '2026-07-10 12:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000,
    '16200000-aaaa-4aa1-8aa1-000000000030'
  )
  $$,
  'F14-16 pasadas INSERT retiene tarifa_normalizada_id legado'
);

CREATE FUNCTION pg_temp.pasadas_sentido(p_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v text;
BEGIN
  EXECUTE format(
    'SELECT sentido::text FROM public.pasadas WHERE id = %L',
    p_id
  ) INTO v;
  RETURN v;
EXCEPTION
  WHEN undefined_column THEN
    RETURN NULL;
END;
$$;

SELECT is(
  pg_temp.pasadas_sentido('16200000-aaaa-4aa1-8aa1-000000000040'),
  'AMBAS',
  'F14-16 pasadas.sentido default AMBAS tras INSERT sin columna'
);

-- -----------------------------------------------------------------------------
-- Task 3: FK compuesto del puntero, historial inmutable, promoción al insertar
-- Dedicated parents (unique config keys). fecha_actualizacion sentinel 2026-01-01
-- so promotion copies of fecha_aparicion are distinguishable from the insert value.
-- -----------------------------------------------------------------------------
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido, fecha_actualizacion
) VALUES
  (
    '16200000-aaaa-4aa1-8aa1-000000000050',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO', 2, 'IDA',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16200000-aaaa-4aa1-8aa1-000000000051',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO', 2, 'VUELTA',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16200000-aaaa-4aa1-8aa1-000000000052',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO', 3, 'AMBAS',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16200000-aaaa-4aa1-8aa1-000000000053',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 2, 'AMBAS',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16200000-aaaa-4aa1-8aa1-000000000054',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16200000-aaaa-4aa1-8aa1-000000000002',
    'PICO', 4, 'AMBAS',
    timestamptz '2026-01-01 00:00:00+00'
  );

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class ft ON ft.oid = c.confrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'tarifas'
      AND ft.relname = 'tarifa_importe'
      AND c.contype = 'f'
      AND (
        SELECT array_agg(a.attname::text ORDER BY x.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
      ) = ARRAY['id', 'current_tarifa_id']::text[]
      AND (
        SELECT array_agg(a.attname::text ORDER BY x.ordinality)
        FROM unnest(c.confkey) WITH ORDINALITY AS x(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = ft.oid AND a.attnum = x.attnum
      ) = ARRAY['tarifa_id', 'id']::text[]
  ),
  'F14-16 FK compuesto (tarifas.id, current_tarifa_id) → tarifa_importe(tarifa_id, id)'
);

-- First insert promotes bootstrap NULL pointer and copies fecha_aparicion.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000060',
  '16200000-aaaa-4aa1-8aa1-000000000050',
  1000.00,
  timestamptz '2026-07-01 00:00:00+00',
  timestamptz '2026-07-01 12:00:00+00',
  'CONFIRMADO', DATE '2026-07-01', DATE '2026-08-01'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  '16200000-aaaa-4aa1-8aa1-000000000060'::uuid,
  'F14-16 primer INSERT en tarifa_importe promociona current_tarifa_id'
);

SELECT is(
  (SELECT fecha_actualizacion FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  timestamptz '2026-07-01 00:00:00+00',
  'F14-16 primer INSERT copia fecha_aparicion a tarifas.fecha_actualizacion'
);

-- Strictly later fecha_vigencia_inicio promotes (CONFIRMADO + start).
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000061',
  '16200000-aaaa-4aa1-8aa1-000000000050',
  2000.00,
  timestamptz '2026-08-01 00:00:00+00',
  timestamptz '2026-08-01 12:00:00+00',
  'CONFIRMADO', DATE '2026-08-01', NULL
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  '16200000-aaaa-4aa1-8aa1-000000000061'::uuid,
  'F14-16 INSERT posterior promociona current_tarifa_id'
);

SELECT is(
  (SELECT fecha_actualizacion FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  timestamptz '2026-08-01 00:00:00+00',
  'F14-16 promoción posterior copia fecha_aparicion a fecha_actualizacion'
);

-- Earlier validity never demotes.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000062',
  '16200000-aaaa-4aa1-8aa1-000000000050',
  500.00,
  timestamptz '2026-06-01 00:00:00+00',
  timestamptz '2026-06-01 12:00:00+00',
  'CONFIRMADO', DATE '2026-06-01', DATE '2026-07-01'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  '16200000-aaaa-4aa1-8aa1-000000000061'::uuid,
  'F14-16 INSERT anterior no degrada current_tarifa_id'
);

SELECT is(
  (SELECT fecha_actualizacion FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000050'),
  timestamptz '2026-08-01 00:00:00+00',
  'F14-16 INSERT anterior no cambia fecha_actualizacion'
);

-- Cross-parent pointer: 051 cannot point at 050's amount (composite FK).
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000070',
  '16200000-aaaa-4aa1-8aa1-000000000051',
  1500.00,
  timestamptz '2026-07-01 00:00:00+00',
  timestamptz '2026-07-01 12:00:00+00',
  'CONFIRMADO', DATE '2026-07-01'
);

SELECT throws_ok(
  $$
  UPDATE public.tarifas
     SET current_tarifa_id = '16200000-aaaa-4aa1-8aa1-000000000061'
   WHERE id = '16200000-aaaa-4aa1-8aa1-000000000051'
  $$,
  '23503',
  NULL,
  'F14-16 rechaza current_tarifa_id de otra tarifa (FK compuesto)'
);

-- Immutable history: reject business UPDATE and DELETE of a non-current row
-- (DELETE of the current pointer could be blocked by the composite FK alone).
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '16200000-aaaa-4aa1-8aa1-000000000080',
    '16200000-aaaa-4aa1-8aa1-000000000052',
    800.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    'CONFIRMADO', DATE '2026-07-01', DATE '2026-08-01'
  ),
  (
    '16200000-aaaa-4aa1-8aa1-000000000081',
    '16200000-aaaa-4aa1-8aa1-000000000052',
    900.00,
    timestamptz '2026-08-01 00:00:00+00',
    timestamptz '2026-08-01 12:00:00+00',
    'CONFIRMADO', DATE '2026-08-01', NULL
  );

SELECT throws_ok(
  $$
  UPDATE public.tarifa_importe
     SET importe = 9999.00
   WHERE id = '16200000-aaaa-4aa1-8aa1-000000000080'
  $$,
  NULL,
  NULL,
  'F14-16 tarifa_importe rechaza UPDATE de importe (historial inmutable)'
);

SELECT throws_ok(
  $$
  DELETE FROM public.tarifa_importe
   WHERE id = '16200000-aaaa-4aa1-8aa1-000000000080'
  $$,
  NULL,
  NULL,
  'F14-16 tarifa_importe rechaza DELETE (historial inmutable)'
);

-- Equal fecha_aparicion: later fecha_vigencia_inicio wins even with a smaller id.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000091',
  '16200000-aaaa-4aa1-8aa1-000000000053',
  1100.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 10:00:00+00',
  'CONFIRMADO', DATE '2026-07-10', DATE '2026-07-11'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000090',
  '16200000-aaaa-4aa1-8aa1-000000000053',
  1200.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 11:00:00+00',
  'CONFIRMADO', DATE '2026-07-11', NULL
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000053'),
  '16200000-aaaa-4aa1-8aa1-000000000090'::uuid,
  'F14-16 misma fecha_aparicion: created_at posterior promociona (id menor no gana)'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-000000000092',
  '16200000-aaaa-4aa1-8aa1-000000000053',
  1300.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 09:00:00+00',
  'CONFIRMADO', DATE '2026-07-09', DATE '2026-07-10'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000053'),
  '16200000-aaaa-4aa1-8aa1-000000000090'::uuid,
  'F14-16 misma fecha_aparicion: created_at anterior no degrada el puntero'
);

-- Equal fecha_aparicion + equal created_at: later fecha_vigencia_inicio promotes.
INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-0000000000a0',
  '16200000-aaaa-4aa1-8aa1-000000000054',
  1400.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 12:00:00+00',
  'CONFIRMADO', DATE '2026-07-10', DATE '2026-07-11'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-0000000000a1',
  '16200000-aaaa-4aa1-8aa1-000000000054',
  1500.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 12:00:00+00',
  'CONFIRMADO', DATE '2026-07-11', NULL
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000054'),
  '16200000-aaaa-4aa1-8aa1-0000000000a1'::uuid,
  'F14-16 misma fecha y created_at: id posterior promociona'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES (
  '16200000-aaaa-4aa1-8aa1-00000000009f',
  '16200000-aaaa-4aa1-8aa1-000000000054',
  1600.00,
  timestamptz '2026-07-10 00:00:00+00',
  timestamptz '2026-07-15 12:00:00+00',
  'CONFIRMADO', DATE '2026-07-09', DATE '2026-07-10'
);

SELECT is(
  (SELECT current_tarifa_id FROM public.tarifas WHERE id = '16200000-aaaa-4aa1-8aa1-000000000054'),
  '16200000-aaaa-4aa1-8aa1-0000000000a1'::uuid,
  'F14-16 misma fecha y created_at: id anterior no degrada el puntero'
);

-- -----------------------------------------------------------------------------
-- Task 6: shadow resolver / 1% validator / post-confirmation association
-- Dedicated station so matching keys do not collide with Task 2–3 rows.
-- RPCs are missing on RED: helpers catch 42883 so the file still finishes.
-- Wished-for contract (GREEN):
--   peajes_resolver_tarifas_actuales(jsonb) → jsonb array, preserves idx
--   peajes_validar_tarifas_actuales(jsonb) → jsonb array, 1% inclusive
--   peajes_asociar_pasadas_tarifa_importe(jsonb) → void; AL_DIA/HISTORICA only
-- -----------------------------------------------------------------------------
CREATE FUNCTION pg_temp.rpc_jsonb(p_fn text, p_arg jsonb)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v jsonb;
BEGIN
  EXECUTE format('SELECT public.%I($1)', p_fn) INTO v USING p_arg;
  RETURN v;
EXCEPTION
  WHEN undefined_function THEN
    RETURN jsonb_build_object('_sqlstate', SQLSTATE);
END;
$$;

CREATE FUNCTION pg_temp.asociar_pasadas(p_arg jsonb)
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.peajes_asociar_pasadas_tarifa_importe(p_arg);
  RETURN 'ok';
EXCEPTION
  WHEN undefined_function THEN
    RETURN SQLSTATE;
END;
$$;

CREATE FUNCTION pg_temp.fn_def(p_signature text)
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_get_functiondef(p_signature::regprocedure);
EXCEPTION
  WHEN undefined_function THEN
    RETURN NULL;
END;
$$;

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '16600000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    'ESTACION F14-16 T6'
  );

INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  '16600000-aaaa-4aa1-8aa1-0000000000b0',
  '16200000-aaaa-4aa1-8aa1-000000000001',
  '16600000-aaaa-4aa1-8aa1-000000000002',
  NULL, 1000, 1000, 0, 'A', 'REVISAR', 'PENDIENTE'
);

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '16600000-aaaa-4aa1-8aa1-000000000010',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 1, 'IDA', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000011',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 1, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000020',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 2, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000030',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 3, 'IDA', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000031',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 3, 'VUELTA', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000050',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'PICO', 5, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000051',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 5, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000060',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 6, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000070',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 7, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000080',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 8, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000090',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 9, 'AMBAS', true,
    timestamptz '2026-01-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  hora_min, hora_max, diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '16600000-aaaa-4aa1-8aa1-000000000110',
    '16600000-aaaa-4aa1-8aa1-000000000010',
    1111.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000111',
    '16600000-aaaa-4aa1-8aa1-000000000011',
    1999.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000120',
    '16600000-aaaa-4aa1-8aa1-000000000020',
    2222.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000130',
    '16600000-aaaa-4aa1-8aa1-000000000030',
    3001.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000131',
    '16600000-aaaa-4aa1-8aa1-000000000031',
    3002.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000150',
    '16600000-aaaa-4aa1-8aa1-000000000050',
    5001.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    7, 9, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000151',
    '16600000-aaaa-4aa1-8aa1-000000000051',
    5002.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    10, 18, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000160',
    '16600000-aaaa-4aa1-8aa1-000000000060',
    6000.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000170',
    '16600000-aaaa-4aa1-8aa1-000000000070',
    1000.00,
    timestamptz '2026-06-01 00:00:00+00',
    timestamptz '2026-06-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-06-01', DATE '2026-08-01'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000171',
    '16600000-aaaa-4aa1-8aa1-000000000070',
    2000.00,
    timestamptz '2026-08-01 00:00:00+00',
    timestamptz '2026-08-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-08-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000180',
    '16600000-aaaa-4aa1-8aa1-000000000080',
    1000.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  ),
  (
    '16600000-aaaa-4aa1-8aa1-000000000190',
    '16600000-aaaa-4aa1-8aa1-000000000090',
    1000.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL, NULL, 'CONFIRMADO', DATE '2026-07-01', NULL
  );

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, sentido, tarifa_normalizada_id
) VALUES
  (
    '16600000-aaaa-4aa1-8aa1-0000000000c1',
    timestamptz '2026-09-07 10:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000, 'AMBAS',
    '16600000-aaaa-4aa1-8aa1-0000000000b0'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-0000000000c2',
    timestamptz '2026-09-07 11:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000, 'AMBAS',
    '16600000-aaaa-4aa1-8aa1-0000000000b0'
  ),
  (
    '16600000-aaaa-4aa1-8aa1-0000000000c3',
    timestamptz '2026-09-07 12:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16600000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1000, 0, 1, 1000, 'AMBAS',
    '16600000-aaaa-4aa1-8aa1-0000000000b0'
  );

CREATE FUNCTION pg_temp.t6_asoc_payload()
RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    jsonb_build_object(
      'pasada_id', '16600000-aaaa-4aa1-8aa1-0000000000c1',
      'tarifa_importe_id', '16600000-aaaa-4aa1-8aa1-000000000180',
      'codigo', 'AL_DIA'
    ),
    jsonb_build_object(
      'pasada_id', '16600000-aaaa-4aa1-8aa1-0000000000c2',
      'tarifa_importe_id', '16600000-aaaa-4aa1-8aa1-000000000170',
      'codigo', 'HISTORICA'
    ),
    jsonb_build_object(
      'pasada_id', '16600000-aaaa-4aa1-8aa1-0000000000c3',
      'tarifa_importe_id', '16600000-aaaa-4aa1-8aa1-000000000180',
      'codigo', 'DESFASADO'
    )
  );
$$;

SELECT has_function(
  'public',
  'peajes_resolver_tarifas_actuales',
  ARRAY['jsonb'],
  'F14-16 peajes_resolver_tarifas_actuales(jsonb) existe'
);

SELECT has_function(
  'public',
  'peajes_validar_tarifas_actuales',
  ARRAY['jsonb'],
  'F14-16 peajes_validar_tarifas_actuales(jsonb) existe'
);

SELECT has_function(
  'public',
  'peajes_asociar_pasadas_tarifa_importe',
  ARRAY['jsonb'],
  'F14-16 peajes_asociar_pasadas_tarifa_importe(jsonb) existe'
);

-- 1) Batch row-order preservation: missing config first, IDA match second.
SELECT ok(
  (
    SELECT
      r -> 0 ->> 'idx' = '0'
      AND r -> 0 ->> 'codigo' = 'SIN_TARIFA'
      AND r -> 1 ->> 'idx' = '1'
      AND r -> 1 ->> 'tarifa_id' = '16600000-aaaa-4aa1-8aa1-000000000010'
    FROM pg_temp.rpc_jsonb(
      'peajes_resolver_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
          'categoria', 4,
          'status', 'NO_PICO',
          'sentido', 'AMBAS'
        ),
        jsonb_build_object(
          'idx', 1,
          'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
          'categoria', 1,
          'status', 'NO_PICO',
          'sentido', 'IDA'
        )
      )
    ) AS r
  ),
  'F14-16 resolver preserva idx del caller (SIN_TARIFA luego IDA)'
);

-- 2) IDA exact priority over AMBAS; peaje via estaciones.peaje_id.
SELECT ok(
  (
    SELECT
      r -> 0 ->> 'tarifa_id' = '16600000-aaaa-4aa1-8aa1-000000000010'
      AND r -> 0 ->> 'current_tarifa_id' = '16600000-aaaa-4aa1-8aa1-000000000110'
      AND (r -> 0 ->> 'importe')::numeric = 1111
      AND r -> 0 ->> 'peaje_id' = '16200000-aaaa-4aa1-8aa1-000000000001'
      AND r -> 0 ->> 'sentido_aplicado' = 'IDA'
      AND (r -> 0 ->> 'requiere_normalizacion_iva')::boolean IS FALSE
    FROM pg_temp.rpc_jsonb(
      'peajes_resolver_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
          'categoria', 1,
          'status', 'NO_PICO',
          'sentido', 'IDA'
        )
      )
    ) AS r
  ),
  'F14-16 resolver prioriza sentido IDA exacto y peaje_id de estaciones'
);

-- 3) VUELTA falls back to AMBAS when VUELTA config is absent.
SELECT ok(
  (
    SELECT
      r -> 0 ->> 'tarifa_id' = '16600000-aaaa-4aa1-8aa1-000000000020'
      AND r -> 0 ->> 'sentido_aplicado' = 'AMBAS'
      AND (r -> 0 ->> 'importe')::numeric = 2222
    FROM pg_temp.rpc_jsonb(
      'peajes_resolver_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
          'categoria', 2,
          'status', 'NO_PICO',
          'sentido', 'VUELTA'
        )
      )
    ) AS r
  ),
  'F14-16 resolver VUELTA cae a AMBAS si no hay VUELTA'
);

-- 4) AMBAS matches only AMBAS (does not pick IDA/VUELTA).
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_resolver_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
        'categoria', 3,
        'status', 'NO_PICO',
        'sentido', 'AMBAS'
      )
    )
  ) -> 0 ->> 'codigo',
  'SIN_TARIFA',
  'F14-16 resolver AMBAS no elige IDA ni VUELTA'
);

-- 5) Missing configuration → SIN_TARIFA.
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_resolver_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
        'categoria', 4,
        'status', 'NO_PICO',
        'sentido', 'AMBAS'
      )
    )
  ) -> 0 ->> 'codigo',
  'SIN_TARIFA',
  'F14-16 resolver configuración ausente → SIN_TARIFA'
);

-- 6) Absent status with PICO+NO_PICO (hora windows would guess PICO) → ESTADO_AMBIGUO.
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_resolver_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
        'categoria', 5,
        'sentido', 'AMBAS',
        'fecha_hora', '2026-07-10T08:00:00+00'
      )
    )
  ) -> 0 ->> 'codigo',
  'ESTADO_AMBIGUO',
  'F14-16 resolver status ausente con dos candidatos no infiere hora_*'
);

SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_resolver_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
        'categoria', 5,
        'status', 'PENDIENTE',
        'sentido', 'AMBAS'
      )
    )
  ) -> 0 ->> 'codigo',
  'ESTADO_AMBIGUO',
  'F14-16 resolver status PENDIENTE con dos candidatos → ESTADO_AMBIGUO'
);

-- Unique status (only NO_PICO) is resolvable when status is omitted.
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_resolver_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'estacion_id', '16600000-aaaa-4aa1-8aa1-000000000002',
        'categoria', 6,
        'sentido', 'AMBAS'
      )
    )
  ) -> 0 ->> 'tarifa_id',
  '16600000-aaaa-4aa1-8aa1-000000000060',
  'F14-16 resolver status ausente único NO_PICO no es ESTADO_AMBIGUO'
);

-- 7) Historical-price recognition → HISTORICA (non-current 1000; current is 2000).
SELECT ok(
  (
    SELECT
      r -> 0 ->> 'codigo' = 'HISTORICA'
      AND r -> 0 ->> 'tarifa_importe_id' = '16600000-aaaa-4aa1-8aa1-000000000170'
    FROM pg_temp.rpc_jsonb(
      'peajes_validar_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000070',
          'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000171',
          'importe', 2000,
          'requiere_normalizacion_iva', false,
          'precio_directo', 1000,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-16 validator reconoce importe histórico no vigente → HISTORICA'
);

-- 8) Inclusive 1%: exact, = 0.01, > 0.01.
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_validar_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000080',
        'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000180',
        'importe', 1000,
        'requiere_normalizacion_iva', false,
        'precio_directo', 1000,
        'precio_normalizado', NULL
      )
    )
  ) -> 0 ->> 'codigo',
  'AL_DIA',
  'F14-16 validator 1% exacto → AL_DIA'
);

SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_validar_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000080',
        'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000180',
        'importe', 1000,
        'requiere_normalizacion_iva', false,
        'precio_directo', 1010,
        'precio_normalizado', NULL
      )
    )
  ) -> 0 ->> 'codigo',
  'AL_DIA',
  'F14-16 validator error relativo = 0.01 inclusive → AL_DIA'
);

SELECT ok(
  (
    SELECT
      r -> 0 ->> 'codigo' = 'DESFASADO'
      AND (r -> 0 ->> 'importe')::numeric = 1000
      AND (r -> 0 ->> 'precio_comparado')::numeric = 1011
      AND abs((r -> 0 ->> 'error_relativo')::numeric - 0.011) < 0.0000001
    FROM pg_temp.rpc_jsonb(
      'peajes_validar_tarifas_actuales',
      jsonb_build_array(
        jsonb_build_object(
          'idx', 0,
          'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000080',
          'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000180',
          'importe', 1000,
          'requiere_normalizacion_iva', false,
          'precio_directo', 1011,
          'precio_normalizado', NULL
        )
      )
    ) AS r
  ),
  'F14-16 validator error relativo > 0.01 → DESFASADO con importes'
);

-- 9) Validator uses supplied normalized price only when flag is true; no / 1.21.
SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_validar_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000090',
        'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000190',
        'importe', 1000,
        'requiere_normalizacion_iva', true,
        'precio_directo', 1210,
        'precio_normalizado', 1000
      )
    )
  ) -> 0 ->> 'codigo',
  'AL_DIA',
  'F14-16 validator flag true usa precio_normalizado (no 1210)'
);

SELECT is(
  pg_temp.rpc_jsonb(
    'peajes_validar_tarifas_actuales',
    jsonb_build_array(
      jsonb_build_object(
        'idx', 0,
        'tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000090',
        'current_tarifa_id', '16600000-aaaa-4aa1-8aa1-000000000190',
        'importe', 1000,
        'requiere_normalizacion_iva', false,
        'precio_directo', 1210,
        'precio_normalizado', 1000
      )
    )
  ) -> 0 ->> 'codigo',
  'DESFASADO',
  'F14-16 validator flag false usa precio_directo (ignora normalizado)'
);

SELECT ok(
  pg_temp.fn_def('public.peajes_resolver_tarifas_actuales(jsonb)') IS NOT NULL
  AND pg_temp.fn_def('public.peajes_validar_tarifas_actuales(jsonb)') IS NOT NULL
  AND pg_temp.fn_def('public.peajes_resolver_tarifas_actuales(jsonb)') NOT ILIKE '%/ 1.21%'
  AND pg_temp.fn_def('public.peajes_resolver_tarifas_actuales(jsonb)') NOT ILIKE '%/1.21%'
  AND pg_temp.fn_def('public.peajes_resolver_tarifas_actuales(jsonb)') NOT ILIKE '%/ 1,21%'
  AND pg_temp.fn_def('public.peajes_resolver_tarifas_actuales(jsonb)') NOT ILIKE '%/1,21%'
  AND pg_temp.fn_def('public.peajes_validar_tarifas_actuales(jsonb)') NOT ILIKE '%/ 1.21%'
  AND pg_temp.fn_def('public.peajes_validar_tarifas_actuales(jsonb)') NOT ILIKE '%/1.21%'
  AND pg_temp.fn_def('public.peajes_validar_tarifas_actuales(jsonb)') NOT ILIKE '%/ 1,21%'
  AND pg_temp.fn_def('public.peajes_validar_tarifas_actuales(jsonb)') NOT ILIKE '%/1,21%',
  'F14-16 resolver/validator SQL no divide por 1.21'
);

-- 10) Association: AL_DIA/HISTORICA write tarifa_importe_id; DESFASADO ignored;
-- retry idempotent; tarifa_normalizada_id unchanged; no history insert.
SELECT is(
  pg_temp.asociar_pasadas(pg_temp.t6_asoc_payload()),
  'ok',
  'F14-16 peajes_asociar_pasadas_tarifa_importe ejecuta (no 42883)'
);

SELECT ok(
  (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000180'::uuid
       AND tarifa_normalizada_id = '16600000-aaaa-4aa1-8aa1-0000000000b0'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c1'
  )
  AND (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000170'::uuid
       AND tarifa_normalizada_id = '16600000-aaaa-4aa1-8aa1-0000000000b0'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c2'
  )
  AND (
    SELECT tarifa_importe_id IS NULL
       AND tarifa_normalizada_id = '16600000-aaaa-4aa1-8aa1-0000000000b0'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c3'
  ),
  'F14-16 association AL_DIA/HISTORICA escribe tarifa_importe_id; DESFASADO no; TN intacto'
);

SELECT is(
  pg_temp.asociar_pasadas(pg_temp.t6_asoc_payload()),
  'ok',
  'F14-16 association retry no lanza'
);

SELECT ok(
  (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000180'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c1'
  )
  AND (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000170'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c2'
  )
  AND (
    SELECT tarifa_importe_id IS NULL
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c3'
  ),
  'F14-16 association retry es idempotente'
);

SELECT ok(
  (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000180'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c1'
  )
  AND (
    SELECT count(*)::int
    FROM public.tarifa_importe
    WHERE tarifa_id IN (
      '16600000-aaaa-4aa1-8aa1-000000000010'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000011'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000020'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000030'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000031'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000050'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000051'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000060'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000070'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000080'::uuid,
      '16600000-aaaa-4aa1-8aa1-000000000090'::uuid
    )
  ) = 12,
  'F14-16 association escribe FK y no inserta historial tarifa_importe'
);

-- -----------------------------------------------------------------------------
-- Task 7: unique-lineage backfill of pasadas.tarifa_importe_id
-- Dedicated station / UUIDs (167…) so fixtures do not collide with Task 2–6.
-- Unique index already forbids two history rows with the same
-- tarifas_normalizadas_id; unmatched + coincidental-id (null lineage) cover
-- “leave null / do not invent”. GREEN must still join 1:1 (HAVING count = 1).
-- Wished-for contract (GREEN):
--   peajes_backfill_pasadas_tarifa_importe() → void; no args
--   Unique pasadas.tarifa_normalizada_id = tarifa_importe.tarifas_normalizadas_id
--     → set pasadas.tarifa_importe_id to that history id (id = lineage id)
--   Unmatched / non-unique → tarifa_importe_id stays null; no history insert
--   Zero mutation of tarifas_normalizadas; every tarifa_normalizada_id preserved
--   Idempotent; does not rewrite current pointers or association FKs
-- Helper catches 42883 so the file still finishes on RED.
-- -----------------------------------------------------------------------------
CREATE FUNCTION pg_temp.backfill_pasadas()
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.peajes_backfill_pasadas_tarifa_importe();
  RETURN 'ok';
EXCEPTION
  WHEN undefined_function THEN
    RETURN SQLSTATE;
END;
$$;

CREATE FUNCTION pg_temp.tn_fingerprint()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT md5(string_agg(
    concat_ws(
      '|',
      id::text,
      peaje_id::text,
      estacion_id::text,
      coalesce(categoria, ''),
      importe::text,
      importe_base::text,
      cases::text,
      multiplicador::text,
      coalesce(desvio::text, ''),
      coalesce(hora_min::text, ''),
      coalesce(hora_max::text, ''),
      coalesce(hora_media::text, ''),
      patron,
      diagnostico,
      status,
      muestra_confiable::text,
      confirmado_manual::text
    ),
    E'\n' ORDER BY id
  ))
  FROM public.tarifas_normalizadas;
$$;

CREATE FUNCTION pg_temp.tarifas_pointer_fingerprint()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT md5(string_agg(
    concat_ws(
      '|',
      id::text,
      coalesce(current_tarifa_id::text, ''),
      fecha_actualizacion::text
    ),
    E'\n' ORDER BY id
  ))
  FROM public.tarifas;
$$;

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '16700000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    'ESTACION F14-16 T7'
  );

INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES
  (
    '16700000-aaaa-4aa1-8aa1-0000000000b1',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    NULL, 1111, 1111, 0, 'A', 'REVISAR', 'PENDIENTE'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000b2',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    NULL, 2222, 2222, 0, 'A', 'REVISAR', 'PENDIENTE'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000b3',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    NULL, 3333, 3333, 0, 'A', 'REVISAR', 'PENDIENTE'
  );

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES
  (
    '16700000-aaaa-4aa1-8aa1-000000000010',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 1, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-000000000011',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    'NO_PICO', 2, 'AMBAS', false,
    timestamptz '2026-01-01 00:00:00+00'
  );

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  tarifas_normalizadas_id, diagnostico, fecha_vigencia_inicio
) VALUES
  (
    '16700000-aaaa-4aa1-8aa1-0000000000b1',
    '16700000-aaaa-4aa1-8aa1-000000000010',
    1111.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    '16700000-aaaa-4aa1-8aa1-0000000000b1',
    'CONFIRMADO', DATE '2026-07-01'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000b3',
    '16700000-aaaa-4aa1-8aa1-000000000011',
    3333.00,
    timestamptz '2026-07-01 00:00:00+00',
    timestamptz '2026-07-01 12:00:00+00',
    NULL,
    'CONFIRMADO', DATE '2026-07-01'
  );

INSERT INTO public.pasadas (
  id, fecha_hora, pase_id, patente_id, estacion_id, documento_id,
  precio, bonificacion, quantity, importe_neto, sentido, tarifa_normalizada_id
) VALUES
  (
    '16700000-aaaa-4aa1-8aa1-0000000000c1',
    timestamptz '2026-09-07 14:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1111, 0, 1, 1111, 'AMBAS',
    '16700000-aaaa-4aa1-8aa1-0000000000b1'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000c2',
    timestamptz '2026-09-07 15:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    1111, 0, 1, 1111, 'AMBAS',
    '16700000-aaaa-4aa1-8aa1-0000000000b1'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000c3',
    timestamptz '2026-09-07 16:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    2222, 0, 1, 2222, 'AMBAS',
    '16700000-aaaa-4aa1-8aa1-0000000000b2'
  ),
  (
    '16700000-aaaa-4aa1-8aa1-0000000000c4',
    timestamptz '2026-09-07 17:00:00+00',
    '16200000-aaaa-4aa1-8aa1-000000000004',
    '16200000-aaaa-4aa1-8aa1-000000000003',
    '16700000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000005',
    3333, 0, 1, 3333, 'AMBAS',
    '16700000-aaaa-4aa1-8aa1-0000000000b3'
  );

CREATE TEMP TABLE t7_snapshot AS
SELECT
  pg_temp.tn_fingerprint() AS tn_fp,
  (SELECT count(*)::int FROM public.tarifas_normalizadas) AS tn_count,
  (SELECT count(*)::int FROM public.tarifa_importe) AS ti_count,
  pg_temp.tarifas_pointer_fingerprint() AS ptr_fp;

CREATE TEMP TABLE t7_pasadas_before AS
SELECT id, tarifa_normalizada_id, tarifa_importe_id
FROM public.pasadas;

SELECT has_function(
  'public',
  'peajes_backfill_pasadas_tarifa_importe',
  ARRAY[]::name[],
  'F14-16 peajes_backfill_pasadas_tarifa_importe() existe'
);

CREATE TEMP TABLE t7_run1 AS
SELECT pg_temp.backfill_pasadas() AS result;

SELECT is(
  (SELECT result FROM t7_run1),
  'ok',
  'F14-16 peajes_backfill_pasadas_tarifa_importe ejecuta (no 42883)'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND (
    SELECT tarifa_importe_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
       AND tarifa_normalizada_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c1'
  )
  AND (
    SELECT tarifa_importe_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
       AND tarifa_normalizada_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c2'
  ),
  'F14-16 backfill 1:1 linaje escribe tarifa_importe_id (id = TN); TN intacto'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND (
    SELECT tarifa_importe_id IS NULL
       AND tarifa_normalizada_id = '16700000-aaaa-4aa1-8aa1-0000000000b2'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c3'
  ),
  'F14-16 backfill sin linaje deja tarifa_importe_id null; TN intacto'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND (
    SELECT tarifa_importe_id IS NULL
       AND tarifa_normalizada_id = '16700000-aaaa-4aa1-8aa1-0000000000b3'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c4'
  ),
  'F14-16 backfill no inventa linaje por id coincidente sin tarifas_normalizadas_id'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND NOT EXISTS (
    SELECT 1
    FROM t7_pasadas_before b
    JOIN public.pasadas p ON p.id = b.id
    WHERE p.tarifa_normalizada_id IS DISTINCT FROM b.tarifa_normalizada_id
  )
  AND (SELECT count(*)::int FROM public.pasadas)
    = (SELECT count(*)::int FROM t7_pasadas_before),
  'F14-16 backfill preserva todo pasadas.tarifa_normalizada_id'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND (SELECT tn_fp FROM t7_snapshot) = pg_temp.tn_fingerprint()
  AND (SELECT tn_count FROM t7_snapshot)
    = (SELECT count(*)::int FROM public.tarifas_normalizadas),
  'F14-16 backfill no muta tarifas_normalizadas (count + columnas de negocio)'
);

SELECT ok(
  (SELECT result FROM t7_run1) = 'ok'
  AND (SELECT ptr_fp FROM t7_snapshot) = pg_temp.tarifas_pointer_fingerprint()
  AND (SELECT ti_count FROM t7_snapshot)
    = (SELECT count(*)::int FROM public.tarifa_importe)
  AND (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000180'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c1'
  )
  AND (
    SELECT tarifa_importe_id = '16600000-aaaa-4aa1-8aa1-000000000170'::uuid
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c2'
  )
  AND (
    SELECT tarifa_importe_id IS NULL
    FROM public.pasadas
    WHERE id = '16600000-aaaa-4aa1-8aa1-0000000000c3'
  ),
  'F14-16 backfill no reescribe punteros, no inserta historial, no toca association T6'
);

SELECT is(
  pg_temp.backfill_pasadas(),
  'ok',
  'F14-16 backfill retry no lanza'
);

SELECT ok(
  (
    SELECT tarifa_importe_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c1'
  ) IS TRUE
  AND (
    SELECT tarifa_importe_id = '16700000-aaaa-4aa1-8aa1-0000000000b1'::uuid
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c2'
  ) IS TRUE
  AND (
    SELECT tarifa_importe_id IS NULL
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c3'
  )
  AND (
    SELECT tarifa_importe_id IS NULL
    FROM public.pasadas
    WHERE id = '16700000-aaaa-4aa1-8aa1-0000000000c4'
  ),
  'F14-16 backfill retry es idempotente (únicos llenos, unmatched null)'
);

-- -----------------------------------------------------------------------------
-- Task 8: compatibility readers (parallel v2 view; no legacy DROP)
-- Dedicated station / UUIDs (168…) so fixtures do not collide with Task 6/7.
-- Wished-for contract (GREEN):
--   VIEW public.pwbi_tarifas_v2 reads tarifas + tarifa_importe via current_tarifa_id
--   Columns (quoted PascalCase): Tarifa_ID, Peaje_ID, Estacion_ID, Categoria,
--     Sentido, Status, Importe, Current_Tarifa_ID
--   pwbi_tarifas unchanged (still tarifas_normalizadas)
--   Legacy RPCs stay: peajes_normalizar_tarifas(uuid),
--     peajes_recalcular_tarifas(uuid), peajes_confirmar_status_tarifa(jsonb)
-- Helper catches 42P01/42703 so the file still finishes on RED.
-- -----------------------------------------------------------------------------
CREATE FUNCTION pg_temp.pwbi_tarifas_v2_row(p_tarifa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT to_jsonb(r) INTO v
  FROM public.pwbi_tarifas_v2 r
  WHERE r."Tarifa_ID" = p_tarifa_id;
  RETURN COALESCE(v, jsonb_build_object('_sqlstate', 'no_row'));
EXCEPTION
  WHEN undefined_table THEN
    RETURN jsonb_build_object('_sqlstate', SQLSTATE);
  WHEN undefined_column THEN
    RETURN jsonb_build_object('_sqlstate', SQLSTATE);
END;
$$;

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  (
    '16800000-aaaa-4aa1-8aa1-000000000002',
    '16200000-aaaa-4aa1-8aa1-000000000001',
    'ESTACION F14-16 T8'
  );

-- Decoy TN at the same station: v2 must not source Importe from this row.
INSERT INTO public.tarifas_normalizadas (
  id, peaje_id, estacion_id, categoria, importe, importe_base,
  cases, patron, diagnostico, status
) VALUES (
  '16800000-aaaa-4aa1-8aa1-0000000000b0',
  '16200000-aaaa-4aa1-8aa1-000000000001',
  '16800000-aaaa-4aa1-8aa1-000000000002',
  NULL, 5555, 5555, 0, 'A', 'REVISAR', 'PENDIENTE'
);

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  requiere_normalizacion_iva, fecha_actualizacion
) VALUES (
  '16800000-aaaa-4aa1-8aa1-000000000010',
  '16200000-aaaa-4aa1-8aa1-000000000001',
  '16800000-aaaa-4aa1-8aa1-000000000002',
  'PICO', 4, 'IDA', false,
  timestamptz '2026-01-01 00:00:00+00'
);

INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, fecha_aparicion, created_at,
  diagnostico, fecha_vigencia_inicio, fecha_vigencia_fin
) VALUES
  (
    '16800000-aaaa-4aa1-8aa1-000000000100',
    '16800000-aaaa-4aa1-8aa1-000000000010',
    1111.00,
    timestamptz '2026-06-01 00:00:00+00',
    timestamptz '2026-06-01 12:00:00+00',
    'CONFIRMADO', DATE '2026-06-01', DATE '2026-08-01'
  ),
  (
    '16800000-aaaa-4aa1-8aa1-000000000200',
    '16800000-aaaa-4aa1-8aa1-000000000010',
    9999.00,
    timestamptz '2026-08-01 00:00:00+00',
    timestamptz '2026-08-01 12:00:00+00',
    'CONFIRMADO', DATE '2026-08-01', NULL
  );

SELECT has_function(
  'public',
  'peajes_normalizar_tarifas',
  ARRAY['uuid'],
  'F14-16 peajes_normalizar_tarifas(uuid) sigue disponible'
);

SELECT has_function(
  'public',
  'peajes_recalcular_tarifas',
  ARRAY['uuid'],
  'F14-16 peajes_recalcular_tarifas(uuid) sigue disponible'
);

SELECT has_function(
  'public',
  'peajes_confirmar_status_tarifa',
  ARRAY['jsonb'],
  'F14-16 peajes_confirmar_status_tarifa(jsonb) sigue disponible'
);

SELECT has_view(
  'public',
  'pwbi_tarifas',
  'F14-16 pwbi_tarifas sigue existiendo'
);

SELECT ok(
  pg_get_viewdef('public.pwbi_tarifas'::regclass, true) ILIKE '%tarifas_normalizadas%'
  AND pg_get_viewdef('public.pwbi_tarifas'::regclass, true) NOT ILIKE '%tarifa_importe%',
  'F14-16 pwbi_tarifas sigue leyendo tarifas_normalizadas (no reescrita a v2)'
);

SELECT has_view(
  'public',
  'pwbi_tarifas_v2',
  'F14-16 pwbi_tarifas_v2 existe (vista paralela)'
);

SELECT ok(
  (
    SELECT count(*)::int
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pwbi_tarifas_v2'
      AND column_name IN (
        'Tarifa_ID',
        'Peaje_ID',
        'Estacion_ID',
        'Categoria',
        'Sentido',
        'Status',
        'Importe',
        'Current_Tarifa_ID'
      )
  ) = 8,
  'F14-16 pwbi_tarifas_v2 expone Tarifa_ID/Peaje_ID/Estacion_ID/Categoria/Sentido/Status/Importe/Current_Tarifa_ID'
);

SELECT ok(
  COALESCE(
    (
      SELECT has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pwbi_tarifas_v2'
        AND c.relkind = 'v'
    ),
    false
  ),
  'F14-16 anon puede SELECT pwbi_tarifas_v2'
);

SELECT ok(
  COALESCE(
    (
      SELECT has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'pwbi_tarifas_v2'
        AND c.relkind = 'v'
    ),
    false
  ),
  'F14-16 authenticated puede SELECT pwbi_tarifas_v2'
);

CREATE TEMP TABLE t8_read AS
SELECT pg_temp.pwbi_tarifas_v2_row('16800000-aaaa-4aa1-8aa1-000000000010') AS r;

SELECT is(
  (SELECT r->>'_sqlstate' FROM t8_read),
  NULL,
  'F14-16 SELECT pwbi_tarifas_v2 no lanza undefined_table (42P01)'
);

SELECT ok(
  (SELECT r->>'_sqlstate' IS NULL FROM t8_read)
  AND (
    SELECT (r->>'Tarifa_ID')::uuid = '16800000-aaaa-4aa1-8aa1-000000000010'::uuid
    FROM t8_read
  )
  AND (
    SELECT (r->>'Peaje_ID')::uuid = '16200000-aaaa-4aa1-8aa1-000000000001'::uuid
    FROM t8_read
  )
  AND (
    SELECT (r->>'Estacion_ID')::uuid = '16800000-aaaa-4aa1-8aa1-000000000002'::uuid
    FROM t8_read
  )
  AND (
    SELECT (r->>'Categoria')::int = 4
    FROM t8_read
  )
  AND (
    SELECT r->>'Sentido' = 'IDA'
    FROM t8_read
  )
  AND (
    SELECT r->>'Status' = 'PICO'
    FROM t8_read
  )
  AND (
    SELECT (r->>'Importe')::numeric = 9999.00
    FROM t8_read
  )
  AND (
    SELECT (r->>'Importe')::numeric <> 1111.00
    FROM t8_read
  )
  AND (
    SELECT (r->>'Importe')::numeric <> 5555.00
    FROM t8_read
  )
  AND (
    SELECT (r->>'Current_Tarifa_ID')::uuid = '16800000-aaaa-4aa1-8aa1-000000000200'::uuid
    FROM t8_read
  )
  AND (
    SELECT (r->>'Current_Tarifa_ID')::uuid
         = (SELECT current_tarifa_id FROM public.tarifas
            WHERE id = '16800000-aaaa-4aa1-8aa1-000000000010')
    FROM t8_read
  ),
  'F14-16 pwbi_tarifas_v2 lee importe actual via current_tarifa_id (no historial, no TN)'
);

SELECT * FROM finish();
ROLLBACK;
