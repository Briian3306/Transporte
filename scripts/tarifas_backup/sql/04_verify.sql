-- Compare live vs bak (bak may be empty until 03_load_bak.sql).

SELECT 'pasadas' AS tabla,
       (SELECT count(*) FROM public.pasadas) AS live,
       (SELECT count(*) FROM public.pasadas_tarifas_bak) AS bak
UNION ALL
SELECT 'tarifas_normalizadas',
       (SELECT count(*) FROM public.tarifas_normalizadas),
       (SELECT count(*) FROM public.tarifas_normalizadas_bak)
UNION ALL
SELECT 'tarifas_status_catalogo',
       (SELECT count(*) FROM public.tarifas_status_catalogo),
       (SELECT count(*) FROM public.tarifas_status_catalogo_bak);

SELECT count(*) FILTER (WHERE tarifa_normalizada_id IS NULL) AS pasadas_sin_tarifa
FROM public.pasadas;
