WITH excel(id, status_excel) AS (
  VALUES
    ('96ff44b1-621a-47b7-82f0-05a756e26268'::uuid, 'NO_PICO'),
    ('d243e8ac-a10a-4d06-93c5-663ce155eecc'::uuid, 'NO_PICO'),
    ('8f4965ba-e987-40f9-bf98-cd1c62f5c5ea'::uuid, 'NO_PICO'),
    ('80f31686-f4a1-427c-9e7d-3b6caf72b441'::uuid, 'NO_PICO'),
    ('05d1a320-8580-4a2a-826b-6aa247f84c69'::uuid, 'NO_PICO'),
    ('03668afa-0507-48c9-8135-c194f0c502e1'::uuid, 'NO_PICO'),
    ('dc8f082d-641e-49ff-b503-90472824f422'::uuid, 'NO_PICO'),
    ('daf2654f-fa06-4462-bfa2-06670c251a84'::uuid, 'NO_PICO'),
    ('7fe7ceee-ef7d-49d9-9262-2e3f331f47b2'::uuid, 'NO_PICO'),
    ('9d7d3aa9-34e0-4eef-b5de-1f0a34e4ac7b'::uuid, 'NO_PICO'),
    ('5521eb80-bb41-4c46-99d3-eed8b368db39'::uuid, 'NO_PICO'),
    ('6075d461-1475-43c6-9ed8-a4a9d23dd172'::uuid, 'NO_PICO'),
    ('944cdf95-dac3-4dd5-9ec3-00b8e691b356'::uuid, 'NO_PICO'),
    ('9d8619dd-6968-4bb4-aa19-d1cd4df5f535'::uuid, 'NO_PICO'),
    ('02713418-7127-46c6-95fe-ff94613bfba0'::uuid, 'NO_PICO'),
    ('aa0dccd1-a565-47f5-9674-48f7005563b1'::uuid, 'NO_PICO'),
    ('c177d935-67ce-4a7e-8765-588eb874e248'::uuid, 'NO_PICO'),
    ('2184e82d-d057-4249-8f27-f7960dcd02e5'::uuid, 'NO_PICO'),
    ('8e750e5e-e4c0-4ab5-a1da-1b5b00917756'::uuid, 'PICO'),
    ('63a80020-62e3-4deb-9b33-84e263699d1e'::uuid, 'NO_PICO'),
    ('f10e2ee8-a44a-4d03-a61a-a31385b8834b'::uuid, 'NO_PICO'),
    ('e8d3fcb4-a0df-4809-8f23-13cc76757898'::uuid, 'PICO'),
    ('185ee54f-5523-4bb3-a777-fccfc210cc30'::uuid, 'PICO'),
    ('42774f7d-27a1-4786-858b-6dcf16047d3d'::uuid, 'NO_PICO'),
    ('2c8f135a-cbff-44e9-b2f5-d1871c4c3cbb'::uuid, 'NO_PICO'),
    ('04d80fdd-2e7e-4fd5-a232-c050ba4846b4'::uuid, 'PICO'),
    ('17525fec-44ec-4f1d-bc55-5e7e6b412133'::uuid, 'NO_PICO'),
    ('dff8154b-1b41-4fed-97ab-68baa7e8db43'::uuid, 'NO_PICO'),
    ('e29582aa-9f3c-49ae-9277-9ccff10d4d03'::uuid, 'NO_PICO'),
    ('bdab1cd9-0dfd-467b-93e1-d31230e00566'::uuid, 'NO_PICO'),
    ('8d0a9b0d-bd71-4ef0-836a-4abac59abd4f'::uuid, 'PICO'),
    ('5b8b150e-4b5a-4600-8e40-e602cf09950a'::uuid, 'NO_PICO'),
    ('54fd0e7c-d1fa-449a-aa0b-1d1a96b32f8c'::uuid, 'NO_PICO'),
    ('6ab27806-dbf1-4dae-b993-a59e94367b89'::uuid, 'NO_PICO'),
    ('801e9208-3213-49cb-a7cd-f3c749ae3e0e'::uuid, 'NO_PICO'),
    ('5ecc5ba6-4e41-4487-85c5-90ad600f57b9'::uuid, 'NO_PICO'),
    ('f28569ac-7640-4fec-af25-8a1dfd76d90d'::uuid, 'NO_PICO'),
    ('9ba410b0-edcd-4f19-8302-a3d2f48e50d0'::uuid, 'NO_PICO'),
    ('5bd9a3bb-5f0d-4c15-abdf-e0a884e1d41e'::uuid, 'NO_PICO'),
    ('3bbc52d6-6908-426a-857b-a9babe5bdb8e'::uuid, 'NO_PICO'),
    ('23b8ef68-5f1b-4111-a187-159a67cfcf91'::uuid, 'NO_PICO'),
    ('cc3e11e7-09ce-41e1-8790-8c2ea08fb0ce'::uuid, 'NO_PICO')
),
objetivo AS (
  SELECT e.id, e.status_excel, tn.estacion_id, tn.categoria, tn.importe
  FROM excel e
  JOIN public.tarifas_normalizadas tn ON tn.id = e.id
  WHERE NOT (tn.confirmado_manual AND tn.status IS DISTINCT FROM e.status_excel)
),
niveles AS (
  UPDATE public.tarifas_normalizadas tn
  SET
    status = o.status_excel,
    confirmado_manual = true,
    confirmado_at = COALESCE(tn.confirmado_at, now()),
    diagnostico = 'CONFIRMADO',
    updated_at = now()
  FROM objetivo o
  WHERE tn.id = o.id
    AND (
      tn.status IS DISTINCT FROM o.status_excel
      OR tn.confirmado_manual = false
      OR tn.diagnostico IS DISTINCT FROM 'CONFIRMADO'
    )
  RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
),
propagadas AS (
  UPDATE public.pasadas p
  SET
    tarifa_normalizada_id = n.id,
    tarifa_status = n.status
  FROM niveles n
  WHERE p.estacion_id = n.estacion_id
    AND p.categoria IS NOT DISTINCT FROM n.categoria
    AND p.precio = n.importe
    AND (
      p.tarifa_normalizada_id IS DISTINCT FROM n.id
      OR p.tarifa_status IS DISTINCT FROM n.status
    )
  RETURNING p.id
)
SELECT
  (SELECT count(*) FROM excel) AS ids_excel,
  (SELECT count(*) FROM niveles) AS niveles_actualizados,
  (SELECT count(*) FROM propagadas) AS pasadas_actualizadas;
