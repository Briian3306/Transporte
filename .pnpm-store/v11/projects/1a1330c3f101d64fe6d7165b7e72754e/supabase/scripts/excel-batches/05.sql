WITH excel(id, status_excel) AS (
  VALUES
    ('1c4aef2a-4178-4cca-9960-ca2f32849d1f'::uuid, 'PICO'),
    ('a4017a5e-7a22-44d4-bb08-a02307da81c7'::uuid, 'NO_PICO'),
    ('21dd0f14-982d-4eb4-a380-62962d199bbc'::uuid, 'PICO'),
    ('b33cdae7-b6f6-47e6-ae4b-4cd69830ef02'::uuid, 'NO_PICO'),
    ('c6412c43-3cf7-4329-8cb6-e975ed3b2542'::uuid, 'PICO'),
    ('2aa33261-008c-4734-96b8-dffbbd88416b'::uuid, 'NO_PICO'),
    ('8266cec8-71b2-41bf-807f-2b92b9220598'::uuid, 'PICO'),
    ('ec5d21ab-c22d-43f3-8eca-a6ef469b2fea'::uuid, 'NO_PICO'),
    ('6cbae852-28bb-499f-8514-33b929569087'::uuid, 'PICO'),
    ('f8affdb6-c3c2-46cf-9db7-af59228ce601'::uuid, 'NO_PICO'),
    ('20ecf28e-6682-459c-99e5-24c680591065'::uuid, 'NO_PICO'),
    ('9f936d9b-6903-4bc0-8ac0-b2bac2634f4f'::uuid, 'PICO'),
    ('9409f6bb-7e80-4948-a6c5-4657e0e1145d'::uuid, 'NO_PICO'),
    ('82c9e6cd-6b22-460d-8d2a-92f846a6f1ce'::uuid, 'NO_PICO'),
    ('8bf69ff5-ff6f-41c5-8038-05541291fcf2'::uuid, 'NO_PICO'),
    ('4a025af4-0a08-4bd1-b35e-71c7b19f0137'::uuid, 'PICO'),
    ('1ea9bce3-a6e0-48c5-ad27-1d22fd84fd1a'::uuid, 'NO_PICO'),
    ('1f090a8d-17f9-450e-b797-c6b91ac01a7f'::uuid, 'PICO'),
    ('c573470a-9edf-4de9-aaab-1d130bc1845e'::uuid, 'NO_PICO'),
    ('0f796c3b-0951-4970-a4d4-66b8c3d721d2'::uuid, 'PICO'),
    ('3e626b94-ff71-4183-af76-fee888d2518c'::uuid, 'NO_PICO'),
    ('3243d366-3036-4f4e-8c5e-142dbc5e53d3'::uuid, 'PICO'),
    ('64b02f18-0b65-4c20-8192-5686e46866e7'::uuid, 'NO_PICO'),
    ('d5924899-c46f-45a2-aff9-3e41e9b6e636'::uuid, 'PICO'),
    ('3943a89b-86d0-48a6-a09a-c46e39017c47'::uuid, 'NO_PICO'),
    ('346131bb-2d07-4385-804b-7008fadc17c1'::uuid, 'PICO'),
    ('28cfbadc-698f-44ce-8adc-39052085807d'::uuid, 'NO_PICO'),
    ('792970c7-89db-4f50-9a3f-e23cd418cda3'::uuid, 'PICO'),
    ('080d6c77-c148-4308-be45-712ad16a1d7d'::uuid, 'NO_PICO'),
    ('7af9da14-c901-4489-a666-f4ddc6493df3'::uuid, 'PICO'),
    ('50588fb6-096d-4732-b1e9-e65cd614e9ef'::uuid, 'NO_PICO'),
    ('3cad050f-e2bc-4731-93e1-a8b02a5610bc'::uuid, 'NO_PICO'),
    ('2ab70bb9-080a-4d5a-b0b4-93c62d949ce7'::uuid, 'PICO'),
    ('0b0432d2-08f7-4c27-960d-1a402efba708'::uuid, 'NO_PICO'),
    ('8ce4371e-d565-4e78-83b7-e0ff7b7bcfca'::uuid, 'PICO'),
    ('a51e122a-7593-42b6-a2bb-8271fc6eed8a'::uuid, 'NO_PICO'),
    ('1ae0d8e7-d168-414a-bca1-932307244886'::uuid, 'PICO'),
    ('26b94b23-874d-4c7b-ab4c-93030c63ae48'::uuid, 'NO_PICO'),
    ('7acb122f-441c-4cdc-a8b4-038b5c6e91e0'::uuid, 'PICO'),
    ('9ac26022-7211-4ece-9cbd-39c33527d851'::uuid, 'NO_PICO'),
    ('5c3bf861-90a5-47b7-9bf9-b37bcb0c922b'::uuid, 'PICO'),
    ('82035de7-4e21-4175-b1be-c0e4d6cc18cf'::uuid, 'NO_PICO'),
    ('541dd6b6-a460-41c1-8272-77292c20498b'::uuid, 'PICO'),
    ('a41b6daf-2aff-47d1-873b-72fe07ed62c3'::uuid, 'NO_PICO'),
    ('ccfd3d3d-aead-4d60-a73c-e13f7e44d71b'::uuid, 'PICO'),
    ('bc53dbd7-06eb-4054-aa5b-a6b2e775facb'::uuid, 'NO_PICO'),
    ('c22691b0-f131-4f0a-ace3-f16a70164cde'::uuid, 'PICO'),
    ('8e1cb975-ee46-4758-813a-d1bf0714b387'::uuid, 'NO_PICO'),
    ('5a321ba3-3926-41a3-a634-c0e6815be0a3'::uuid, 'PICO'),
    ('4df83406-f038-433c-b297-f66a37e7d8ee'::uuid, 'NO_PICO'),
    ('fa43de79-b8be-4dd1-970d-2ccf88bf9715'::uuid, 'PICO'),
    ('f9dd6d72-bcd0-4c61-8971-7533231d1def'::uuid, 'NO_PICO'),
    ('df9f2083-4fc8-44ab-acc2-999e402d2d9c'::uuid, 'PICO'),
    ('7a69d306-c7e7-4d5a-8a33-19b82c925c8d'::uuid, 'NO_PICO'),
    ('ae617bea-f10f-48da-83f3-583ad12d3d53'::uuid, 'NO_PICO'),
    ('ba8530c7-de3b-4f73-aeb2-e9c9d5219b9d'::uuid, 'NO_PICO'),
    ('6995f2ca-6ef3-42bb-a4f0-5a847edaf234'::uuid, 'NO_PICO'),
    ('5606765f-e1ab-4a88-940a-6a1c35a3fa67'::uuid, 'PICO'),
    ('2e837d38-9d02-45b2-83be-1a5119bf3c6e'::uuid, 'NO_PICO'),
    ('9c6b1753-d7bb-446c-98a2-eff479c3838c'::uuid, 'PICO'),
    ('5cb0da77-0672-479d-8949-80f4afa971ae'::uuid, 'PICO'),
    ('7d0db9a6-2173-4b07-bd60-192c98500945'::uuid, 'NO_PICO'),
    ('fe708251-fb69-47f5-915e-63d56f5fc60d'::uuid, 'NO_PICO'),
    ('a1c1fd1c-2044-4709-bbbb-79e41b2e1344'::uuid, 'PICO'),
    ('037c7399-474f-484f-9501-c1aaaa729053'::uuid, 'PICO'),
    ('dec9d265-b55a-40b0-8509-008d0cdc9ba4'::uuid, 'NO_PICO'),
    ('3abb4784-e807-4b29-abd4-a18a6662c94f'::uuid, 'PICO'),
    ('2d4bccdd-0cb6-4b69-a801-ce4845161a6c'::uuid, 'NO_PICO'),
    ('6e2cfc18-2f15-4cf3-ae8f-a3ac99d91397'::uuid, 'PICO'),
    ('b991feb4-aefc-4fd5-8f29-02246e45f2f6'::uuid, 'NO_PICO'),
    ('35bf94fc-5223-4f5b-8e3f-45c522d7f496'::uuid, 'PICO'),
    ('f3aed68d-da29-4670-ba8f-3b9dd0dd32a5'::uuid, 'PICO'),
    ('8c12c531-adb3-4a65-b044-f868b3278dfe'::uuid, 'PICO'),
    ('98d2bd28-af5e-4775-94e7-5024f44005c6'::uuid, 'NO_PICO'),
    ('7bfd670a-8140-4597-87aa-77815edeb633'::uuid, 'PICO'),
    ('02d413df-dc89-43c7-9795-4a0b5414ff5a'::uuid, 'PICO'),
    ('54e0ec8f-cdf6-4d03-94ad-7927f3488fe9'::uuid, 'NO_PICO'),
    ('35b296d0-51d4-488d-9b2e-efa3a7ecfeea'::uuid, 'PICO'),
    ('a20cbe58-8617-4d33-b06b-e5c4a0617e94'::uuid, 'NO_PICO'),
    ('f47fbea0-3e1a-403f-9074-c280c665fa59'::uuid, 'PICO')
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
