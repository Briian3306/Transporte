WITH excel(id, status_excel) AS (
  VALUES
    ('728f4fc2-4137-4131-a2c8-ae956fd9de95'::uuid, 'NO_PICO'),
    ('ce23d3aa-401b-455e-82c0-b40f6a6572cb'::uuid, 'NO_PICO'),
    ('2c4885e6-ff7e-4fe5-884e-1b7d7eb169bf'::uuid, 'NO_PICO'),
    ('53872912-4cec-46bf-8b6b-184a72a8a0da'::uuid, 'NO_PICO'),
    ('a7a7230c-b2a8-46ec-9648-1c96e580cbec'::uuid, 'NO_PICO'),
    ('631678e6-718b-4c0e-ba8f-68127948d73e'::uuid, 'PICO'),
    ('6174f428-afb1-48e9-b9b4-09c0044fe4b3'::uuid, 'PICO'),
    ('19e29d0c-181b-480c-a3b1-ffc4b3c74c58'::uuid, 'NO_PICO'),
    ('a23c4a91-40e4-4df4-8a84-843e0c4562b0'::uuid, 'NO_PICO'),
    ('e048a254-bd2b-4452-bf85-b5cfb87dbc15'::uuid, 'PICO'),
    ('e5718a46-2d28-487e-9a20-551b406ba145'::uuid, 'NO_PICO'),
    ('f616ac71-0f3b-4e57-b5cd-764ae60c9434'::uuid, 'NO_PICO'),
    ('0ca6db3f-1497-4192-9561-125bfd7e7133'::uuid, 'NO_PICO'),
    ('eee8169a-3bb4-465f-a17a-50702a600b58'::uuid, 'PICO'),
    ('bef8200d-c60b-40e0-9524-7a163fa22923'::uuid, 'NO_PICO'),
    ('3fcc6e45-741c-4bd7-876e-7a8991fb8b14'::uuid, 'NO_PICO'),
    ('eaab1a56-eb47-4de1-9436-7a694d5797e1'::uuid, 'PICO'),
    ('3c92f30f-ee13-4b55-ae9a-c1b5faaefcfe'::uuid, 'NO_PICO'),
    ('11d704fd-8cd9-4395-bb08-05f3106fd6f3'::uuid, 'PICO'),
    ('4bad6433-c080-4e91-9406-446e92d04855'::uuid, 'NO_PICO'),
    ('f619997e-fa4f-4e3c-846d-189dfe0a474b'::uuid, 'NO_PICO'),
    ('02963da5-aeba-4d42-bdbb-54a00af552ab'::uuid, 'NO_PICO'),
    ('959648d3-442c-4e19-a110-af089700ffc9'::uuid, 'PICO'),
    ('abf4f450-dc7f-4854-98a7-02f501e6f0f1'::uuid, 'PICO'),
    ('a7f08e58-241e-4bd6-91cd-65f83a08dfac'::uuid, 'NO_PICO'),
    ('7bbfc66c-fdbf-48c3-9b89-5229167443cd'::uuid, 'PICO'),
    ('526693d1-7a09-404f-8415-776060d02657'::uuid, 'NO_PICO'),
    ('80151cd1-8fe8-4706-9716-6076af828a49'::uuid, 'NO_PICO'),
    ('60e3a36d-09e0-4dd8-af01-cabdf3bdf610'::uuid, 'NO_PICO'),
    ('269ccf29-fee1-46d6-b6a6-6a9e78ba66f6'::uuid, 'PICO'),
    ('1c6aee8c-8615-49d0-9bd4-6ebc95b83773'::uuid, 'PICO'),
    ('a4520ff4-9e24-46e9-80d8-89a6fcf476b8'::uuid, 'NO_PICO'),
    ('2046fbab-2849-431b-a641-db0a0e7d501a'::uuid, 'PICO'),
    ('87bb7e38-153f-4c05-8651-97bd4dc5072e'::uuid, 'NO_PICO'),
    ('72892cc3-ea33-40d9-923b-d6248c3f5988'::uuid, 'PICO'),
    ('a9543f63-c1d8-423d-9646-51423553e5cc'::uuid, 'NO_PICO'),
    ('30244159-ebc4-4fef-a5a0-932e6e56fba5'::uuid, 'PICO'),
    ('90d8d6f6-c396-4a2c-9da7-a15d0eb235c4'::uuid, 'NO_PICO'),
    ('55433bde-12b0-4a2a-ade0-50b53c1af822'::uuid, 'NO_PICO'),
    ('65947e78-7bf2-44dd-a082-0b3738a8ed58'::uuid, 'NO_PICO'),
    ('20fc34c7-b905-4712-b9fb-d4e3f788fba0'::uuid, 'PICO'),
    ('3dc78ef2-30f1-4755-9e12-18673f10ea3f'::uuid, 'PICO'),
    ('4f75da74-f4a6-4fd2-a6b6-07e27628da99'::uuid, 'PICO'),
    ('aca5429a-c7fb-460e-b595-606fa55224bb'::uuid, 'NO_PICO'),
    ('52802c21-a996-4447-bff8-8a6d5962e912'::uuid, 'NO_PICO'),
    ('31acb652-f0f8-43c8-b45a-f0ad2999ddf5'::uuid, 'PICO'),
    ('ba7f054c-167c-4b7c-8576-dd0327d75958'::uuid, 'PICO'),
    ('429e9070-16be-457e-99ee-d7dcc6e52209'::uuid, 'PICO'),
    ('b4c4ec97-5f62-463e-b44c-c95cfd92d9be'::uuid, 'NO_PICO'),
    ('decb9986-6de8-4bde-a7c7-c435b146d247'::uuid, 'NO_PICO'),
    ('16505183-f10a-4403-af19-731bc98c02ae'::uuid, 'NO_PICO'),
    ('d9af5742-3ff4-49f7-af9d-b01f745729ec'::uuid, 'NO_PICO'),
    ('067e4143-1ef0-421b-b52c-91148a5cc7cc'::uuid, 'NO_PICO'),
    ('724f2fdd-b0e1-49f9-a6dd-14821afe2717'::uuid, 'PICO'),
    ('2742b670-f8ea-44ba-ae67-1bb29ba73efc'::uuid, 'NO_PICO'),
    ('e0c5cbe5-fb26-4648-9aff-d3bbb6506fd8'::uuid, 'PICO'),
    ('66e0a65e-db32-40f7-ad8b-4c975e168a57'::uuid, 'NO_PICO'),
    ('bea73ba5-7cbc-4115-a6c0-70d822264599'::uuid, 'NO_PICO'),
    ('19b7adca-0848-47f7-a117-580e9e3062cf'::uuid, 'PICO'),
    ('e4468527-ebad-41ca-a8a6-f4b7a2cf1512'::uuid, 'PICO'),
    ('6c99541f-9930-469a-9872-92c501d30add'::uuid, 'NO_PICO'),
    ('3bb63414-ef7f-4d09-ad29-833f4bda4ea5'::uuid, 'PICO'),
    ('2663ad47-7209-499e-a0ea-170e9e7e852e'::uuid, 'NO_PICO'),
    ('0fea0c5c-f64c-43d6-9da6-2008a066c1bd'::uuid, 'NO_PICO'),
    ('3c60213a-71d2-4c1f-b940-cbdc478bb802'::uuid, 'NO_PICO'),
    ('9919abaa-b2b6-4448-a6f0-79d0de23d54a'::uuid, 'NO_PICO'),
    ('f92160af-d8fc-450e-9ad2-8d8cf3d00640'::uuid, 'NO_PICO'),
    ('eed4f0a6-882f-46d7-9f3b-15f27ff97187'::uuid, 'NO_PICO'),
    ('5926c661-a9e5-4031-835a-1e601c900093'::uuid, 'NO_PICO'),
    ('cffce8f9-f825-4da7-9203-58023110839a'::uuid, 'PICO'),
    ('da1d0684-fbec-4352-9733-48baee1fa5b1'::uuid, 'NO_PICO'),
    ('cf980474-62d1-4db9-b993-b7b8872f960e'::uuid, 'NO_PICO'),
    ('9b7197fd-377a-407c-af58-5696ba752acc'::uuid, 'NO_PICO'),
    ('cecc1523-51fe-4458-a7c4-d69b0f18e784'::uuid, 'NO_PICO'),
    ('dc39322d-7010-4872-b148-7b8dcd85a1fd'::uuid, 'PICO'),
    ('dda58591-ef9d-4087-96f6-d2a1150dfb0f'::uuid, 'NO_PICO'),
    ('59076f21-1f84-48f1-a0bd-8d149ad2d5ce'::uuid, 'PICO'),
    ('42d0099e-5d84-440b-bba2-69fce7aadfbc'::uuid, 'NO_PICO'),
    ('5fea254f-cb83-4e83-913b-50e4aaf5d11a'::uuid, 'PICO'),
    ('4c27fd50-d624-4985-9375-d7bc02925873'::uuid, 'NO_PICO')
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
