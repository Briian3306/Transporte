WITH excel(id, status_excel) AS (
  VALUES
    ('87a51e86-3d8a-4caf-91be-1e4bf24b041a'::uuid, 'NO_PICO'),
    ('7f8b7b0c-9b9d-42e5-8a4f-357e6466bc62'::uuid, 'PICO'),
    ('9c751801-b284-4f58-8a90-8888bdc8d4d4'::uuid, 'NO_PICO'),
    ('160f12d0-03af-4f27-acbf-615eec794c74'::uuid, 'NO_PICO'),
    ('78f80b89-bf8c-473d-baad-fd36b8f0ef16'::uuid, 'NO_PICO'),
    ('c08eddd1-1f5e-49a1-86ce-b3dd242ddf2b'::uuid, 'NO_PICO'),
    ('3defdf23-cb6d-42f9-8bb7-ab03a887fad4'::uuid, 'NO_PICO'),
    ('763f0ae7-82bf-49e5-b1cd-3b81125177c7'::uuid, 'NO_PICO'),
    ('f5433db0-68e0-4031-86b0-368ce05089a9'::uuid, 'PICO'),
    ('34470eac-3910-4e84-ab6f-db177c624a08'::uuid, 'NO_PICO'),
    ('bbcc73ab-7901-4da7-ac1c-771f15069e5f'::uuid, 'PICO'),
    ('362a4661-d90e-4ca9-b747-59ffd1201291'::uuid, 'NO_PICO'),
    ('fabb5778-16e9-428d-8331-a6f2e9cd7973'::uuid, 'NO_PICO'),
    ('b88f2a52-7f67-4609-a082-0e3bc1e464b7'::uuid, 'NO_PICO'),
    ('451809eb-6d5b-459c-82da-1dadf05fe8fe'::uuid, 'NO_PICO'),
    ('dafa66e7-f9c4-4955-9186-171f0d1897e6'::uuid, 'NO_PICO'),
    ('5805112d-815e-40cc-a82d-2d28b3defbe1'::uuid, 'NO_PICO'),
    ('c9540c0e-1717-4d85-a306-2ca75ab5901b'::uuid, 'PICO'),
    ('584993c5-2c32-48a7-afb7-e797a6474fae'::uuid, 'NO_PICO'),
    ('3b8ec0c8-03cc-4fbb-aa85-7fb1bdbdb3ce'::uuid, 'PICO'),
    ('57b70a5a-134a-48c2-9b24-a472a20493a6'::uuid, 'NO_PICO'),
    ('00d3541e-1a01-4554-82d7-106b235ac34e'::uuid, 'PICO'),
    ('ca67e764-a33c-449d-a4c4-c132297fd061'::uuid, 'NO_PICO'),
    ('2ce269a4-293c-48d6-929a-b4555f34c511'::uuid, 'NO_PICO'),
    ('faabffdd-acca-4d8c-a2eb-0d4877718f84'::uuid, 'NO_PICO'),
    ('9466b0d1-c0a0-40db-9a46-c305fd1e0650'::uuid, 'NO_PICO'),
    ('3b1fd255-9421-4492-931a-897b7720c455'::uuid, 'NO_PICO'),
    ('d1cdbc53-5405-4d4f-96c1-ee8aba679de0'::uuid, 'NO_PICO'),
    ('b474e07c-347f-44d6-a393-73cee1ffe4c6'::uuid, 'NO_PICO'),
    ('0ef2a734-a5ac-4481-8adc-34aaff8f3322'::uuid, 'NO_PICO'),
    ('145809d8-4414-4ecd-a2b8-64788307ff39'::uuid, 'NO_PICO'),
    ('6390b0c8-9591-4ede-bee7-8721308aa97f'::uuid, 'NO_PICO'),
    ('2de1e5ae-353c-4f89-9fd8-a7fe118caace'::uuid, 'NO_PICO'),
    ('ac50b230-935b-40be-b72d-1b3adfe71909'::uuid, 'NO_PICO'),
    ('08b92911-35c0-4f9d-b946-9c97cd6f9e7e'::uuid, 'NO_PICO'),
    ('902b21e8-4703-420e-a1ac-72eb1dae4542'::uuid, 'NO_PICO'),
    ('e0150f1e-8b62-470d-8e61-cc2fb61dcc77'::uuid, 'NO_PICO'),
    ('62dd3666-34db-46a2-99e8-2a0b9b1356f8'::uuid, 'NO_PICO'),
    ('0340cf46-b913-4ba3-b996-65d42b4649f8'::uuid, 'NO_PICO'),
    ('99b48997-e1ee-4787-8352-bb0fbf92a3f2'::uuid, 'NO_PICO'),
    ('eb4ee65a-a5bd-4668-b8a6-471639f206f8'::uuid, 'NO_PICO'),
    ('29aa1c38-a871-40b8-83bd-cc279ffdf048'::uuid, 'NO_PICO'),
    ('ece6ac92-6a0b-4d09-8932-58d90e30c6ae'::uuid, 'NO_PICO'),
    ('9c4be4f0-6eb5-4d61-bed0-857c201e926e'::uuid, 'NO_PICO'),
    ('3b0a59f9-bc47-467e-8f77-b0f2e6afdaf9'::uuid, 'NO_PICO'),
    ('0f3bd17e-8d06-4a01-a09a-bdd0ecc0a411'::uuid, 'PICO'),
    ('d56f7a94-e995-4b42-9439-73f6aede78d6'::uuid, 'PICO'),
    ('d8246873-f2cf-4595-8e3f-0dfebc8304d5'::uuid, 'NO_PICO'),
    ('93ed392e-749c-49b5-8caa-cab5c8066ad1'::uuid, 'NO_PICO'),
    ('bd284e6f-2e09-41f4-90ab-c9d89c2d3e05'::uuid, 'NO_PICO'),
    ('e666525f-ed26-4fb0-bf7a-0e96094b141f'::uuid, 'NO_PICO'),
    ('c7828077-813f-4ece-827e-3302822f4498'::uuid, 'NO_PICO'),
    ('01f78cb7-af42-47c8-89f1-fab57ae49312'::uuid, 'NO_PICO'),
    ('938ba8e4-21a6-4e77-a825-11c5257f8250'::uuid, 'NO_PICO'),
    ('e7180b4f-bdee-4a0f-b82e-bd0f956e88a6'::uuid, 'NO_PICO'),
    ('565885ff-ef9f-44c7-b141-5921d5e3672b'::uuid, 'NO_PICO'),
    ('bcab1165-5e14-4ec5-a5f9-4152bd928a62'::uuid, 'NO_PICO'),
    ('99dac8f7-1e7d-424d-bffb-606278cbdf34'::uuid, 'NO_PICO'),
    ('eaad7a70-ead9-4ead-8e8c-a225160b440d'::uuid, 'NO_PICO'),
    ('6f0d90a7-3e89-4283-bbc7-a2b4f549a469'::uuid, 'NO_PICO'),
    ('3c9e459c-acb5-49b2-975c-1895b6616cf1'::uuid, 'NO_PICO'),
    ('cb596336-0b18-4bb2-b14a-1c213d7ec123'::uuid, 'NO_PICO'),
    ('54918ad9-471d-4dd8-a8bc-5cfe96be88ee'::uuid, 'NO_PICO'),
    ('dc57763a-bf0a-4948-8656-c9002e7f3db2'::uuid, 'NO_PICO'),
    ('bb21fcf6-a158-4f09-8d75-81f358bd1a68'::uuid, 'NO_PICO'),
    ('2fe0a401-c0bd-4d83-8cbc-7d822329fa8d'::uuid, 'NO_PICO'),
    ('a3d3d131-5953-46fa-b9d5-b89c3b961115'::uuid, 'NO_PICO'),
    ('550c1df9-3bc3-43c2-9148-7d81430ca371'::uuid, 'NO_PICO'),
    ('e59376ea-d2e8-49ac-86f9-97a9488fb159'::uuid, 'NO_PICO'),
    ('998d821e-4022-48aa-a5c6-7d9b2a861cdb'::uuid, 'NO_PICO'),
    ('bfc21f34-0bd1-4382-aced-ce46e18d0661'::uuid, 'NO_PICO'),
    ('cc2f224e-18c0-4fa5-ab66-17e47b568f44'::uuid, 'NO_PICO'),
    ('19583751-10ac-4c0e-986c-f8103ea2982f'::uuid, 'PICO'),
    ('c2bdb43b-e139-49ff-938d-c3c16777515f'::uuid, 'NO_PICO'),
    ('f62ad0b4-b255-4cfa-a70f-6907583ba482'::uuid, 'NO_PICO'),
    ('ab904eb6-277f-4ccb-abc3-3910031ec7f1'::uuid, 'NO_PICO'),
    ('c91b3114-f482-400c-a74c-a50fd027c991'::uuid, 'NO_PICO'),
    ('9af7d1cc-e2ed-425d-8fbf-b39aebc162df'::uuid, 'NO_PICO'),
    ('4a7507ca-e0f0-4253-b800-4f3b141f353c'::uuid, 'NO_PICO'),
    ('c9f23f14-7757-41f1-9ba1-1c6216b35157'::uuid, 'NO_PICO')
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
