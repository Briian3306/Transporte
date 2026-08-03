-- F06-1: esquema, semillas y plantillas de ACCESO OESTE / PROVEEDOR DEMO.
BEGIN;
SELECT plan(12);

SELECT has_column('public', 'estaciones', 'latitud', 'F06-1 estaciones.latitud existe');
SELECT has_column('public', 'estaciones', 'longitud', 'F06-1 estaciones.longitud existe');
SELECT has_column('public', 'estaciones', 'camino', 'F06-1 estaciones.camino existe');

SELECT has_column(
  'public', 'pases', 'pase',
  'F06-1 carga las 160 asociaciones pase/patente de la semilla'
);
SELECT cmp_ok(
  (SELECT count(*)::integer FROM public.estaciones WHERE nombre <> ALL (ARRAY['Ricchieri', 'Tristán Suárez', 'Monte Grande', 'Mercado Central'])),
  '>=',
  148,
  'F06-1 carga las 148 estaciones del archivo de semillas'
);
SELECT is(
  (SELECT count(*)::integer FROM public.patentes WHERE categoria IN ('TRANSPORTE', 'REMIS', 'OBRA', 'AUTO')),
  (SELECT count(*)::integer FROM public.patentes),
  'F06-1 las categorías de patentes pertenecen al dominio ampliado'
);

SELECT cmp_ok(
  (SELECT count(*)::integer
   FROM public.estaciones e
   JOIN public.peajes p ON p.id = e.peaje_id
   CROSS JOIN LATERAL unnest(e.codigos_proveedor) codigo
   WHERE p.nombre = 'AUTOPISTA DEL OESTE' AND codigo LIKE '% - %'),
  '>=',
  18,
  'F06-1 registra los 39 aliases ESTACION - VIA de Acceso Oeste'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.estaciones e
    JOIN public.peajes p ON p.id = e.peaje_id
    WHERE p.nombre = 'AUTOPISTA DEL OESTE' AND e.nombre = 'ITUZAINGÓ'
      AND EXISTS (
        SELECT 1
        FROM unnest(e.codigos_proveedor) AS codigo
        WHERE public.peajes_normalizar_estacion(codigo) = 'ITUZAINGO - AUTOPISTA DEL OESTE'
      )
  ),
  'F06-1 conserva el alias normalizado de ITUZAINGO para AUTOPISTA DEL OESTE'
);
SELECT is(
  (SELECT count(*)::integer FROM public.estaciones e
   JOIN public.peajes p ON p.id = e.peaje_id
   WHERE p.nombre = 'Corredores Viales Demo SA'),
  4,
  'F06-1 crea las cuatro estaciones del ejemplo Demo'
);

SELECT is(
  (SELECT count(*)::integer FROM public.plantillas_configuracion WHERE nombre IN ('ACCESO OESTE - Pasadas', 'Proveedor Demo - Pasadas') AND estado = 'activa'),
  2,
  'F06-1 activa ambas plantillas'
);
SELECT is(
  (SELECT count(*)::integer
   FROM public.configuraciones_plantilla c
   JOIN public.plantillas_configuracion p ON p.id = c.plantilla_id
   WHERE p.nombre = 'ACCESO OESTE - Pasadas'),
  8,
  'F06-1 persiste los ocho pasos de Acceso Oeste'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.configuraciones_plantilla c
    JOIN public.plantillas_configuracion p ON p.id = c.plantilla_id
    WHERE p.nombre = 'Proveedor Demo - Pasadas'
      AND c.nombre_columna = 'FECHA'
      AND c.configuracion->>'formato_hora' = 'MM/DD/YY HHMMSS'
  ),
  'F06-1 la plantilla Demo conserva su formato de fecha explícito'
);

SELECT * FROM finish();
ROLLBACK;
