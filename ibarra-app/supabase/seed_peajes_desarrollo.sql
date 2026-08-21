-- Catálogos DESARROLLO (MCP kfffigvyvtzyczeiadxh, 2026-08-21).
-- Conteos origen: empresas 24, peajes 22, estaciones 182, aliases 376,
-- patentes 145, pases 93, documentos 73, pasadas 8326, tarifas_normalizadas 425.
-- `npx supabase db dump --linked` devolvió 403 (privilegios de login role).
-- Este archivo siembra empresas+peajes canónicos. Estaciones/pasadas/tarifas
-- completas siguen en F14 sintético hasta un dump autorizado.
-- Nunca usar `db reset --linked`. pgTAP: `--no-seed`.

SET search_path = public, extensions, pg_catalog;

INSERT INTO public.empresas (id, nombre, descripcion, tarifa_url, created_at) VALUES
  ('873da060-6be4-4786-b248-5f216ae730b4', ' (DESACTIVAR)', 'Proveedor del archivo 387882.csv.', NULL, '2026-08-05T17:33:08.061347+00:00'),
  ('75d868b4-aef5-409a-8d12-973506656811', 'AUBASA', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('710f497d-7fa6-4259-b8dc-16fb1b3b1468', 'AUSA', 'Empresa creada desde ESTACIONES.xlsx.', 'https://www.ausa.com.ar/telepase/tarifas', '2026-08-05T17:33:10.816699+00:00'),
  ('e1f63baf-c084-4d4d-801d-245665ff531b', 'AUTOPISTA DEL OESTE (ACCESO OESTE)', 'Empresa creada desde ESTACIONES.xlsx.', 'https://www.auoeste.com.ar/tarifas', '2026-08-05T17:33:10.816699+00:00'),
  ('d897928d-8a0c-42d6-b3e9-fffb66b9006c', 'AUTOPISTA ROSARIO - SANTAFE', 'Empresa creada desde ESTACIONES.xlsx.', 'https://autopista.santafe.gov.ar/cuadro.php', '2026-08-05T17:33:10.816699+00:00'),
  ('4951e389-42d4-477b-a442-83196cf67790', 'AUTOPISTAS DEL SOL', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('96b3c4e5-a48e-47d2-a674-0556fcfe67c6', 'AUTOVIA BS. AS. A LOS ANDES', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('37ab9246-a07a-40b5-b62d-7a8b8e7782db', 'AUTOVIA DEL MERCOSUR', 'MES 8', 'https://aumesa.com.ar/tarifas/', '2026-08-05T18:29:17.218056+00:00'),
  ('75ab2b90-6586-4252-8ef0-94cb17bece8b', 'CAMINOS DE LAS SIERRAS', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('e32f9453-9201-43a5-946c-d24ab203e378', 'CAMINOS DEL PARANA', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('6531b963-f215-4208-a400-0c42b3ca8ab1', 'CAMINOS DEL RIO URUGUAY SA', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('69e9f5f8-868a-4114-aa83-f9c665553ee7', 'CEAMCE', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('21e89d12-c54e-4c4b-996c-d52ff0738254', 'CONEXION ALTO DELTA S.A.', 'Creada desde Concesión del Excel.', NULL, '2026-08-07T18:34:15.287026+00:00'),
  ('6509b0f4-9e33-4d4a-aaf7-6d1d4ecd8bb4', 'CORREDOR DE INTEGRACION PAMPEANA', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('21ef1796-be65-4338-b185-b0bb62b8e74f', 'CORREDOR VIAL 4', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('787cbd2e-3058-403a-b224-b5e19f13d68f', 'CORREDOR VIAL 5 S.A.U.', 'Creada desde Concesión del Excel.', NULL, '2026-08-07T18:34:20.337359+00:00'),
  ('3744bd1a-a659-41de-8b64-90f9cf74ee1f', 'CORREDORES VIALES SA', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('c66ebf66-ab12-4402-84a6-bff172d937fb', 'COVINT CONCESIONARIO VIAL', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('4a31e96b-3d1b-44c4-9dfe-8eced2c52665', 'ENTE DE CONTROL DE RUTAS', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('cff8f00d-8d8d-45af-9bfa-378666f32b89', 'ENTE INTERMUNICIPAL Y COMUNAL', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00'),
  ('5320a767-8ec3-4bc8-a6e6-38fdfa1cd7ac', 'PROVEEDOR DEMO', 'Proveedor del archivo 1947768.xlsx.', NULL, '2026-08-05T17:33:08.061347+00:00'),
  ('89fefcb0-e14d-4b54-a0be-0945f1a00798', 'RUTAS SUR ATLANTICO S.A.', 'Creada desde Concesión del Excel.', 'https://www.corresur.com.ar/tarifas.php', '2026-08-07T18:34:23.551308+00:00'),
  ('8b5414f2-3a0a-45ee-abb2-69cac0e2920f', 'TELEPEAJE-PLUS', 'conjunto de compañias', NULL, '2026-08-10T12:18:16.972957+00:00'),
  ('fef37dd0-564c-47d4-afc4-5155799e96a5', 'TUNEL SUBFLUVIAL', 'Empresa creada desde ESTACIONES.xlsx.', NULL, '2026-08-05T17:33:10.816699+00:00')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.peajes (id, nombre, ubicacion, descripcion, empresa_id, created_at) VALUES
  ('ab449656-bebf-4cb2-bbb3-6221403e1c7b', 'AUBASA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '75d868b4-aef5-409a-8d12-973506656811', '2026-08-05T17:33:10.816699+00:00'),
  ('fcf50348-fe3d-48db-934f-13e0af1e0e74', 'AUSA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '710f497d-7fa6-4259-b8dc-16fb1b3b1468', '2026-08-05T17:33:10.816699+00:00'),
  ('dc7dad0c-adda-4a56-a1f4-2ec87c19c356', 'AUSOL', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '4951e389-42d4-477b-a442-83196cf67790', '2026-08-05T17:33:10.816699+00:00'),
  ('4c3fcfe9-84f5-4b57-8875-25145b949a93', 'AUTOPISTA DEL OESTE', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'e1f63baf-c084-4d4d-801d-245665ff531b', '2026-08-05T17:33:10.816699+00:00'),
  ('9290904e-0cef-4b5b-abd6-bb15825b272d', 'AUTOVIA BS. AS. A LOS ANDES', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '96b3c4e5-a48e-47d2-a674-0556fcfe67c6', '2026-08-05T17:33:10.816699+00:00'),
  ('cc292b0a-f901-4db7-b099-52144e36a1a9', 'Autovía del Mercosur', 'Zárate', 'Corredor Autovía del Mercosur (Telepase / MERCOSUR)', '37ab9246-a07a-40b5-b62d-7a8b8e7782db', '2026-08-13T18:27:17.674719+00:00'),
  ('2421e557-441c-494e-960c-15819c629318', 'CAMINOS DE LAS SIERRAS', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '75ab2b90-6586-4252-8ef0-94cb17bece8b', '2026-08-05T17:33:10.816699+00:00'),
  ('44c9867d-c0a8-4abc-a922-de21a345eadd', 'CAMINOS DEL PARANA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'e32f9453-9201-43a5-946c-d24ab203e378', '2026-08-05T17:33:10.816699+00:00'),
  ('6ab935ac-c2aa-4b1e-b134-4d25392b7978', 'CAMINOS DEL RIO URUGUAY SA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '6531b963-f215-4208-a400-0c42b3ca8ab1', '2026-08-05T17:33:10.816699+00:00'),
  ('ecbdb035-1ea7-48b2-b3dd-da8fddf42d44', 'CEAMCE', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '69e9f5f8-868a-4114-aa83-f9c665553ee7', '2026-08-05T17:33:10.816699+00:00'),
  ('3eee4c95-e7f4-40f3-b028-b43166229f3b', 'CONEXION ALTO DELTA S.A.', NULL, 'Peaje desde Concesión.', '21e89d12-c54e-4c4b-996c-d52ff0738254', '2026-08-07T18:34:15.601306+00:00'),
  ('c6a94bfe-85a7-4b5c-b78b-e673d5b5e781', 'CORREDOR DE INTEGRACION PAMPEANA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '6509b0f4-9e33-4d4a-aaf7-6d1d4ecd8bb4', '2026-08-05T17:33:10.816699+00:00'),
  ('381fb384-82b0-4cae-870e-575bf649e227', 'CORREDOR VIAL 4', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '21ef1796-be65-4338-b185-b0bb62b8e74f', '2026-08-05T17:33:10.816699+00:00'),
  ('ef0d4301-d970-4bba-a1d0-28f003fbc008', 'CORREDOR VIAL 5 S.A.U.', NULL, 'Peaje desde Concesión.', '787cbd2e-3058-403a-b224-b5e19f13d68f', '2026-08-07T18:34:20.576539+00:00'),
  ('47bae8f4-d946-4b6b-a055-3b8efe639e88', 'Corredores Viales Demo SA', 'Buenos Aires', 'Peaje ficticio del ejemplo MVP.', '5320a767-8ec3-4bc8-a6e6-38fdfa1cd7ac', '2026-08-05T17:33:08.061347+00:00'),
  ('c2ee6a1d-9484-4e6e-ac7e-2830069094a6', 'CORREDORES VIALES SA', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '3744bd1a-a659-41de-8b64-90f9cf74ee1f', '2026-08-05T17:33:10.816699+00:00'),
  ('8aec2cd5-1f1b-40ca-ac6a-9fd31ae2fedb', 'COVINT CONCESIONARIO VIAL', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'c66ebf66-ab12-4402-84a6-bff172d937fb', '2026-08-05T17:33:10.816699+00:00'),
  ('10cd8341-187f-4247-a610-5d0c0fca3783', 'ENTE DE CONTROL DE RUTAS', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', '4a31e96b-3d1b-44c4-9dfe-8eced2c52665', '2026-08-05T17:33:10.816699+00:00'),
  ('ddbec844-7ef9-40d4-94f0-5f0cd47787a6', 'ENTE INTERMUNICIPAL Y COMUNAL', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'cff8f00d-8d8d-45af-9bfa-378666f32b89', '2026-08-05T17:33:10.816699+00:00'),
  ('ebc3d756-788f-4875-9c20-15c9c8d0dffc', 'RUTAS SUR ATLANTICO S.A.', NULL, 'Peaje desde Concesión.', '89fefcb0-e14d-4b54-a0be-0945f1a00798', '2026-08-07T18:34:23.782723+00:00'),
  ('798dd576-3cbb-46b5-ba54-cbe0d0adb493', 'TUNEL SUBFLUVIAL', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'fef37dd0-564c-47d4-afc4-5155799e96a5', '2026-08-05T17:33:10.816699+00:00'),
  ('c4d1ffb5-7363-4291-84be-9da3665f002a', 'UNIDAD EJECUTORA (SANTA FE)', NULL, 'Peaje/corredor creado desde ESTACIONES.xlsx.', 'd897928d-8a0c-42d6-b3e9-fffb66b9006c', '2026-08-05T17:33:10.816699+00:00')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, empresa_id = EXCLUDED.empresa_id, descripcion = EXCLUDED.descripcion;
