BEGIN;
SELECT plan(8);

SELECT has_table('public', 'estaciones_alias_proveedor', 'Existe la tabla de aliases de estación');
SELECT has_column('public', 'estaciones', 'estado_geocodificacion', 'estaciones expone estado geográfico');

SELECT cmp_ok(
  (SELECT count(*)::integer FROM public.estaciones_alias_proveedor WHERE origen = 'seed'),
  '>=',
  296,
  'Se cargan al menos dos aliases por cada una de las 148 estaciones'
);

SELECT is(
  (SELECT count(*)::integer FROM public.estaciones WHERE estado_geocodificacion = 'OK'),
  134,
  'Las estaciones con ambas coordenadas quedan en estado OK'
);

SELECT is(
  (SELECT count(*)::integer FROM public.estaciones WHERE estado_geocodificacion = 'REVIEW'),
  18,
  'Las estaciones sin coordenadas completas quedan en REVIEW'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.estaciones_alias_proveedor a
    JOIN public.empresas em ON em.id::text = a.empresa_id
    JOIN public.estaciones e ON e.id = a.estacion_id
    WHERE em.nombre = 'AUSOL'
      AND e.nombre = 'BUEN AYRE'
      AND a.valor_normalizado = public.peajes_normalizar_estacion('BUEN AYRE - AUSOL')
  ),
  'AUSOL contiene el alias normalizado de BUEN AYRE'
);

SELECT is(
  public.peajes_normalizar_estacion('  Ituzaingó  '),
  'ITUZAINGO',
  'La normalización elimina acentos y espacios'
);

/* Patrón legado con texto codificado de forma distinta al mensaje de PostgreSQL local.
SELECT throws_ok(
  $$
    INSERT INTO public.estaciones_alias_proveedor (empresa_id, estacion_id, valor_proveedor)
    SELECT em.id::text, e.id, 'ALIAS-EMPRESA-INCORRECTA'
    FROM public.empresas em
    CROSS JOIN public.estaciones e
    JOIN public.peajes p ON p.id = e.peaje_id
    WHERE em.nombre = 'AUSOL' AND p.nombre = 'AUTOPISTA DEL OESTE'
    LIMIT 1
  $$,
  'La estación .* no pertenece a la empresa .*',
  'El alias no puede vincular una estación con otra empresa'
);
*/

SELECT throws_like(
  $$
    INSERT INTO public.estaciones_alias_proveedor (empresa_id, estacion_id, valor_proveedor)
    SELECT em.id::text, e.id, 'ALIAS-EMPRESA-INCORRECTA'
    FROM public.empresas em
    CROSS JOIN public.estaciones e
    JOIN public.peajes p ON p.id = e.peaje_id
    WHERE em.nombre = 'AUSOL' AND p.nombre = 'AUTOPISTA DEL OESTE'
    LIMIT 1
  $$,
  '%no pertenece a la empresa%',
  'El alias no puede vincular una estación con otra empresa'
);

SELECT * FROM finish();
ROLLBACK;
