-- Snapshot CSV inside the Postgres container (superuser COPY).
-- Does not mutate public.pasadas / public.tarifas_normalizadas.
-- The canonical DESARROLLO snapshot is produced via MCP; this file is for
-- optional local Docker / psql dumps of whatever database you are connected to.
-- Host: docker cp supabase_db_ibarra-app:/tmp/tarifas_backup_*.csv <dest>

COPY (
  SELECT
    id,
    peaje_id,
    estacion_id,
    categoria,
    importe,
    importe_base,
    cases,
    multiplicador,
    desvio,
    hora_min,
    hora_max,
    hora_media,
    patron,
    diagnostico,
    status,
    muestra_confiable,
    confirmado_manual,
    confirmado_por,
    confirmado_at,
    created_at,
    updated_at,
    categoria_calculated
  FROM public.tarifas_normalizadas
  ORDER BY id
) TO '/tmp/tarifas_backup_tarifas_normalizadas.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY (
  SELECT
    id,
    fecha_hora,
    pase_id,
    patente_id,
    estacion_id,
    documento_id,
    precio,
    bonificacion,
    quantity,
    importe_neto,
    created_at,
    user_id,
    file_upload_name,
    categoria,
    tarifa_normalizada_id,
    tarifa_status,
    duplicado
  FROM public.pasadas
  ORDER BY id
) TO '/tmp/tarifas_backup_pasadas.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

COPY (
  SELECT
    id,
    peaje_id,
    codigo,
    etiqueta,
    color,
    tipo_meta,
    orden,
    created_at
  FROM public.tarifas_status_catalogo
  ORDER BY id
) TO '/tmp/tarifas_backup_tarifas_status_catalogo.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
