WITH excel(id, status_excel) AS (
  VALUES
    ('b07ac1fd-9f5f-4dee-af22-d0fff93d6050'::uuid, 'PICO'),
    ('e9d923eb-9740-4278-8109-1083893387c2'::uuid, 'NO_PICO'),
    ('1b4f7fc3-2fcd-41ad-b323-98fd4ad59821'::uuid, 'NO_PICO'),
    ('142174ce-effc-4764-81dc-987b53a09a93'::uuid, 'NO_PICO'),
    ('20c8c90b-feb5-4a94-945e-50c5a9db3113'::uuid, 'NO_PICO'),
    ('10c687ed-b378-4a56-b893-7a1f0a6d6d37'::uuid, 'NO_PICO'),
    ('5b893ee0-455f-4893-ad8c-cd0c177f4283'::uuid, 'PICO'),
    ('0622871a-b8f7-452b-8342-386b8d5ada6b'::uuid, 'NO_PICO'),
    ('f6810888-c24b-41a6-b264-0b300bbe9b20'::uuid, 'PICO'),
    ('57c3cd0a-ab44-4661-8fb3-f1f595e63e7d'::uuid, 'NO_PICO'),
    ('5eb6ae2b-c246-4fd7-9019-0a36b5de1804'::uuid, 'PICO'),
    ('ccb802a3-ca5d-493e-957a-96e1e240f2fa'::uuid, 'NO_PICO'),
    ('12a4832b-0c14-4f9f-b499-cb16b18d6d62'::uuid, 'PICO'),
    ('d443a3d3-b4be-4e6a-bb1c-789487759777'::uuid, 'NO_PICO'),
    ('7d34227d-8257-49de-b577-e1239d5cb047'::uuid, 'NO_PICO'),
    ('1611af99-a3a3-47f5-871a-2962e5063917'::uuid, 'NO_PICO'),
    ('ffa685cd-f730-4d2d-a349-22bedcb0c4e6'::uuid, 'NO_PICO'),
    ('3439f2d0-db23-41e0-8e2f-93f224405514'::uuid, 'NO_PICO'),
    ('c6efc872-e05b-4cdc-87ea-686f4c1b6398'::uuid, 'NO_PICO'),
    ('8eac8c55-5e45-4794-b7d9-b49457dc53b5'::uuid, 'NO_PICO'),
    ('aee55614-70d4-479c-a7fb-5b24be27d57e'::uuid, 'NO_PICO'),
    ('7bc69a4a-b8b7-4cf9-9151-5988017600a4'::uuid, 'NO_PICO'),
    ('cc063df9-1751-49c0-a16d-5e62626ccf9c'::uuid, 'NO_PICO'),
    ('e25fd28a-dd80-403b-8fbc-a59370f05f35'::uuid, 'NO_PICO'),
    ('3f339e18-1889-4dd5-8d03-d48e6ec9ce45'::uuid, 'NO_PICO'),
    ('377d3dcd-9e6d-4e9d-af30-23c4a7b3bfa9'::uuid, 'NO_PICO'),
    ('b5b871a0-a9b0-421a-a630-a4e746abcbc1'::uuid, 'PICO'),
    ('126a277c-32f5-4018-b813-6f730ff65638'::uuid, 'NO_PICO'),
    ('8b881e7c-6f96-4a05-87a7-b0791b641e96'::uuid, 'PICO'),
    ('89fe93ed-8c10-47c9-992b-018ab4930bf0'::uuid, 'NO_PICO'),
    ('9e283221-0922-4e83-b965-d484f99d8694'::uuid, 'PICO'),
    ('1d4e6ce2-92f3-436c-b684-2671b6e3ab98'::uuid, 'NO_PICO'),
    ('b33cd7fb-186c-4160-b274-2d0884708a8f'::uuid, 'PICO'),
    ('0fdcfba5-ddb3-401d-8606-29d5800c44ee'::uuid, 'NO_PICO'),
    ('098c192b-e8d1-4500-96a3-e82a66e960ee'::uuid, 'PICO'),
    ('653c4a2b-7002-4cba-a33e-23eb64a2f8b5'::uuid, 'NO_PICO'),
    ('5796a5ee-7f6f-4399-a5de-6677fb2ac386'::uuid, 'PICO'),
    ('7fefc199-e98a-4fdd-bdd8-b6a473459ae5'::uuid, 'NO_PICO'),
    ('da3608cd-2a11-4350-8e84-7d06d3370368'::uuid, 'NO_PICO'),
    ('e7794737-5a49-47b6-9dc8-d357b9d2a683'::uuid, 'NO_PICO'),
    ('63593a4a-c622-4b3e-8a34-baa7613a1bef'::uuid, 'PICO'),
    ('8e10e942-95d7-4afd-859a-a7091b776b57'::uuid, 'NO_PICO'),
    ('3432e95f-ed1f-48ac-b516-f045a6ae3d63'::uuid, 'PICO'),
    ('42f9ad6e-609d-4d56-a14a-a3fb55acdcb7'::uuid, 'NO_PICO'),
    ('904ae7c1-475e-4c8b-a6f9-25f7afbcf8a9'::uuid, 'PICO'),
    ('86e31925-f94c-49a8-a8eb-ff188fb0622d'::uuid, 'NO_PICO'),
    ('aefeeff2-5a84-4118-ae27-8a300692240b'::uuid, 'NO_PICO'),
    ('9f9b2084-b914-4973-b1e2-33f69bfb7292'::uuid, 'PICO'),
    ('ccd15171-a031-48d6-90dc-741716e1dd4e'::uuid, 'NO_PICO'),
    ('79799ae0-8351-4ede-92d7-751feb5b2cad'::uuid, 'PICO'),
    ('1133630c-f154-4867-9178-3358630ca0f3'::uuid, 'NO_PICO'),
    ('d1d914e1-054c-4745-a18f-5cf76e100ce4'::uuid, 'PICO'),
    ('91cde080-b056-4104-9605-8aac02106a33'::uuid, 'NO_PICO'),
    ('a91ae04d-58e3-43f6-a896-a6c4fca92074'::uuid, 'NO_PICO'),
    ('aa992868-7efb-47aa-9b37-9938048709cd'::uuid, 'PICO'),
    ('08b67bf2-fd82-4114-8b3d-9e322e82f29d'::uuid, 'NO_PICO'),
    ('ec9e3bdc-d9c7-4391-a76d-7a36a09fecdf'::uuid, 'PICO'),
    ('33de65e6-e638-4348-9007-068e1882697e'::uuid, 'NO_PICO'),
    ('1b7f2c11-94bc-47b3-ae82-40801e433627'::uuid, 'PICO'),
    ('47817122-765f-4068-969e-e6b60736823c'::uuid, 'NO_PICO'),
    ('f7c7e6e6-ee48-4c13-b3b2-eb486ad1c395'::uuid, 'PICO'),
    ('a18c4918-34bb-434b-9f74-4d1360a3dbde'::uuid, 'NO_PICO'),
    ('014a59ce-1870-4b3f-adcf-c3213043dcf7'::uuid, 'PICO'),
    ('fa69b97f-5b68-4004-a377-3619dce4a3e1'::uuid, 'NO_PICO'),
    ('1d6c3fa0-15a4-486b-b88c-39891285ab82'::uuid, 'PICO'),
    ('c13b99e1-29ef-40a2-bf09-3df48f2e8502'::uuid, 'NO_PICO'),
    ('a8feafba-fa11-4e9a-b446-f7a86c7cf2fc'::uuid, 'PICO'),
    ('88939960-43eb-4c50-be7c-9b76601ddc4d'::uuid, 'NO_PICO'),
    ('77776e94-1573-491a-8809-3a9fdb6eff93'::uuid, 'PICO'),
    ('79bc8074-57d2-448a-b700-ed06cd6d49ca'::uuid, 'NO_PICO'),
    ('e8148c11-9f71-4239-af6a-0c21042c6491'::uuid, 'NO_PICO'),
    ('a763d534-9182-4568-803b-11ee0ac3b503'::uuid, 'NO_PICO'),
    ('cb9e7fb5-b561-4e46-8d31-b6270468a31d'::uuid, 'PICO'),
    ('5c889f3a-06ae-4470-b9d3-45428d9a3ea1'::uuid, 'NO_PICO'),
    ('4f385fa0-223b-40ca-951f-be20f7906843'::uuid, 'PICO'),
    ('85fd1b37-f7a3-4f07-b8b5-e30a5ba20937'::uuid, 'NO_PICO'),
    ('7040236f-17c8-40db-9d06-bbe743fedae7'::uuid, 'PICO'),
    ('a956bbb2-b3e8-48cb-806f-6cdca2b9caa9'::uuid, 'NO_PICO'),
    ('ba6d91bc-55c8-467e-9749-dfe093576959'::uuid, 'PICO'),
    ('6cb4ced0-2e8a-4a45-a651-34f0323da5e2'::uuid, 'NO_PICO')
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
