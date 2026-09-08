WITH excel(id, status_excel) AS (
  VALUES
    ('11898f2c-b902-4773-a50e-c5ccc40496d4'::uuid, 'NO_PICO'),
    ('6cbd3b2a-b101-4c57-acdc-6481d2d83815'::uuid, 'NO_PICO'),
    ('3165f784-4fab-4876-9d68-7d292caa1973'::uuid, 'NO_PICO'),
    ('807ae537-2177-4b74-ac83-b6790b40cfe3'::uuid, 'NO_PICO'),
    ('c75c677b-1203-46b7-bee3-e828ab943afd'::uuid, 'NO_PICO'),
    ('9f522a42-6261-4824-a756-52b08fd1087f'::uuid, 'NO_PICO'),
    ('781f7cd7-7a78-495b-bc32-7eabf2759873'::uuid, 'NO_PICO'),
    ('e07af6f2-443a-4733-9d03-c0a95a3c38d3'::uuid, 'NO_PICO'),
    ('eb757a0e-e542-41ab-ba3f-a7497460ac15'::uuid, 'NO_PICO'),
    ('1e811ad6-2514-4da5-8484-7ef79bc4b039'::uuid, 'NO_PICO'),
    ('811e815a-736e-4ae5-bf2d-fa2a3dd66f44'::uuid, 'NO_PICO'),
    ('406b5968-839c-409a-bfe6-d48477b2a4be'::uuid, 'NO_PICO'),
    ('b478e475-da3f-424b-a010-88c1ca7c9103'::uuid, 'NO_PICO'),
    ('4fe13dbd-8521-46d2-857c-b9f5109be21e'::uuid, 'NO_PICO'),
    ('5b90240c-11c6-443f-b74a-643092a2c5dc'::uuid, 'NO_PICO'),
    ('b3368412-6b2f-4ee1-af54-a642fe972095'::uuid, 'NO_PICO'),
    ('a5d2f4c0-b312-4801-983c-4f44a505a559'::uuid, 'NO_PICO'),
    ('68e3e84b-f47f-45d1-aa9c-67bfc20015dd'::uuid, 'NO_PICO'),
    ('70296752-ef5d-4535-a1fc-c0abd6d0e685'::uuid, 'NO_PICO'),
    ('4d78fa93-0c94-47cd-a3b2-098a7963ec71'::uuid, 'PICO'),
    ('5495d5a6-fded-452b-80e2-fdd0d8d7a573'::uuid, 'NO_PICO'),
    ('6a03bc45-ae83-4f41-9073-610c89234b28'::uuid, 'PICO'),
    ('fcf7c79c-85b4-46fd-83e9-9848c99b0b0d'::uuid, 'NO_PICO'),
    ('bdbcfeab-c1f1-4447-a2e2-2c8ee1d937dc'::uuid, 'NO_PICO'),
    ('7eb9bcea-3142-444b-aa2e-88876f2a9f4a'::uuid, 'PICO'),
    ('92e95854-e57d-47d0-ba1d-4de920d27fa8'::uuid, 'NO_PICO'),
    ('e094d5c7-4564-4d57-9d6a-6162dbb002c9'::uuid, 'NO_PICO'),
    ('525532de-a327-4a9b-aa8e-1f8d482ad1d1'::uuid, 'NO_PICO'),
    ('a7a06258-e4f8-4f8d-a9fd-e8308d9dea90'::uuid, 'PICO'),
    ('c58c8337-dc43-43a1-87a7-36e8905d3467'::uuid, 'PICO'),
    ('c369bf95-ee6b-4a61-9531-987f636f393b'::uuid, 'NO_PICO'),
    ('975471e0-52f9-4fe5-9400-a4c6767e242a'::uuid, 'PICO'),
    ('4c30a82a-437f-4b19-9009-2135bda7460f'::uuid, 'NO_PICO'),
    ('54a5192e-a3f7-4c4b-8378-8502e7bf80b3'::uuid, 'NO_PICO'),
    ('70ed0afe-76ee-4359-b276-0db7ada8a10c'::uuid, 'PICO'),
    ('db47b830-6ff1-4a0d-b006-de29da7a5d4f'::uuid, 'NO_PICO'),
    ('abfbb238-4cb2-4c0c-905f-9bc23bbc387d'::uuid, 'PICO'),
    ('ddcd3046-8b51-4228-a9c4-f59b732db527'::uuid, 'NO_PICO'),
    ('184545d2-6d05-49ef-8e66-079237474510'::uuid, 'PICO'),
    ('f1e9bc71-16ed-477f-9eb7-cdb3670d0fe0'::uuid, 'NO_PICO'),
    ('40039c5a-aa33-4bd6-80dd-cb64d70ab11c'::uuid, 'PICO'),
    ('a9030790-9158-4d29-9479-b05ffe3e7498'::uuid, 'NO_PICO'),
    ('4b5ede9a-3dcd-4ef1-8c6e-8f52b2542a48'::uuid, 'PICO'),
    ('cc2cda4b-9501-4034-a412-11b02d57bc72'::uuid, 'NO_PICO'),
    ('3c4386ad-8802-4a3b-a91f-36c2355f520a'::uuid, 'PICO'),
    ('009bc286-3cec-4aac-9800-ef9d62caa49d'::uuid, 'NO_PICO'),
    ('224951c6-afd8-4897-b8a7-681a3cf550f8'::uuid, 'PICO'),
    ('de8fe2b2-397a-4d7b-8008-331c2b9571a2'::uuid, 'NO_PICO'),
    ('fa6b27d5-2c60-45b2-b905-dae077d6b3a8'::uuid, 'PICO'),
    ('2022b530-89af-407f-b2fa-5106c26a2af8'::uuid, 'NO_PICO'),
    ('79c6fd20-ab8b-4928-bfb5-2c717bcc7a5f'::uuid, 'PICO'),
    ('6ff42a22-cbe6-44c2-84b4-2bd6ee69a1fc'::uuid, 'NO_PICO'),
    ('2ffe9273-07a8-48f1-aa16-cda8bfb1efd9'::uuid, 'PICO'),
    ('9cdf5416-b533-441b-8216-066a6a85bad3'::uuid, 'NO_PICO'),
    ('8d1b5392-0484-4f1c-a5bd-8c108faadab0'::uuid, 'PICO'),
    ('3928b830-7819-479c-ac34-30338d94bb5f'::uuid, 'NO_PICO'),
    ('07348ec3-94f3-4035-a4a4-02886bc6efeb'::uuid, 'NO_PICO'),
    ('262dcb81-c96f-45aa-9886-c09d424b0e2e'::uuid, 'PICO'),
    ('ff226a37-28df-4b44-b4ea-233475b9a692'::uuid, 'NO_PICO'),
    ('9512c23b-1ff1-4a3f-ae1f-e20a1cc98197'::uuid, 'PICO'),
    ('a4194059-8599-46a3-b9f3-d9ae69ff1b67'::uuid, 'NO_PICO'),
    ('60d09e92-f756-448a-8945-8605adb57b1a'::uuid, 'PICO'),
    ('c96badec-91e9-4489-90e7-edd03bfa339f'::uuid, 'NO_PICO'),
    ('aba1846e-b9b3-4515-bf6f-0d86e8a145b6'::uuid, 'PICO'),
    ('5a974dcb-47cc-4862-bcb0-e566e93d69ed'::uuid, 'NO_PICO'),
    ('28ad3448-cd58-4d77-8be3-08b2bfb182ab'::uuid, 'PICO'),
    ('8f6e20a2-995b-455c-b290-95b294f29dc4'::uuid, 'NO_PICO'),
    ('2a65bc3e-855d-4187-bd5c-465c98e6043a'::uuid, 'PICO'),
    ('94daf50f-bcc7-4723-8d60-3c69733e76a6'::uuid, 'NO_PICO'),
    ('96a1364e-245c-4c31-be1f-ed184226a61e'::uuid, 'PICO'),
    ('172ec304-9258-4e09-b4ae-c3ffc072c52a'::uuid, 'NO_PICO'),
    ('1a3170f1-3cb6-4571-88ca-22f2e9120356'::uuid, 'PICO'),
    ('2650b0f0-7c2c-4321-956e-dc2cb7571057'::uuid, 'NO_PICO'),
    ('2cdafca9-2ecc-4964-85b8-7d5b6bddfa1e'::uuid, 'PICO'),
    ('533a9a50-d566-4132-8930-ba645c3b9187'::uuid, 'PICO'),
    ('c02da23b-5eae-4b93-83a0-7cac6d127e7a'::uuid, 'NO_PICO'),
    ('9e7e6aaa-b910-454d-9d12-fb08e10fee64'::uuid, 'PICO'),
    ('7aae5c15-32f5-460c-906d-22079bf529a0'::uuid, 'NO_PICO'),
    ('40766b16-d80d-4575-908f-240ed8b3665d'::uuid, 'PICO'),
    ('d4d79c4a-63f0-4661-b54a-7b25ad46245f'::uuid, 'NO_PICO')
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
