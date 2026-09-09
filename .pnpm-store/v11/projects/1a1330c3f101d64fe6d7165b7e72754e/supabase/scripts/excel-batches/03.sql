WITH excel(id, status_excel) AS (
  VALUES
    ('c3d99edf-8bbe-46c7-a350-b6e9fd9b82fe'::uuid, 'PICO'),
    ('2152abcf-0a83-49cf-9ea6-b4b38b9dd99f'::uuid, 'NO_PICO'),
    ('fc6f0530-9511-4d23-a2b2-f4760bf29e80'::uuid, 'NO_PICO'),
    ('bf31a916-8303-4946-84b6-0405939fcf0d'::uuid, 'PICO'),
    ('83113128-8443-4ecf-8706-70d8bce51e52'::uuid, 'NO_PICO'),
    ('f65e124d-2b32-49e2-8995-224e6d6380bf'::uuid, 'PICO'),
    ('3fd51d9d-4551-49a0-9a94-02fcb7bc055e'::uuid, 'NO_PICO'),
    ('b38feba3-48a4-4a43-984c-5cba0e8a565c'::uuid, 'PICO'),
    ('fa78f5b0-c5b5-419c-897f-a1d2e6817447'::uuid, 'PICO'),
    ('4ef05476-95a4-4ea6-898a-e77cb5cf43ef'::uuid, 'NO_PICO'),
    ('fa0ab476-44fa-400d-955e-730016c2f5a0'::uuid, 'NO_PICO'),
    ('51b853b7-20f3-4800-be41-f8732f459fff'::uuid, 'NO_PICO'),
    ('da95834c-247c-49d0-ba85-7353bd281856'::uuid, 'PICO'),
    ('6ea62912-9093-4286-badf-4c25df92fa67'::uuid, 'NO_PICO'),
    ('c86b9a58-7901-49df-89ce-243b296ce061'::uuid, 'NO_PICO'),
    ('4e69717f-946a-401e-9631-8a11a87c0e20'::uuid, 'PICO'),
    ('6e6715cd-8279-4b01-8908-cdb3bf9cb75b'::uuid, 'NO_PICO'),
    ('be59828e-ff38-4ae8-a35f-93c148ceb0aa'::uuid, 'PICO'),
    ('dee7e0a4-342c-46c4-916f-686a84e06782'::uuid, 'NO_PICO'),
    ('12a25b36-5f2c-41da-936c-c37622def746'::uuid, 'PICO'),
    ('096e851f-05d2-4953-b37d-5dcce2fac536'::uuid, 'NO_PICO'),
    ('f6528f1e-29e1-42ba-884a-a0bb07e8e8bd'::uuid, 'NO_PICO'),
    ('9f0b8cd5-b81a-4cc9-b55e-93d2e6c36fe5'::uuid, 'PICO'),
    ('320c8f02-286f-4f4f-bb2e-0d94723c0ceb'::uuid, 'NO_PICO'),
    ('fe60ab48-5af5-4f0d-b482-68cd4955d1cc'::uuid, 'PICO'),
    ('eab9c040-27a2-4ee5-88c7-c355f2caf731'::uuid, 'NO_PICO'),
    ('3c818038-128f-4c8b-8def-83e80f254782'::uuid, 'PICO'),
    ('879c97e0-07af-42bc-818d-d52bcd91897e'::uuid, 'NO_PICO'),
    ('622edf78-8362-4611-9edb-1903b8afa6bc'::uuid, 'PICO'),
    ('30def6ca-e975-4a78-8d96-0b6d44fa5d79'::uuid, 'NO_PICO'),
    ('3a334ec7-425a-47fd-94ff-fc621f6115bd'::uuid, 'PICO'),
    ('2ba275bd-dd5e-4de1-8c55-2dc67eae771b'::uuid, 'PICO'),
    ('b9d4a6db-af0f-4788-acbb-e39ccd4c39ac'::uuid, 'NO_PICO'),
    ('4d8284fa-7df8-4a82-a631-5d053406063d'::uuid, 'PICO'),
    ('4a5e773f-34b5-496b-ae37-379d9b8eb11d'::uuid, 'NO_PICO'),
    ('6d843c56-72f9-44f9-9f80-57a21afa0995'::uuid, 'PICO'),
    ('6f100a4a-80cc-405e-a8c7-fe646784c5ee'::uuid, 'NO_PICO'),
    ('f5804d9d-6759-4dbf-9238-c3c181589654'::uuid, 'PICO'),
    ('41c3f7ea-1503-4d75-8e86-61103629b67c'::uuid, 'NO_PICO'),
    ('7c23f8b0-65c8-48db-a69d-a20b656ef2f7'::uuid, 'PICO'),
    ('6f5e140a-d0cf-40d3-8713-d91a40b2a6c3'::uuid, 'NO_PICO'),
    ('8b02083b-2902-4d2e-ab91-bb71a3835b44'::uuid, 'PICO'),
    ('08806bf3-8426-4f2d-9222-0a680ee9cc4e'::uuid, 'NO_PICO'),
    ('0355d14d-0e71-4fbb-9ada-c9cec68c4633'::uuid, 'NO_PICO'),
    ('8ae9f4d7-9ed4-4bca-a264-db3e67279a8c'::uuid, 'NO_PICO'),
    ('f581753c-c0e8-49b8-b295-a63a91a8c2bc'::uuid, 'PICO'),
    ('ae268018-a6c6-43ed-9d14-e68e8f0a5eb8'::uuid, 'NO_PICO'),
    ('947b007e-4921-4b2b-99c6-303f30f988da'::uuid, 'PICO'),
    ('28aec1a2-736f-4c4f-98a5-d8db6e9189b3'::uuid, 'NO_PICO'),
    ('adb2a268-4a78-45ad-9725-6839f575cd9f'::uuid, 'PICO'),
    ('7d8137e8-d42a-4968-89c7-2e08589e91cc'::uuid, 'NO_PICO'),
    ('970ea1e1-7a79-4653-814a-bdcc57b20818'::uuid, 'PICO'),
    ('28e94479-06f2-4988-bfad-273498d37a22'::uuid, 'NO_PICO'),
    ('b3c5f352-a0df-4a73-b905-e98e7af861f6'::uuid, 'PICO'),
    ('06a0448b-5e2a-420d-9bb5-365b3ce247e6'::uuid, 'NO_PICO'),
    ('b0a9576d-b564-4c16-99a1-20a2093a7ab1'::uuid, 'PICO'),
    ('4be8a8bb-1a9c-41bf-9d01-f38e32558c79'::uuid, 'PICO'),
    ('449707bb-5125-498f-8a40-1da481f2c152'::uuid, 'PICO'),
    ('16b5b042-11dc-4a12-aa77-9f53dafe7ecc'::uuid, 'NO_PICO'),
    ('f45843a8-6432-474f-acf3-62c349e3d442'::uuid, 'PICO'),
    ('76a5b341-ef89-4a7e-b1b4-763664f8adde'::uuid, 'NO_PICO'),
    ('3a2378e2-6f33-4692-80c7-956f1bad3709'::uuid, 'PICO'),
    ('2327c1c7-50bf-48d8-ad09-eb1bb000914a'::uuid, 'PICO'),
    ('4936dd3c-a425-433c-a90a-16d85816d294'::uuid, 'NO_PICO'),
    ('a149932e-552a-4d03-984b-c7a1781425db'::uuid, 'NO_PICO'),
    ('61d15f2c-12c8-4beb-897f-99d8f779b256'::uuid, 'NO_PICO'),
    ('911850f0-3560-4a32-bcc3-ecfa3273ecb8'::uuid, 'NO_PICO'),
    ('7d706d04-f7d5-4943-9a65-b1c2604b56e2'::uuid, 'NO_PICO'),
    ('cf7c5ef8-fbae-4cc9-84fa-b587053e4d7f'::uuid, 'NO_PICO'),
    ('eedee6cc-6d7f-4ff3-867d-3c4c71e72019'::uuid, 'NO_PICO'),
    ('0d1a5351-bf2b-43bf-8664-b45c6e755aec'::uuid, 'NO_PICO'),
    ('caddbb11-cc5c-4b43-98c6-ab58cac59051'::uuid, 'NO_PICO'),
    ('652fd933-8062-4a82-b441-2bb71c3a8031'::uuid, 'NO_PICO'),
    ('8c9540fe-d705-4636-93ca-673809eec7fb'::uuid, 'NO_PICO'),
    ('6640ac75-9a6e-4850-8d6e-134a80fa7c8d'::uuid, 'NO_PICO'),
    ('58c02132-eeb3-499f-b9da-79c3420cd2b4'::uuid, 'NO_PICO'),
    ('cdca512d-fba9-4000-a9f3-de625f11a600'::uuid, 'NO_PICO'),
    ('73d80081-08cb-47f1-b456-ecb182161051'::uuid, 'NO_PICO'),
    ('eb52bed1-a451-4a23-8a27-11815b0b953d'::uuid, 'NO_PICO'),
    ('62456b60-a5f2-4b76-991c-1522b89c61ee'::uuid, 'NO_PICO')
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
