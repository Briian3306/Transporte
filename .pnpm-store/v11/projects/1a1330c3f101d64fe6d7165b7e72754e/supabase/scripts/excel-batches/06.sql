WITH excel(id, status_excel) AS (
  VALUES
    ('c5459b26-54f8-427e-b611-15e97453fc0e'::uuid, 'NO_PICO'),
    ('61c2b03b-d61b-4803-95d9-940e804fed6f'::uuid, 'PICO'),
    ('8c0783c3-6a97-42f0-ba20-3fa2aa0b6ed4'::uuid, 'NO_PICO'),
    ('3a983e29-65a1-4344-8c5a-df16636d9310'::uuid, 'PICO'),
    ('d0492bfe-2e8f-45c8-8ef6-d4da5004e5ab'::uuid, 'NO_PICO'),
    ('ff37f763-72dd-4422-bfa6-a6f253b2f655'::uuid, 'PICO'),
    ('2414556a-86e4-47c3-825b-86893b1507b7'::uuid, 'NO_PICO'),
    ('f8b373cf-e399-447f-a616-3ac66921f118'::uuid, 'PICO'),
    ('2a97ade6-76a6-42c4-80bc-5fca13f77297'::uuid, 'NO_PICO'),
    ('db00d6d1-3bf2-4ec2-be93-084dbfa5ab5d'::uuid, 'PICO'),
    ('aa864014-dcdb-4b22-91df-b3f83bb045a7'::uuid, 'NO_PICO'),
    ('05b8f169-b857-4f39-96ea-785b6abb6506'::uuid, 'PICO'),
    ('436711ff-4a7e-4610-80da-7920d778b9e6'::uuid, 'NO_PICO'),
    ('cc9e9b23-1df8-4e85-bd5e-4cc96583d199'::uuid, 'PICO'),
    ('8cdfcf93-adec-48a7-bd84-0cc21f78c4f9'::uuid, 'PICO'),
    ('8ba4c170-4ea7-4ab2-9aab-ff8a2e74b85c'::uuid, 'PICO'),
    ('87311a71-da57-43eb-b3c3-97581e6dae85'::uuid, 'NO_PICO'),
    ('529ecf92-16da-426c-a628-1365232a21c6'::uuid, 'PICO'),
    ('0bc2f910-4db4-4fd2-801f-333b372fe9f0'::uuid, 'NO_PICO'),
    ('403e2dc7-52b4-4499-8117-4c5455fdd80b'::uuid, 'PICO'),
    ('d35063c0-2741-4ee7-b142-26efe8135ace'::uuid, 'NO_PICO'),
    ('a008b6ee-7687-421e-9984-b4757422223e'::uuid, 'PICO'),
    ('2aab5f63-77d5-41f8-8438-25f09c9053ee'::uuid, 'PICO'),
    ('7e6497dc-a97f-4d4f-bbb4-f7a2d461c087'::uuid, 'NO_PICO'),
    ('13537ce3-bd64-4d52-bead-00d803ee9596'::uuid, 'NO_PICO'),
    ('b23d9a51-6d6f-4bb5-b8a4-66a7f5ee0b96'::uuid, 'PICO'),
    ('a08d1daa-6eb2-440f-8e45-8e240096717a'::uuid, 'NO_PICO'),
    ('194c8ad6-7465-4165-969c-d96631fb0f69'::uuid, 'PICO'),
    ('15ff62c1-293f-4024-a887-a975a210edc9'::uuid, 'NO_PICO'),
    ('b05dee94-13a7-402e-a32d-754e857409fe'::uuid, 'NO_PICO'),
    ('2ea919a2-8a34-488c-9479-7473841a463d'::uuid, 'PICO'),
    ('909d784c-47e6-4fe2-91ae-2973f9ba2de3'::uuid, 'NO_PICO'),
    ('cba41b0d-911e-47cc-bce8-b80aa1742c52'::uuid, 'PICO'),
    ('2f80ab0a-b5a2-4650-bba2-2788d5222efa'::uuid, 'NO_PICO'),
    ('de6279af-889d-4f6c-a473-3e6136e525b0'::uuid, 'PICO'),
    ('b924061c-7bc8-4939-85c0-d2575a9f84c7'::uuid, 'NO_PICO'),
    ('b516d337-9c3c-409a-93cd-a471469b8f7f'::uuid, 'PICO'),
    ('acc5cfbe-691e-4068-aec7-228aa01b6693'::uuid, 'PICO'),
    ('151193c6-7f88-4f02-b689-a55de801b8fb'::uuid, 'PICO'),
    ('10bce807-210f-47ca-a68f-efb442daea15'::uuid, 'NO_PICO'),
    ('cd2df0f2-f6ca-4ad4-9e90-98a2a0e6e759'::uuid, 'NO_PICO'),
    ('6c10aa61-1b9a-4784-bf81-7644c664e4cc'::uuid, 'PICO'),
    ('43e44abf-3ab4-498f-a715-642601863fc2'::uuid, 'NO_PICO'),
    ('2f3c3d2d-5907-4043-8a09-9b26b63ccfc6'::uuid, 'PICO'),
    ('ee707446-c688-416a-8a38-bd3dcc9d8078'::uuid, 'NO_PICO'),
    ('a32a7838-1128-409f-9e6f-d788f62b2250'::uuid, 'PICO'),
    ('c1f3ed61-b48b-4174-8bb2-30aad3cd3c8c'::uuid, 'NO_PICO'),
    ('76429767-1053-4e87-8d9c-14df6f7d7da7'::uuid, 'NO_PICO'),
    ('55c64e95-4755-4b8f-8b32-d3783a98f74f'::uuid, 'NO_PICO'),
    ('b685b4f3-9be0-47b4-937f-5b91073a0266'::uuid, 'PICO'),
    ('1489d28e-ff4d-4dd3-ba51-f93def9b137d'::uuid, 'NO_PICO'),
    ('3ced515f-1806-443f-885a-2b486cb8b585'::uuid, 'PICO'),
    ('8fa5365b-8b94-4019-9788-2649dfb857e9'::uuid, 'NO_PICO'),
    ('fdf1ac63-3d5f-4ed3-ab87-d32c2cb94200'::uuid, 'NO_PICO'),
    ('32f69525-fbce-48aa-9819-0d592cf41159'::uuid, 'PICO'),
    ('bbe68a95-9789-4254-9d3f-7c9306e94851'::uuid, 'PICO'),
    ('8fd465a0-8f87-4890-8c53-063a12acbc44'::uuid, 'NO_PICO'),
    ('b2ba41a4-b66c-4911-95c7-949f7bbec4eb'::uuid, 'PICO'),
    ('cefb5c35-38e3-4e2c-a9ed-c9385fbe0a57'::uuid, 'NO_PICO'),
    ('abb4f86b-d8ec-40d3-bc81-bf3610c96ee1'::uuid, 'PICO'),
    ('e0d176e3-9afa-4402-b8a5-8cdd806ab00c'::uuid, 'NO_PICO'),
    ('b1682172-4a06-4cc5-b003-e2931cd4927c'::uuid, 'NO_PICO'),
    ('536015bb-dad7-4e78-9458-3ed0b8db8ec8'::uuid, 'NO_PICO'),
    ('f4e86540-ab06-437f-b903-c4b78ed518b6'::uuid, 'PICO'),
    ('7b2cee4b-24b2-4ec4-9d55-4cf4fb6c5aa9'::uuid, 'PICO'),
    ('689280c8-b4de-4bd8-8523-0ff6a1844619'::uuid, 'NO_PICO'),
    ('4aff8eff-5e8a-4406-951c-70e6c5ae5ad3'::uuid, 'PICO'),
    ('17a2c9dd-ce46-42cc-891a-f593ccfc8ff5'::uuid, 'PICO'),
    ('62315d95-b346-4865-8c0a-1c2014a00af8'::uuid, 'PICO'),
    ('7b4bc762-1093-4c9e-aba8-fb8597462faf'::uuid, 'PICO'),
    ('73c2561a-02b0-4fe2-835b-8479baf46fe6'::uuid, 'PICO'),
    ('563aebe6-004b-437b-95c2-564e786d8261'::uuid, 'NO_PICO'),
    ('14003443-0cb5-4069-bc04-94c44aa1c373'::uuid, 'NO_PICO'),
    ('b19fe914-6fad-4fc2-a7e7-04ce447f8e7e'::uuid, 'PICO'),
    ('e4508b71-7fe7-4bc3-a234-8cfc617bd554'::uuid, 'PICO'),
    ('7afb4c9e-4108-4cbd-acdc-d4696851191f'::uuid, 'NO_PICO'),
    ('a094e18c-a5e4-42ab-b0ad-b75297a11245'::uuid, 'NO_PICO'),
    ('53d0a91c-ae3e-46f1-b167-930e9ee7296c'::uuid, 'NO_PICO'),
    ('381f8bfd-d6fb-47a8-90d2-828d9f3b49e4'::uuid, 'PICO'),
    ('6b010a1d-f2a9-46c8-bd23-3249f724a90f'::uuid, 'NO_PICO')
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
