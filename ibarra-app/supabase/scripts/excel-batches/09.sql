WITH excel(id, status_excel) AS (
  VALUES
    ('c641bea8-0661-45db-bb39-e228afce5c1b'::uuid, 'NO_PICO'),
    ('b81af38f-5e76-4b1e-ab8b-ec437e45483b'::uuid, 'NO_PICO'),
    ('dcfc9cbd-7469-45d9-b255-90f619dfd5dd'::uuid, 'NO_PICO'),
    ('34157981-63a0-4ab5-b835-d99073720eef'::uuid, 'NO_PICO'),
    ('81b58183-b651-40b2-8982-ffbc2f07f11f'::uuid, 'NO_PICO'),
    ('003ddcd1-ca16-4401-abe6-8ce87aa922a6'::uuid, 'NO_PICO'),
    ('7a8872ef-cdba-4c12-bb6c-0c7808325da4'::uuid, 'NO_PICO'),
    ('26fa5e39-34b5-4653-ba30-186080511f47'::uuid, 'NO_PICO'),
    ('02b22577-c8f2-4b0d-a0f5-32ffa4df076c'::uuid, 'NO_PICO'),
    ('486d3278-50bb-4c53-a14f-15fb5a26754a'::uuid, 'NO_PICO'),
    ('22f751c9-f4e3-4273-b7ca-fb5a0a8113e3'::uuid, 'NO_PICO'),
    ('ecfc9107-25e0-47c5-8139-b8832af40e71'::uuid, 'NO_PICO'),
    ('d5e7f748-b85d-49e9-b8d8-ebbe484343d7'::uuid, 'NO_PICO'),
    ('48de8c93-914b-42a8-9097-dfc6996f2ccc'::uuid, 'NO_PICO'),
    ('a2be7c28-1b3f-4fe2-bdc8-43e5eb101944'::uuid, 'NO_PICO'),
    ('1e3dee54-74c0-446c-8f34-758065e68b74'::uuid, 'NO_PICO'),
    ('1edea0b0-7c08-4b96-a0a1-6f1d05de5236'::uuid, 'PICO'),
    ('6869b429-95a5-4e34-bf8f-6eae1d913699'::uuid, 'NO_PICO'),
    ('2d796829-0744-44d9-b906-d3770b16cd25'::uuid, 'PICO'),
    ('dffd8c05-5d2c-4a40-b478-9c117948a578'::uuid, 'NO_PICO'),
    ('c04b6663-70e4-450c-a4e2-3f8e1506870a'::uuid, 'NO_PICO'),
    ('d188225d-31b7-4624-85b7-5841dcd0c38d'::uuid, 'NO_PICO'),
    ('f3299d4e-8362-4d38-8d2a-960f660a2310'::uuid, 'NO_PICO'),
    ('2647134b-bf92-4133-b531-1e5eb82f84e3'::uuid, 'NO_PICO'),
    ('d3e6aa00-9860-4eac-a78e-bd38a6079bbd'::uuid, 'NO_PICO'),
    ('89c78621-922e-4622-8537-efa7ca1576e9'::uuid, 'NO_PICO'),
    ('52249207-161f-423b-ba24-2353095e3ba0'::uuid, 'PICO'),
    ('29e0a311-ea03-4879-97cb-c48a476dbdcd'::uuid, 'NO_PICO'),
    ('a88f6162-a878-4890-a5cc-574af2233959'::uuid, 'PICO'),
    ('4e6d19f4-9ed7-4168-a8d6-82e7bd6afd14'::uuid, 'NO_PICO'),
    ('ab880068-9400-42fb-956b-d92a5de938e0'::uuid, 'PICO'),
    ('fe344d3d-2431-404a-9861-db1d5f3ad510'::uuid, 'NO_PICO'),
    ('a3e24d4a-5aa7-4f97-bc60-5d1c971363bf'::uuid, 'NO_PICO'),
    ('e99cfa96-0a2b-4296-b413-b06045f45b99'::uuid, 'NO_PICO'),
    ('b4f3fca3-f3a1-49bd-81da-7094f75faa4d'::uuid, 'NO_PICO'),
    ('7023975a-1bfc-43e3-b961-42ce98f44c91'::uuid, 'NO_PICO'),
    ('56f78837-1ac4-4d22-92d4-409b1dead5af'::uuid, 'NO_PICO'),
    ('14a4bf77-df43-4346-b621-d3bd8fcb8a66'::uuid, 'NO_PICO'),
    ('9d1aae95-2230-4c22-8587-986ef5fbdaa0'::uuid, 'NO_PICO'),
    ('ccd5cb78-7227-41d5-a2ba-bc3662858b6b'::uuid, 'NO_PICO'),
    ('65a0a1fc-79d6-4255-bdbd-48291c3c4eee'::uuid, 'NO_PICO'),
    ('6f88be45-1822-4bde-9280-17777786b808'::uuid, 'NO_PICO'),
    ('d7285be3-937f-4820-9c05-e8f833bca4ce'::uuid, 'NO_PICO'),
    ('68e21083-e5d1-4fd8-8218-88228b2a216f'::uuid, 'NO_PICO'),
    ('302e6235-9188-498b-9c9b-803feb7b8cbf'::uuid, 'NO_PICO'),
    ('047c6b21-d4bf-479f-aeb4-2db2a21e1469'::uuid, 'NO_PICO'),
    ('84ba1500-f941-40b5-9403-587cedd8abf7'::uuid, 'NO_PICO'),
    ('952b2e33-9da2-437e-98bc-e6f0d2fb0dbb'::uuid, 'NO_PICO'),
    ('ee5e7921-64d4-46b6-845f-94757f5638bc'::uuid, 'PICO'),
    ('f6d1dd28-4a00-4a5d-a0a2-33b59878e55d'::uuid, 'NO_PICO'),
    ('6e86cd27-4ef0-47bc-96db-8f61ac4a663d'::uuid, 'PICO'),
    ('f0b4cc2a-e304-4fee-80d3-f1484f0de5d0'::uuid, 'NO_PICO'),
    ('e464923f-7085-4065-b7e1-72eada0d89f4'::uuid, 'NO_PICO'),
    ('631d9d53-ba39-447f-b149-ccabc1fcfbf9'::uuid, 'NO_PICO'),
    ('0a75d2f9-062c-41ed-ac5b-dda4ea84f32e'::uuid, 'NO_PICO'),
    ('ecf1f7cb-bce2-407b-a934-516c13d977d5'::uuid, 'NO_PICO'),
    ('6142d9cf-625a-4a4d-a11e-b7584210db51'::uuid, 'NO_PICO'),
    ('cb33f9a3-c00d-4101-af54-3eb5d720c15a'::uuid, 'NO_PICO'),
    ('24b53f18-46c9-4efb-8127-89fe793b7403'::uuid, 'NO_PICO'),
    ('a8b5f8fe-3e79-484c-a845-f20c94f842b4'::uuid, 'NO_PICO'),
    ('2bc481f9-102b-4bb1-b44c-58e70cc84ade'::uuid, 'NO_PICO'),
    ('b7c01ff9-fcbb-44e2-abcf-f7f46903b3d9'::uuid, 'NO_PICO'),
    ('d7bb2ec4-b48a-4e25-bc81-1c8c4c598d2b'::uuid, 'NO_PICO'),
    ('b3c9d00d-880b-4030-ab62-619bf99dd31a'::uuid, 'NO_PICO'),
    ('0538b7ba-34ce-4646-997e-6c92628974d6'::uuid, 'NO_PICO'),
    ('bf402120-1cb5-4799-95fb-27092295135d'::uuid, 'NO_PICO'),
    ('38dfe434-5f60-48b7-a013-819da186b606'::uuid, 'NO_PICO'),
    ('651392f9-c87e-49cf-b2a8-edcb78d14c74'::uuid, 'NO_PICO'),
    ('d3fd8ef0-6941-4a2c-ae72-fed711b31863'::uuid, 'PICO'),
    ('dc78394f-cd7e-4c4c-a427-228495ac8a23'::uuid, 'NO_PICO'),
    ('4a338779-6599-4232-81b8-43cb6d58547d'::uuid, 'NO_PICO'),
    ('16cc6b55-f894-44ab-a38e-486573aa9271'::uuid, 'NO_PICO'),
    ('24386190-641c-4919-9c7c-e4e29a595ff6'::uuid, 'NO_PICO'),
    ('b3a6e3d0-dea0-4823-95a9-cf8720f102da'::uuid, 'NO_PICO'),
    ('cc1d8fa7-1d58-4c03-8145-38fa3ab9baa2'::uuid, 'NO_PICO'),
    ('9abefa78-109e-4c0f-baee-502a3740e002'::uuid, 'NO_PICO'),
    ('38c38031-d1d0-478f-b112-2e3d42a41dd4'::uuid, 'NO_PICO'),
    ('e4cd82d9-06b5-485e-a98d-f60634cc55aa'::uuid, 'NO_PICO'),
    ('8ed8becd-4dc9-4706-81e0-86d7921820bb'::uuid, 'NO_PICO'),
    ('e149578a-87be-4134-9a69-53f2c39a30b3'::uuid, 'NO_PICO')
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
