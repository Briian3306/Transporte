WITH excel(id, status_excel) AS (
  VALUES
    ('c8c24d56-eab0-4cf4-9b1a-10b3f837c70f'::uuid, 'NO_PICO'),
    ('950af128-7267-421a-82e7-7c870f11d4db'::uuid, 'NO_PICO'),
    ('449ebb7f-502c-4c26-9318-e04c7dcf8a86'::uuid, 'NO_PICO'),
    ('b5e63e54-dcd5-4e4d-8c9c-031b846ce5d2'::uuid, 'NO_PICO'),
    ('b33374d3-6f40-40c3-8667-1aac9b95c3ff'::uuid, 'PICO'),
    ('dbdac32f-a5d9-4989-805d-e3d3b33a7936'::uuid, 'NO_PICO'),
    ('ba51e143-79c3-4e15-878c-cba851b9b060'::uuid, 'NO_PICO'),
    ('9222d9c7-67c6-412a-bd81-4dea7b960578'::uuid, 'PICO'),
    ('b55c0336-bb40-4f97-b573-16dba205514e'::uuid, 'PICO'),
    ('ca9a7135-ea4a-454b-8da2-1c59529afd9f'::uuid, 'NO_PICO'),
    ('1a04ac2f-c48b-45f2-a721-5a9051e0f00b'::uuid, 'PICO'),
    ('58c0f7c0-7e9e-4d05-99d9-0a524dbfa9e8'::uuid, 'NO_PICO'),
    ('9a05a4bf-9caf-47ef-b99c-0c27c1912228'::uuid, 'PICO'),
    ('acbb841c-1c04-4685-9b59-124a9e56bf61'::uuid, 'NO_PICO'),
    ('4991e7b1-f178-4c15-ad90-318a15ed3c0b'::uuid, 'NO_PICO'),
    ('fae75836-cf74-48c2-b64e-71df9079a818'::uuid, 'PICO'),
    ('d110bf71-21bb-44f2-b3d8-ee2a4db27cab'::uuid, 'NO_PICO'),
    ('96f1b288-bc77-498e-aec9-0abc33c4c992'::uuid, 'NO_PICO'),
    ('391973ad-e430-4826-b4b2-ba99c23a7261'::uuid, 'NO_PICO'),
    ('dc61539b-0763-4330-9b0d-4b550d2e25c1'::uuid, 'PICO'),
    ('ff68b5ea-893f-4cc8-afc0-67e8523120e2'::uuid, 'NO_PICO'),
    ('e9eab52d-faba-42f2-8ed8-00ce044015a6'::uuid, 'PICO'),
    ('755a3283-73bf-41c4-992e-df00200f4289'::uuid, 'NO_PICO'),
    ('5da41cef-ef1f-4ef9-b803-a1502a4b0d3c'::uuid, 'PICO'),
    ('4b3211ec-426f-4278-bdbd-76545c58ab18'::uuid, 'NO_PICO'),
    ('c9ab89bc-b317-4ec7-b3f4-50c1cc0b5067'::uuid, 'NO_PICO'),
    ('23db80e8-384d-48e0-b19a-b6fdab2029ba'::uuid, 'NO_PICO'),
    ('bcbf9e42-c1b2-4084-8883-d43366f147cb'::uuid, 'NO_PICO'),
    ('76275bf6-76f9-48bd-b118-164e3a45228a'::uuid, 'NO_PICO'),
    ('4d3b092c-22ed-472c-8274-a359aa94255e'::uuid, 'PICO'),
    ('cb8b27ad-ca2d-43f6-be78-267811697cfc'::uuid, 'NO_PICO'),
    ('ef6ac5e8-aa58-4ba1-b3da-b6e581106d96'::uuid, 'PICO'),
    ('4256a5c4-550d-430b-9770-410ddd7772b9'::uuid, 'NO_PICO'),
    ('df622a35-f1de-4b38-84aa-f677a2a64453'::uuid, 'NO_PICO'),
    ('ff338df6-6dcf-439d-a24f-8043482c263d'::uuid, 'PICO'),
    ('a67e6eeb-2220-4ed9-b388-bc85d213f659'::uuid, 'NO_PICO'),
    ('8b7ce215-56e3-43ea-9079-4e8435067efc'::uuid, 'NO_PICO'),
    ('3373977a-b58c-46c2-859d-5f8c41ebd2b1'::uuid, 'PICO'),
    ('9a3822e1-e7da-4757-8fd7-f588f0565452'::uuid, 'NO_PICO'),
    ('b782f56c-3045-4520-a51f-e98d5dbaf656'::uuid, 'NO_PICO'),
    ('ba20b1c1-654a-43e3-8356-89f5c320263b'::uuid, 'PICO'),
    ('c1dd84b0-2af6-46e4-b148-8f7e3872d5ed'::uuid, 'PICO'),
    ('a54a11e4-317b-4817-ad3d-9468c80651bb'::uuid, 'PICO'),
    ('31df9e16-4705-4f24-89b8-7d144310cda1'::uuid, 'PICO'),
    ('197b167b-9e9f-44e3-bd71-59a549434caf'::uuid, 'NO_PICO'),
    ('964be612-796b-42dd-91e1-4b785e3c401e'::uuid, 'NO_PICO'),
    ('5e34cfcf-d66e-427a-b7cf-15cb195498b1'::uuid, 'PICO'),
    ('8201f973-73d1-4107-a82f-6f0d88740fed'::uuid, 'NO_PICO'),
    ('9cb808b7-3581-4b99-b0a2-7a497f1dedd7'::uuid, 'NO_PICO'),
    ('dfdb0977-cda5-463b-b1f7-bec070fb9f62'::uuid, 'PICO'),
    ('4e51eeeb-1bc3-45bd-8e1f-51b6e3567e57'::uuid, 'PICO'),
    ('d23f5ee4-bca8-4e83-be49-b70bec8293b2'::uuid, 'PICO'),
    ('56dea2e9-0d97-43a1-8cb4-271c64f2d816'::uuid, 'PICO'),
    ('88448c65-6527-4548-9f50-052805dbcfbe'::uuid, 'PICO'),
    ('b0c1a91a-ec92-47dd-80da-24a9d4a7feec'::uuid, 'NO_PICO'),
    ('96cc91d0-7cca-42c7-b055-5a38503e9025'::uuid, 'PICO'),
    ('02ede6b1-c988-4370-b8be-28a988bef18e'::uuid, 'NO_PICO'),
    ('9d4f5800-f875-4dca-b453-dab0be29d2ca'::uuid, 'NO_PICO'),
    ('61236db9-7626-4917-9561-0c5a6126fc42'::uuid, 'PICO'),
    ('6905d677-cfdb-4a9b-8954-9306a6aed9bf'::uuid, 'PICO'),
    ('8e388c96-4f3d-4746-8847-6307b17a1920'::uuid, 'NO_PICO'),
    ('814abc10-4d2d-417e-84cc-5ed5029c98d0'::uuid, 'NO_PICO'),
    ('88444766-197b-464d-a733-977fa4e2beb8'::uuid, 'NO_PICO'),
    ('472f323e-1c4a-4fd7-af0a-7bed9b804fb2'::uuid, 'PICO'),
    ('29376fa0-d2b3-4d10-acfe-027b57592e4a'::uuid, 'NO_PICO'),
    ('a7bb571a-92fc-4a30-b82f-5810c134c1d1'::uuid, 'PICO'),
    ('a83d8f83-df4e-457a-b54e-13b75ffaeaea'::uuid, 'NO_PICO'),
    ('c379fe80-aee3-46b3-ae90-61a59f7f04dd'::uuid, 'PICO'),
    ('4cd927a3-79c6-4a2a-8b73-825edae73d2b'::uuid, 'NO_PICO'),
    ('a4c2445d-f9b5-4db9-b438-3705cde574d1'::uuid, 'PICO'),
    ('9068379d-73a6-4643-a5ec-59d2609820ca'::uuid, 'NO_PICO'),
    ('68bd654c-126f-4ff6-b354-5346782321fc'::uuid, 'NO_PICO'),
    ('5208e1ab-9988-411d-a4e0-537d6148ce4e'::uuid, 'PICO'),
    ('221e5f4f-e7b8-4e65-84d6-18e570255e79'::uuid, 'NO_PICO'),
    ('7f587078-ff09-4f05-8d23-6aeff887dc65'::uuid, 'NO_PICO'),
    ('275d9de6-e493-4a08-9f00-94b15f5cc51f'::uuid, 'NO_PICO'),
    ('efb71810-aeef-4876-b013-1535869dda1a'::uuid, 'NO_PICO'),
    ('fe917d4b-ff97-4cf2-a957-aa6f66e4665d'::uuid, 'PICO'),
    ('06d1fb27-414d-492d-a37c-814f51148bd2'::uuid, 'NO_PICO'),
    ('29624fdf-983b-4ccc-8933-f5b1c4883a15'::uuid, 'PICO')
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
