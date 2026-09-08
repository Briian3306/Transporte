-- Load CSVs already copied into the container as /tmp/tarifas_backup_*.csv
-- Run 02_create_bak.sql first. Never writes to live public.pasadas / tarifas_*.

TRUNCATE public.pasadas_tarifas_bak;
TRUNCATE public.tarifas_normalizadas_bak;
TRUNCATE public.tarifas_status_catalogo_bak;

COPY public.tarifas_normalizadas_bak (
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
) FROM '/tmp/tarifas_backup_tarifas_normalizadas.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8', NULL '');

COPY public.pasadas_tarifas_bak (
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
) FROM '/tmp/tarifas_backup_pasadas.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8', NULL '');

COPY public.tarifas_status_catalogo_bak (
  id,
  peaje_id,
  codigo,
  etiqueta,
  color,
  tipo_meta,
  orden,
  created_at
) FROM '/tmp/tarifas_backup_tarifas_status_catalogo.csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8', NULL '');
