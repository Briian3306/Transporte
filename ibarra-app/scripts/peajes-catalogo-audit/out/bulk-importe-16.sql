INSERT INTO public.tarifa_importe (
  id, tarifa_id, importe, importe_base, desvio,
  hora_min, hora_max, hora_media, cases, fecha_aparicion,
  tarifas_normalizadas_id, created_at
)
SELECT
  x.id,
  x.tarifa_id,
  x.importe,
  x.importe_base,
  x.desvio,
  x.hora_min,
  x.hora_max,
  x.hora_media,
  COALESCE(x.cases, 0),
  x.fecha::timestamptz,
  tn.id,
  x.fecha::timestamptz
FROM jsonb_to_recordset('[{"id":"260fbc65-d64a-48a5-a822-550ee72e6e91","tarifa_id":"9b51f61f-4bfd-4021-84c4-a2d349f82d1f","importe":28740.39,"importe_base":28740.39,"desvio":null,"hora_min":null,"hora_max":null,"hora_media":null,"fecha":"2026-07-14 00:29:33+00","tn":null},{"id":"f1a83f74-7ee9-43a5-b2af-05a91cc117cc","tarifa_id":"ea0c52ae-410f-462e-805a-25697cf96735","importe":31500,"importe_base":31500,"desvio":null,"hora_min":null,"hora_max":null,"hora_media":null,"fecha":"2026-07-15 09:46:50+00","tn":null}]'::jsonb)
  AS x(
    id uuid, tarifa_id uuid, importe numeric, importe_base numeric,
    desvio numeric, hora_min numeric, hora_max numeric, hora_media numeric, cases integer,
    fecha text, tn uuid
  )
LEFT JOIN public.tarifas_normalizadas tn ON tn.id = x.tn
ON CONFLICT (id) DO NOTHING;
