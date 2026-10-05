-- The reported six-candidate payload; all fixture changes roll back.
BEGIN;
SELECT no_plan();
TRUNCATE public.peajes CASCADE;
INSERT INTO public.peajes(id, nombre) VALUES
('ab449656-bebf-4cb2-bbb3-6221403e1c7b', 'IDA tie regression');
INSERT INTO public.estaciones(id, peaje_id, nombre) VALUES
('3f32d96b-e51f-4e5e-a473-be7bcc3de5e9', 'ab449656-bebf-4cb2-bbb3-6221403e1c7b', 'Station A'),
('67486ca3-6e88-49a8-b628-7f41e946da5a', 'ab449656-bebf-4cb2-bbb3-6221403e1c7b', 'Station B');
CREATE TEMP TABLE direction_fixture(n int, estacion_id uuid, categoria smallint, status text, importe numeric);
INSERT INTO direction_fixture VALUES
(1,'3f32d96b-e51f-4e5e-a473-be7bcc3de5e9',7,'NO_PICO',14370.19),
(2,'3f32d96b-e51f-4e5e-a473-be7bcc3de5e9',7,'NO_PICO',28740.39),
(3,'3f32d96b-e51f-4e5e-a473-be7bcc3de5e9',7,'PICO',35925.48),
(4,'67486ca3-6e88-49a8-b628-7f41e946da5a',7,'NO_PICO',14370.19),
(5,'67486ca3-6e88-49a8-b628-7f41e946da5a',6,'NO_PICO',11975.15),
(6,'67486ca3-6e88-49a8-b628-7f41e946da5a',6,'PICO',14968.96);
INSERT INTO public.tarifas(id, peaje_id, estacion_id, categoria, status, sentido, enabled, fecha_actualizacion)
SELECT DISTINCT md5(f.estacion_id::text || f.categoria || f.status || d.sentido)::uuid,
 'ab449656-bebf-4cb2-bbb3-6221403e1c7b'::uuid, f.estacion_id, f.categoria, f.status, d.sentido, true, now()
FROM direction_fixture f CROSS JOIN (VALUES ('IDA'),('VUELTA')) d(sentido);
INSERT INTO public.tarifa_importe(id, tarifa_id, importe, diagnostico, fecha_aparicion, fecha_vigencia_inicio, fecha_vigencia_fin)
SELECT md5(f.n::text || d.sentido)::uuid,
 md5(f.estacion_id::text || f.categoria || f.status || d.sentido)::uuid,
 CASE WHEN f.n=5 AND d.sentido='VUELTA' THEN f.importe * 1.005 ELSE f.importe END,
 'CONFIRMADO', now(), DATE '2026-01-01' + f.n * 30, DATE '2026-01-01' + (f.n + 1) * 30
FROM direction_fixture f CROSS JOIN (VALUES ('IDA'),('VUELTA')) d(sentido);
UPDATE public.tarifas t SET current_tarifa_id = (
 SELECT ti.id FROM public.tarifa_importe ti WHERE ti.tarifa_id=t.id ORDER BY ti.fecha_vigencia_inicio DESC LIMIT 1
);
CREATE FUNCTION pg_temp.history() RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.peajes_buscar_historial_importes(jsonb_agg(jsonb_build_object(
 'estacion_id',estacion_id,'importe',importe,'peaje_id','ab449656-bebf-4cb2-bbb3-6221403e1c7b','categoria',categoria
 ) ORDER BY n)) FROM direction_fixture;
$$;
CREATE FUNCTION pg_temp.detect(p_direction text DEFAULT NULL, p_conflict text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.peajes_detectar_refresco_tarifas(jsonb_agg(jsonb_build_object(
 'id',n::text,'estacion_id',estacion_id,'precio_directo',importe,'categoria',categoria,
 'sentido_solicitado',p_direction,'unresolvedReason',p_conflict
 ) ORDER BY n)) FROM direction_fixture;
$$;
SELECT is(jsonb_array_length(pg_temp.history()),6,'history returns all six candidates');
SELECT is(pg_temp.history()->0->>'importe_consultado','14370.19','history preserves first candidate amount');
SELECT is(pg_temp.history()->5->>'importe_consultado','14968.96','history preserves final candidate amount');
SELECT is(e->>'sentido','IDA','history prefers IDA for candidate ' || ord)
 FROM jsonb_array_elements(pg_temp.history()) WITH ORDINALITY x(e,ord);
SELECT is((e->>'count_identities')::int,1,'history counts one effective identity for candidate ' || ord)
 FROM jsonb_array_elements(pg_temp.history()) WITH ORDINALITY x(e,ord);
SELECT is(jsonb_array_length(e->'matches'),1,'history exposes only the selected IDA identity for candidate ' || ord)
 FROM jsonb_array_elements(pg_temp.history()) WITH ORDINALITY x(e,ord);
SELECT is(e->>'sentido_aplicado','IDA','detection prefers IDA for candidate ' || ord)
 FROM jsonb_array_elements(pg_temp.detect()) WITH ORDINALITY x(e,ord);
SELECT is(pg_temp.detect()->0->>'codigo','HISTORICAL_TARIFF_MATCH','historical duplicate resolves');
SELECT is(pg_temp.detect()->1->>'codigo','CURRENT_TARIFF','current duplicate resolves');
SELECT is(public.peajes_buscar_historial_importes('[{"estacion_id":"3f32d96b-e51f-4e5e-a473-be7bcc3de5e9","importe":14370.19,"categoria":7,"sentido_solicitado":"VUELTA"}]')->0->>'sentido',
 'VUELTA','history respects explicit VUELTA on an old price');
SELECT is(e->>'sentido_aplicado','VUELTA','explicit VUELTA constrains candidate ' || ord)
 FROM jsonb_array_elements(pg_temp.detect('VUELTA')) WITH ORDINALITY x(e,ord);
SELECT is(pg_temp.detect(NULL,'CONFLICT')->0->>'codigo','DIRECTION_CONFLICT','conflict remains unresolved');
-- Query slightly different amounts: both directions still meet the 1% tolerance.
UPDATE direction_fixture SET importe = importe * 1.005;
SELECT is(pg_temp.history()->4->>'sentido','IDA','history prefers IDA within 1%');
SELECT is(pg_temp.detect()->4->>'sentido_aplicado','IDA','detection prefers IDA within 1%');
UPDATE public.tarifas SET enabled=false WHERE sentido='IDA';
SELECT is(pg_temp.history()->4->>'sentido','VUELTA','disabled IDA cannot win history');
SELECT is(pg_temp.detect()->4->>'sentido_aplicado','VUELTA','VUELTA-only match resolves');
UPDATE public.tarifas SET enabled=true;
-- Same price with a different status must remain ambiguous.
INSERT INTO public.tarifas(id,peaje_id,estacion_id,categoria,status,sentido,enabled,fecha_actualizacion)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000001','ab449656-bebf-4cb2-bbb3-6221403e1c7b',
 '67486ca3-6e88-49a8-b628-7f41e946da5a',7,'PICO','IDA',true,now());
INSERT INTO public.tarifa_importe(id,tarifa_id,importe,diagnostico,fecha_aparicion,fecha_vigencia_inicio)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000002','22700000-aaaa-4aa1-8aa1-000000000001',14370.19,'CONFIRMADO',now(),'2026-01-01');
UPDATE public.tarifas SET current_tarifa_id='22700000-aaaa-4aa1-8aa1-000000000002'
WHERE id='22700000-aaaa-4aa1-8aa1-000000000001';
SELECT is((pg_temp.history()->3->>'count_identities')::int,2,'different statuses remain ambiguous in history');
SELECT is(pg_temp.detect()->3->>'codigo','AMBIGUOUS_TARIFF_MATCH','different statuses remain ambiguous in detection');
-- An additional AMBAS identity is not a direction-only duplicate.
INSERT INTO public.tarifas(id,peaje_id,estacion_id,categoria,status,sentido,enabled,fecha_actualizacion)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000003','ab449656-bebf-4cb2-bbb3-6221403e1c7b',
 '67486ca3-6e88-49a8-b628-7f41e946da5a',6,'NO_PICO','AMBAS',true,now());
INSERT INTO public.tarifa_importe(id,tarifa_id,importe,diagnostico,fecha_aparicion,fecha_vigencia_inicio)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000004','22700000-aaaa-4aa1-8aa1-000000000003',11975.15,'CONFIRMADO',now(),'2026-01-01');
UPDATE public.tarifas SET current_tarifa_id='22700000-aaaa-4aa1-8aa1-000000000004'
WHERE id='22700000-aaaa-4aa1-8aa1-000000000003';
SELECT is(pg_temp.detect()->4->>'codigo','AMBIGUOUS_TARIFF_MATCH','AMBAS is retained as a separate identity');
-- A current price shared with another category remains ambiguous.
INSERT INTO public.tarifas(id,peaje_id,estacion_id,categoria,status,sentido,enabled,fecha_actualizacion)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000005','ab449656-bebf-4cb2-bbb3-6221403e1c7b',
 '3f32d96b-e51f-4e5e-a473-be7bcc3de5e9',5,'NO_PICO','IDA',true,now());
INSERT INTO public.tarifa_importe(id,tarifa_id,importe,diagnostico,fecha_aparicion,fecha_vigencia_inicio)
VALUES ('22700000-aaaa-4aa1-8aa1-000000000006','22700000-aaaa-4aa1-8aa1-000000000005',28740.39,'CONFIRMADO',now(),'2026-01-01');
UPDATE public.tarifas SET current_tarifa_id='22700000-aaaa-4aa1-8aa1-000000000006'
WHERE id='22700000-aaaa-4aa1-8aa1-000000000005';
SELECT is(pg_temp.detect()->1->>'codigo','AMBIGUOUS_TARIFF_MATCH','different categories remain ambiguous');
-- The direction preference cannot turn a nonmatching IDA amount into a match.
UPDATE direction_fixture SET importe=12095.51 WHERE n=5;
SELECT is(pg_temp.history()->4->>'sentido','VUELTA','IDA outside 1% cannot win over a matching VUELTA');
SELECT is(pg_temp.detect()->4->>'sentido_aplicado','VUELTA','detector excludes nonmatching IDA and AMBAS');
SELECT * FROM finish();
ROLLBACK;
