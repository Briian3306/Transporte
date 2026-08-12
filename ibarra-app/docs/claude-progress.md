# Progreso de agentes — Módulo Peajes

## Fuente de verdad

- PRD principal: `docs/plan/peaje-prd-short.md.md`
- Ejemplo operativo: `docs/plan/ejemplo-mvp-procesamiento-pasadas.md`
- Estado de features: `feature_list.json`
- Guía de agentes: `AGENTS.md`
- Handoff: `docs/session-handoff.md`

## Estado actual

Fecha: 2026-08-12 — **F14-3 + F14-5**: wizard detecta `CATEGORIA` (aliases `CATEGORIA`/`CATEG`/`CLASE`/`TIPO VEHICULO`/`CATEGORIA VEHICULO`); `rec-categoria` sin pipeline; MVP/AU incluyen y mapean `CATEGORIA` (Patrón B en fixtures); Paso 5 marca opcionales; payload `categoria` trim ya en carga (F14-2). Docs: reconocimiento-columnas/estaciones, `auditoria-tarifas.md`, `tarifas-normalizadas.md`, wizard/módulo/INDEX. Verify: `tsc` EXIT 0; `ng test` wizard/**/*.spec.ts + peajes-carga → **96 SUCCESS**. **F14-0..F14-5 → passing**. Abierto: F14-6 dataset DESARROLLO (sin remote, skip); `fecha_desde`/`fecha_hasta` no-ops. **No** `db push`.

Fecha previa: 2026-08-12 — **F14-0 + integración auditoría**: `CATEGORIA` en `PasadaColumnKey` / `PASADA_COLUMN_KEYS` (10 keys; **no** en obligatorias). Inicializador wizard `CATEGORIA: null`. Specs `PasadaEstandarizada` ajustados. Verify: `npx tsc --noEmit -p tsconfig.app.json` EXIT 0; `ng test` auditoria-tarifas **14/14**; peajes-carga+paso8+paso9 **9/9**. `contracts.local.ts` re-export canónico OK; provider Supabase sigue activo. **F14-0/F14-4 → passing**. Abierto: F14-3 (aliases/MVP exclusión); F14-6 dataset DESARROLLO (sin remote, skip); `fecha_desde`/`fecha_hasta` no-ops en listar agregado. **No** `db push`.

Fecha previa: 2026-08-12 — **F14-1 / F14-2 backend passing (CLI)**: tablas `tarifas_*` + ALTER `pasadas` (sin `peaje_id`); 6 RPC; enganche post-carga opción (b) en `PeajesCargaSupabaseService`; `PeajesAuditoriaTarifasSupabaseService` + provider real en `/peajes/auditoria-tarifas`. Verify: `npx supabase db reset --local --no-seed` OK; `npx supabase test db` → **144 PASS** (`peajes_f14_test` + regresiones). Docs: `docs/backend/peajes/auditoria-tarifas.md`. **No** `db push --linked`. Bloqueos: F14-0 (`CATEGORIA` en `PasadaColumnKey`) pendiente agente 00; dataset 1711/119 → F14-6; drift `20260811190002_filtrar_columna` viaja en el próximo push remoto.

Fecha previa: 2026-08-12 — **F14-4 frontend** pantalla `/peajes/auditoria-tarifas` (commit `706beee`); provider ahora Supabase (F14-2).

Fecha previa: 2026-08-11 — **FILTRAR_COLUMNA**: estrategia atómica de filtro de filas (`ESTACION=1` ≡ `0001`); motor `aplicarPipeline` descarta no coincidentes; catálogo SQL `20260811190002_peajes_algoritmo_filtrar_columna.sql`; ejemplo `docs/plan/ejemplo-mercosur-procesamiento-pasadas.md` + CSV `pasadas_2026-07-01_79157.csv` (164 filas → Σ 4721445.29 = TOTAL factura). Fixture `mercosur.fixture.ts`. Verify: `motor.verify` PASS; `ng test` plantillas **46 SUCCESS**; `supabase test db` **112 PASS**. No push DESARROLLO aún.

Fecha previa: 2026-08-11 — **AUBASA plantilla HHMMSS + ELIMINAR_IVA**: fixture `aubasa.fixture.ts`, tests motor (AG309CO `2026-07-03 11:42:54`), docs `docs/plan/aubasa-plantilla-fecha-hora.md` (DELETE SQL `5364164`/`5364165`). Plantilla DESARROLLO **AUBASA-7-2026**. No borrar batches hasta re-upload.

Fecha previa: 2026-08-11 — **`pwbi_estacion` + Latitud/Longitud**: columnas `Latitud` / `Longitud` desde `estaciones.latitud` / `estaciones.longitud`. Migración `20260811131009_peajes_pwbi_estacion_lat_long.sql` aplicada en DESARROLLO. Refrescar consulta Power BI `pwbi_estacion`.

Fecha previa: 2026-08-11 — **`pwbi_documentos` en DESARROLLO**: vista dimensión documentos (FC|NC + empresa + importes cabecera); `security_invoker=false` + `GRANT SELECT` a `anon`. Migración `20260811121811_peajes_pwbi_documentos.sql`. Relación Power BI: `pwbi_pasadas.Documento_ID` → `pwbi_documentos.Documento_ID`. Docs actualizados (`pwbi-views.md`, `powerbi-supabase.md`).

Fecha previa: 2026-08-11 — **Power BI API-only**: docs `05-configuracion/powerbi-supabase.md` (URL + anon key, Power Query M). DESARROLLO: migración `peajes_pwbi_anon_api_access` aplicada (`security_invoker=false` + `GRANT SELECT` a `anon` en `pwbi_*`). Archivo local `20260811114646_…`. CLI verify pendiente (Docker).

Fecha previa: 2026-08-10 — **Docs: conectar Power BI ↔ Supabase DESARROLLO**: guía `docs/05-configuracion/powerbi-supabase.md` (API URL, host Postgres, anon key vía MCP; Session pooler + vistas `pwbi_*`). Enlaces desde `05-configuracion/INDEX`, `backend/supabase/index`, `pwbi-views.md`. Password DB y `service_role` fuera del doc.

Fecha previa: 2026-08-10 — **DESARROLLO: vistas Power BI `pwbi_*` aplicadas**: `db push --linked` → `20260810194113_peajes_pwbi_views.sql` en `kfffigvyvtzyczeiadxh`. Para alinear historial, archivo local bonificación renombrado `20260810151849_*` → `20260810191639_peajes_documentos_bonificacion.sql` (mismo SQL; version ID remoto). Vistas: `pwbi_estacion`, `pwbi_patentes`, `pwbi_pasadas`. Docs: `docs/backend/peajes/pwbi-views.md`. Verify CLI previo: `supabase test db` → **103 PASS**.

Fecha previa: 2026-08-10 — **DESARROLLO: bonificación cabecera aplicada (PGRST202)**: migración local `20260810151849_peajes_documentos_bonificacion.sql` aplicada en `kfffigvyvtzyczeiadxh` (registro remoto `20260810191639_peajes_documentos_bonificacion`); `NOTIFY pgrst, 'reload schema'`. Causa del fallo Paso 8: app enviaba `p_bonificacion` contra RPC 3-arg antigua. Verify remoto: firma `p_importe_sin_iva, p_importes_neto, p_tolerancia, p_bonificacion`; `documentos.bonificacion` existe; smoke AUSA `peajes_validar_factura_pasadas(1656836.19, [1833574.47], NULL, 176737.7)` → `valido=true`, `diferencia=0.58`, `dentro_tolerancia=true`.

Fecha previa: 2026-08-10 — **AUSOL/AUSA `fecha_hora` −1 día**: evidencia en `docs/plan/ausa-ausol-fecha-hora-minus-one-day.md`. Fix preventivo motor/plantillas; **DESARROLLO data repair aplicado**: `UPDATE pasadas … +1 day` → **185 filas** (`493556`=162, `493557`=23). Spot-check `1851b71d-…` → `2026-07-13 14:13:49` (match CSV).

Fecha previa: 2026-08-10 — **Bonificación de cabecera en documento**: columna `documentos.bonificacion`; Paso 7 input manual; RN-13/17 = `Σ IMPORTE_NETO − bonificacion ≈ subtotal` (±1%); migración `20260810151849_peajes_documentos_bonificacion.sql`; docs backend/validacion + stitch paso_7. Verify: `db reset --local --no-seed` OK; `supabase test db` → **85 PASS**; ng test focalizado → **39 SUCCESS**; `tsc --noEmit` OK.

Fecha previa: 2026-08-10 — **F08-2 passing**: vista `/peajes/pasadas-pendientes` (estaciones PENDING agregadas + expand pasadas + drawer ubicación). RPC `peajes_listar_estaciones_pendientes` (`20260810142350_…`); docs `docs/backend/peajes/estaciones-pendientes.md` + index + functions catalog. Verify: `db reset --local --no-seed` OK; `supabase test db` → **81 PASS**.

Fecha previa: 2026-08-10 — **F04-5 passing**: documentación `docs/backend/` (catálogo RPC + peajes + workflow/testing), sync `documentos-pasadas` / índices, PRD `peaje-prd-short.md.md` alineado F13 (masiva, FC|NC, RN-16 hora). `docs/08-sql/` eliminada (canonical = backend + migrations).

Fecha previa: 2026-08-10 — **Docs: eliminado `docs/08-sql/`** (incl. `peajes/`). Skills `documentacion-proyecto`, `backend-documenter`, `backend-supabase-write` + `AGENTS.md` documentan SQL/RPC solo en `docs/backend/` + fuente `supabase/migrations/`.

Fecha previa: 2026-08-10 — **F13-RN16-FECHA + F13-5 passing**: (1) Excel `Date` → `yyyy-MM-dd HH:mm:ss` vía `normalizarCeldaExcel` (ya no trunca a medianoche; cierra falsos RN-16 en ConsumosResumen). (2) Importación masiva: omitir documentos inválidos en Paso 7 y continuar con válidos; Paso 8/9 respetan `omitido`; Paso 9 resume importados / omitidos+errores. Verify: `ng test` peajes-excel + fecha.util + paso7/8/9 → **29 SUCCESS**. (3) DESARROLLO: migración F13 aplicada (`20260807140000_peajes_documentos_tipo_nc`), cache PostgREST recargada y carga `ConsumosResumen-202607-1.xlsx` preservada con **696 pasadas / 11 documentos**. (4) Hardening: `confirmarCarga` ya no hace SELECTs posteriores al RPC confirmado; evita mostrar fallo tras commit. Verify: spec focalizada **1 SUCCESS** + `tsc --noEmit` OK.

Fecha previa: 2026-08-07 — **Issue abierta F13-RN16-FECHA** (ver registro abajo): al cargar el sample Telepase `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (1040 filas) en importación masiva, Paso 8 / `peajes_detectar_duplicados` reporta cientos de `Duplicado dentro del lote (RN-16)` porque `FECHA_HORA` llega con hora `00:00:00`. El Excel **no** tiene filas duplicadas (`Fecha` trae `MM/DD/YYYY HH:mm:ss`). Decisión owner: **no** agregar paso de transformación para alterar `FECHA_HORA`; queda asentado para regresión/tests.

Fecha previa: 2026-08-07 — **F13-4 / RN-26**: `Concesion`→Peaje→Estaciones por empresa. PRD + `wizard.md`; Paso 5 recomienda peaje; Paso 6 filtra estaciones al peaje (corregible). No listar estaciones ajenas por defecto.

Fecha previa: 2026-08-07 — **F13-3 ConsumosResumen**: aliases Tag Nº→PASE_ID, Estación→ESTACION_ID, Concesion→empresa/peaje; Paso 7 FC fijo + autofill FACTURA + Quitar/Agregar IVA por accordion; Paso 6 masiva permite estaciones cross-empresa. Guía: `docs/06-components/peajes/importacion-masiva-consumos-resumen.md`. Sample: `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx`.

Fecha previa: 2026-08-07 — **F13-2 masiva multi-empresa**: en importación masiva la empresa del Paso 1 es opcional; en Paso 7 cada panel FACTURA permite elegir/cambiar empresa y saltar a mapeo (5) o estaciones (6) según el archivo. Referencia UI stitch: `docs/templates-stich/stitch_json_developer_toolkit/paso_1_cargar_archivo/`. Feature `F13-2` en `feature_list.json`.

Fecha previa: 2026-08-07 — **Documentos + importación masiva (F13)**: migración `facturas`→`documentos` + `tipo` FC|NC + `documento_id`; normalización de signos NC; wizard modo masiva con columna `FACTURA`; shared `app-accordion` (sin PrimeNG, ledger style); Paso 7 accordion multi-documento. Docs: migración `20260807140000_peajes_documentos_tipo_nc.sql` (canonical docs → `docs/backend/`; `docs/08-sql/` eliminada). Verificación: `ng build` OK; unit tests (17) OK; `db reset --local --no-seed` + `supabase test db` → 75 PASS. DESARROLLO aplicado el 2026-08-10.

Fecha previa: 2026-08-06 — **CSV AR + CONVERTIR_NUMERO_ARS**: SheetJS coerceaba `19.985,09` → `19.98509`; `PeajesExcelService` parsea CSV como texto. Tras reload, `CONVERTIR_NUMERO_ARS` produce `19985.09`.

Fecha previa: 2026-08-06 — **CONVERTIR_NUMERO_ARS**: estrategia + catálogo SQL; Paso 2 recomienda ARS si muestra `19.985,09` y `CONVERTIR_NUMERO` si decimal con punto; plantilla DESARROLLO `AUSA-8-2026` (`efec4fd3-…`) paso TARIFA→PRECIO actualizado. Docs plantillas/reconocimiento/AU + migración `20260806120000_peajes_algoritmo_convertir_numero_ars.sql` (docs → `docs/backend/`).

Fecha previa: 2026-08-05 — **Paso 5 BONIFICACION opcional**: si el archivo no trae descuento (Telepase/Autopistas), `asegurarMapeosObligatorios` inyecta mapeo sintético + `ASIGNAR_VALOR=0` (mismo patrón que QUANTITY); `construirPasadasDesdeMapeo` default 0 e `IMPORTE_NETO=PRECIO`; apply repara plantillas sin BONIFICACION.

Fecha previa: 2026-08-05 — **FECHA_HORA ISO / duplicados 22008**: `COMBINAR_COLUMNAS` FECHA+HORA → ISO; Excel Date → `yyyy-MM-dd`; `toPostgresFechaHora` en RPC duplicados/confirmar; AUSOL-7-2026 paso 10 → `FORMATEAR_FECHA_HORA` (`DD/MM/YYYY HH:MM:SS`). Corrige `2026-13-07` por DateStyle MDY.

Fecha previa: 2026-08-05 — **QUANTITY mapping / AUSOL-7-2026**: Paso 5 exige mapeo QUANTITY (fila sintética + `ASIGNAR_VALOR=1`); apply repara plantillas legacy sin QUANTITY; DESARROLLO plantilla `AUSOL-7-2026` (`7c42ac64-…`) actualizada con config orden 100 + mapeo `QUANTITY→QUANTITY`.

Fecha previa: 2026-08-05 — **F11 tolerancia ±1% + Search Select Paso 1**: `peajes_validar_factura_pasadas` usa `abs(subtotal)*0.01` por defecto; `app-search-select` en Empresa/Plantilla.

Fecha previa: 2026-08-04 — **F09 early skip from Paso 1**: con archivo+empresa+plantilla, `PeajesPlantillaApplyService` aplica y salta a Factura (o 5/6). Paso 4 reutiliza el mismo servicio.

Fecha previa: 2026-08-04 — **F09 plantilla restore**: `validarDefinicionPlantilla` acepta `mapeos` (cubre `ESTACION_ID` sin paso de pipeline; caso AUSOL-V2-08-2026). Paso 4 restaura mapeos/estaciones, salta a Factura o `irAExcepcion` 5|6. Saves Paso 3/builder no pisan snapshot incompleto. PRD §4/§7.4 + wizard/estaciones docs.

Fecha previa: 2026-08-04 — **Shared `app-dialog`**: Paso 6 «Ninguna coincide» / crear estación en modal; Paso 1 crear empresa migrado al mismo dialog.

Fecha previa: 2026-08-04 — **Bloqueo CLI post `db reset`:** `GET …/auth/v1/user` **403** → no se pueden crear patentes en Paso 5 (`pnpm dev`). Mitigación: `seed:local` + re-login (ver sesión abajo). Paso 7 factura UX ya entregado.

Fecha previa: 2026-08-04 — **Paso 7 factura UX**: `cuenta` opcional (migración + RPC); empresa SMS single locked Paso 1; fecha DRP `mode=single`.

Fecha previa: 2026-08-04 — **DataTable column filters**: `filterableColumnsInputs` + `searchableInputMain` + `clientFilter`; catálogos usan filtros por columna (labels claros). Docs shared actualizadas.

Fecha previa: 2026-08-04 — **F02-15 / F02-16 passing**: Paso 6 respeta exclusión de VIA; Paso 5 Agregar/Quitar todas. Shared DataTable / F08-1 siguen en curso.

Fecha previa: 2026-08-04 — **Bugs/features documentados (sin code fix):** F02-15 (Paso 6 ESTACION+VIA ignora exclusión de VIA) `not_started`; F02-16 (Agregar todas patentes unresolved) `not_started`. Shared DataTable / F08-1 siguen en curso.

Fecha previa: 2026-08-04 — **Shared DataTable library**: docs `docs/06-components/shared/`; `DateRangePicker` + `SearchMultiSelect`; pasadas-filters refactor; catálogos listados migrados a `app-data-table` + SMS. F08-1 sigue `in_progress`.

Fecha previa: 2026-08-04 — **F02-12 / F02-13 / F02-14 passing**: default-include columnas reconocidas; Paso 6 estaciones por empresa; Paso 5 patentes sin resolver (DataTable). En paralelo: **F08-1 in_progress**.

Fecha previa: 2026-08-04 — **F02-12 / F02-13 / F02-14 in_progress**: default-include columnas reconocidas; Paso 6 estaciones por empresa; Paso 5 patentes sin resolver (DataTable).

Fecha previa: 2026-08-03 — **F02-11 passing**: reconocimiento automático de columnas + recomendaciones Paso 2. En paralelo: **F08-1 in_progress** (gestión de pasadas).

Fecha previa: 2026-08-03 — **F02-11 in_progress**: reconocimiento automático de columnas + recomendaciones en Paso 2 (semántica → pipeline drafts). En paralelo: **F08-1 in_progress** (gestión de pasadas).

Fecha previa: 2026-08-03 — **F08-1 in_progress**: gestión de pasadas (audit cols + vista `pasadas_gestion` + RPCs list/CRUD + UI `/peajes/pasadas` + shared `DataTable`). Sin tablas nuevas.

Fecha previa: 2026-07-31 — **F02-10** y **F03-9** `passing` (pipeline editable Paso 3 + motor descriptors/deps). Baseline F00–F05 sigue `passing`.

Fecha previa: 2026-07-30 — **Fase 3 Agente 05 Integrador/QA completada**. Módulo Peajes integrado en `feature/peajes-mvp`.

### Rama Git (contrato)

- Trabajo Peajes solo en **`feature/peajes-mvp`**.
- **No** commits ni push a `main`/`master`/`principal`.
- **No** merge a `main` sin autorización explícita del usuario.
- Push de la feature branch: solo si el usuario lo pide (por defecto no).

### Entornos Supabase (contrato)

| Entorno | Rol |
|---------|-----|
| **Supabase CLI** (local) | Testing / verificación obligatoria |
| **DESARROLLO** (`kfffigvyvtzyczeiadxh`) | Remoto de desarrollo |

No hay staging/prod separados. No reutilizar refs OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`).

**2026-07-31 — CLI local login/admin:** `pnpm start` → DESARROLLO; `pnpm dev` → CLI (`environment.local.ts`). Dump Auth + seed RBAC documentados en [docs/05-configuracion/cli-local-credenciales-y-permisos.md](./05-configuracion/cli-local-credenciales-y-permisos.md).

Decisiones vigentes:

1. Dashboard `id: 'peajes'`, ruta `/peajes`, permiso `peajes:read`.
2. Carpetas: `src/app/components/peajes/{models,wizard,catalogos,plantillas}`.
3. UI kit: CSS/SCSS + Font Awesome (patrón host).
4. Plantillas Peajes ≠ Checklists.
5. Pasada referencia `estacion_id`; peaje derivado.
6. Coordinación canónica solo en `ibarra-app/`.
7. Recurso global plantillas/algoritmos: `empresa_id === '__global__'`.
8. Providers UI = servicios Supabase reales (F05); mocks solo en unit tests.
9. Catálogo SQL de algoritmos alineado a `StrategyRegistry` (F05).
10. Reconocimiento de columnas (F02-11) por **semántica/aliases**, no por concesionaria; ESTACION → Paso 6.
## Features

F00–F05 `passing`. **F02-10** + **F03-9** `passing` (2026-07-31). **F02-11** `passing` (2026-08-03). **F02-12/13/14** `passing` (2026-08-04). **F02-15** + **F02-16** `passing` (2026-08-04).

## Registro de sesiones

### 2026-08-11 — AUBASA FECHA_HORA plantilla + tests

**Agente:** motor / plantillas  
**Scope:** fixture `aubasa.fixture.ts`, `FORMATEAR_FECHA_HORA` HHMMSS + `ELIMINAR_IVA`, motor specs AG309CO, docs `aubasa-plantilla-fecha-hora.md`, plantilla DESARROLLO `AUBASA-7-2026` (`2dd50d7a-356e-42f4-979b-a383cff54a59`)  
**Verify:** `ng test …/motor.spec.ts` → **56 SUCCESS** (28×2 browsers)  
**Pendiente usuario:** DELETE batches `5364164`/`5364165` + re-upload con plantilla nueva

### 2026-08-10 — AUSOL/AUSA fecha_hora −1 día (evidencia + fix)

**Agente:** integrador / motor
**Scope:** revisión `verification-pasadas-files` + fix preventivo algoritmo/plantilla
**Docs:** `docs/plan/ausa-ausol-fecha-hora-minus-one-day.md` (evidencia, SQL preview/apply +1 day, plantillas)
**Código:** `peajes-fecha.util.ts`, `estrategias-atomicas.ts`, fixtures AUSOL/Acceso Oeste, specs
**DESARROLLO plantillas:** `AUSOL-7-2026`, `AUSA-8-2026`, `AUSA-V2` → `FORMATEAR_FECHA_HORA` + `YYYY-MM-DD HH:MM:SS`  
**DESARROLLO data repair:** `UPDATE pasadas SET fecha_hora = fecha_hora + interval '1 day'` → **185** filas (`493556`+`493557`); spot-check `1851b71d-…` = `2026-07-13 14:13:49`

### 2026-08-10 — F04-5 Documentación backend + PRD sync

**Agente:** 04-documentador

- Creado `docs/backend/` (functions catalog, peajes RPC detail, supabase workflow/testing, edge stub).
- Sync tablas: `documentos-pasadas.md`; `auditoria-y-rpcs.md` → pointer a backend; eliminado `facturas-pasadas.md`.
- Actualizado `peaje-prd-short.md.md` (Paso 1/7/8/9 masiva+documentos, §11–14 DOCUMENTOS, RF-19–22, RN-12/13/16/17).
- Índices: `docs/INDEX.md`, `modulos/peajes.md`, `06-components/peajes/INDEX.md`, `06-tablas/*`.
- `feature_list.json`: F04-5 `passing`; `documentation_*` → 2026-08-10.
- Confirmado: sin `docs/08-sql/`.

### 2026-08-10 — Fix F13-RN16-FECHA + F13-5 omitir documentos inválidos (masiva)

**Agente:** 02-frontend-wizard-tablas

#### F13-RN16-FECHA

- **Causa:** `PeajesExcelService.normalizarCelda` convertía todo `Date` a `yyyy-MM-dd` (fix MDY 2026-08-05). ConsumosResumen mapea `Fecha`→`FECHA_HORA` sin transform; `toPostgresFechaHora` paddea `00:00:00` → falsos RN-16.
- **Fix:** `formatLocalDateTime` + `normalizarCeldaExcel` exportados en `peajes-fecha.util.ts`; Excel Date → `yyyy-MM-dd HH:mm:ss`. Sin paso de transformación.
- **Tests:** ZARATE 07/24 cuatro horas distintas; `ng test` peajes-excel + fecha.util OK.

#### F13-5 omitir documentos

- `WizardDocumentoGrupo.omitido` + `documentosIncluidos` / `documentosOmitidos` / `pasadasDeDocumentosIncluidos`.
- Paso 7: «Omitir documento» + «Omitir documentos con error y continuar».
- `puedeAvanzarA` / Paso 8 / Paso 9 ignoran omitidos; resumen final importados / omitidos+errores / confirm failures.
- **Verify:** `ng test` include peajes-excel, fecha.util, paso7, paso8, paso9 → **29 SUCCESS**.

### 2026-08-07 — Issue RN-16 / FECHA_HORA con ConsumosResumen.xlsx (rastreo)

**ID:** `F13-RN16-FECHA`  
**Sample:** `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (hoja `RESULTADO_1`, **1040** filas).  
**Síntoma:** Paso 8 → RPC `peajes_detectar_duplicados` (RN-16 / PRD).  
**Origen archivo:** Telepase (`scripts/telepeaje plus/`); el scraper no está en duda.

#### Motivo (causa raíz)

Clave de negocio RN-16:

```text
PASE_ID + FECHA_HORA + ESTACION_ID + PATENTE_ID
```

En la respuesta del wizard, `FECHA_HORA` aparece truncada a medianoche. Varias pasadas legítimas del mismo tag/dominio/estación el **mismo día** (distinta hora / vía) colapsan a la misma clave.

Ejemplo de valor en la respuesta:

```text
5e2f1508-d268-44f8-b142-98d6550b9bf9|2026-07-24 00:00:00+00|e5cce2bb-fb8e-4712-bd38-9419a2abbfd9|475d37b6-3b41-42ca-867d-510951b08475
motivo: Duplicado dentro del lote (RN-16)
columna: CLAVE_DUPLICADO
```

En el Excel, `Fecha` **sí trae hora** (`07/24/2026 13:37:24`, etc.).

#### Análisis del sample (resultados reales, 2026-08-07)

Inspección Node + `xlsx` sobre el archivo:

| Check sobre el XLSX | Resultado |
|---|---|
| Filas totales | **1040** |
| Filas 100% idénticas | **0** |
| Duplicados Tag Nº + **Fecha completa** + Estación + Dominio | **0** |
| Duplicados Tag Nº + **solo día** + Estación + Dominio | **165** filas “extra” / **138** grupos n>1 |
| Duplicados Tag + Fecha completa + Estación + Dominio + Vía | **0** |

Columnas: `Tag Nº`, `Dominio`, `Concesion`, `FACTURA`, `Estación`, `Vía`, `Fecha`, importes.

**Ejemplo real (filas Excel 2–5) — no son duplicados en origen:**

| Fila | Tag Nº | Dominio | Estación | Fecha (origen) | Vía |
|---|---|---|---|---|---|
| 2 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **13:37:24** | VIA 09 |
| 3 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **14:08:28** | VIA 52 |
| 4 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **23:26:45** | VIA 09 |
| 5 | 99779063 | AG533MF | ZARATE - RUTA 9 KM. 95 | 07/24/2026 **23:54:02** | VIA 53 |

Tras perder la hora → `…|2026-07-24 00:00:00+00|…` → RN-16 marca duplicados (alineado con filas 3–5 de la respuesta del wizard).

**Grupos más grandes (clave día-only):**

| Grupo | n |
|---|---:|
| `99779063\|07/22/2026\|ZARATE…\|AG533MF` | 6 |
| `99738712\|07/14/2026\|ZARATE…\|AG309CH` | 5 |
| `99779063\|07/24/2026\|ZARATE…\|AG533MF` | 4 |

#### Respuesta observada del wizard

Entrada asociada: `{ "registros": 1040 }`.  
Salida: errores `motivo: "Duplicado dentro del lote (RN-16)"`, `columna: "CLAVE_DUPLICADO"`, `valor` siempre con `00:00:00+00` (cientos de filas; patrón ZARATE / mismos tags del sample).

#### Decisión (2026-08-07)

- **No** se aplicó un paso de transformación en el wizard para alterar/reconstruir `FECHA_HORA` (decisión explícita del owner; se dejó igual).
- El sample en `scripts/telepeaje plus/202607-2/` queda como **fixture de evidencia / regresión**.
- Fix futuro: lectura/mapeo correcto de `Fecha` → `FECHA_HORA` (preservar `HH:mm:ss`), no un “parche” de transformación acordado fuera de alcance.

#### Cierre (2026-08-10)

- Fix aplicado en lectura Excel: `normalizarCeldaExcel` → `yyyy-MM-dd HH:mm:ss` (sin transform Paso 3). Feature `F13-RN16-FECHA` → `passing`.

#### Tests de regresión esperados (mismos resultados; que no vuelva a pasar)

Contra `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` (o copia en fixtures si se mueve):

1. **Integridad del sample:**
   - `rows.length === 1040`
   - 0 filas JSON-idénticas
   - 0 colisiones Tag+FechaCompleta+Estación+Dominio
   - Baseline bug date-only: exactamente **165** colisiones Tag+día+Estación+Dominio
2. **Wizard / motor (cuando se corrija):**
   - Tras mapear `Fecha` → `FECHA_HORA`, ninguna pasada con hora origen ≠ medianoche debe quedar en `00:00:00`
   - Paso 8 / `peajes_detectar_duplicados` sobre las 1040: **0** errores RN-16 por pérdida de hora (el sample no tiene dups con fecha completa)
3. **Caso ZARATE 07/24/2026 Tag 99779063:** las 4 horas `13:37:24`, `14:08:28`, `23:26:45`, `23:54:02` → **4 claves RN-16 distintas**

Criterio de cierre: (2) y (3) en verde sin paso de transformación parche no acordado.

### 2026-08-05 — FECHA_HORA ISO (duplicados 22008)

- **Bug:** `peajes_detectar_duplicados` → `date/time field value out of range: "2026-13-07 …"` (Postgres DateStyle MDY ante `13/07/2026` concatenado por `COMBINAR_COLUMNAS`).
- **Fix:** Excel Date → `yyyy-MM-dd`; COMBINAR FECHA+HORA → `FORMATEAR_FECHA_HORA` ISO; `toPostgresFechaHora` en carga RPC; AUSOL-7-2026 orden 10 → `FORMATEAR_FECHA_HORA` / `DD/MM/YYYY HH:MM:SS`.
- **UI factura:** Paso 7 sigue mostrando `dd/MM/yyyy` en el date picker; persistencia interna `yyyy-MM-dd`.
- **Verify:** `ng test` peajes-fecha.util + motor → **28 SUCCESS**.

### 2026-08-05 — QUANTITY mapping + AUSOL-7-2026 DESARROLLO

- **Bug:** aplicar `AUSOL-7-2026` fallaba con `QUANTITY: Columna obligatoria no mapeada`.
- **Código:** `asegurarQuantityMapeoYPipeline` en wizard state; Paso 5 exige QUANTITY (etiqueta «valor generado»); `PeajesPlantillaApplyService` inyecta `ASIGNAR_VALOR { valor: 1 }` + mapeo si falta.
- **DESARROLLO:** plantilla `7c42ac64-e7b3-4c9d-9085-039f576d0e02` — config orden 100 `ASIGNAR_VALOR` valor=1; mapeos `QUANTITY→QUANTITY`.
- **Verify:** `ng test` apply+wizard-state+paso5 → **17 SUCCESS**.

### 2026-08-05 — F11 tolerancia 1% + Search Select Paso 1

- **Tolerancia:** migración `20260805113339_peajes_tolerancia_factura_uno_por_ciento.sql` — default `abs(subtotal)*0.01`; `p_tolerancia` explícito sigue como override. Paso 7/8/mock y docs (`validacion-carga`, wizard, auditoria, SQL task) alineados. F11-1 verification actualizada.
- **Search Select:** `app-search-select` (CVA `string | null`) en `shared/search-select`; Paso 1 Empresa + Plantilla; stitch mock + docs `docs/06-components/shared/search-select.md`.
- **Verify:** `npx supabase db reset --local --no-seed` OK; `npx supabase test db` **70 PASS**; `npx tsc --noEmit` OK; `ng test` search-select+paso1 **9 SUCCESS**. DESARROLLO no tocado.

### 2026-08-04 — F09 fix: restore mapeos (AUSOL ESTACION_ID)

- Causa: `validarDefinicionPlantilla` solo miraba `configuraciones`; AUSOL guarda `ESTACION→ESTACION_ID` en `mapeos`.
- Fix: motor acepta `mapeos`; Paso 4 los pasa, restaura snapshot, `facturaDirecta` o `irAExcepcion` 5|6; saves no pisan mapeos incompletos.
- Docs: PRD §4/§7.4, wizard.md, reconocimiento-estaciones.md. Specs en `motor.spec.ts` + `paso4-plantilla.component.spec.ts`.

### 2026-08-04 — Documentación de validación diagnóstica

- Se agregó `docs/06-components/peajes/validacion-carga.md` como referencia canónica de controles, errores, acciones correctivas y detalles técnicos del Paso 8.
- Documenta la resolución de códigos de proveedor a UUID, la tolerancia de subtotal de $5,00 y el uso del neto declarado cuando los descuentos no se desglosan por fila.
- Se enlazó desde el índice de componentes, la guía del wizard y el módulo Peajes.

### 2026-08-04 — F09 Plantillas recurrentes y reconocimiento de estaciones

- Se agregó la migración `20260804145440_peajes_plantillas_reconocimiento_estaciones.sql`: snapshot de mapeos en plantilla, tabla `plantilla_estaciones_reconocidas` y RPC transaccional de guardado.
- Paso 4 restaura mapeos y reconocimientos de la plantilla, valida catálogo de estaciones/patentes y solo salta a Paso 7 cuando no hay excepciones. Paso 7 recomienda crear una plantilla una sola vez y guarda pipeline, mapeos y relaciones confirmadas.
- Prioridad documentada: plantilla → alias de empresa → reconocimiento habitual. Los aliases por empresa no se eliminan.
- Verificación: `npx tsc --noEmit -p tsconfig.app.json` OK. Build Angular bloqueado por permisos de lectura del sandbox; reset Supabase local agotó tiempo del host. F09 queda `in_progress` hasta completar SQL y E2E local.

### 2026-08-04 — Shared Dialog + Paso 6 alta estación

- **Hecho:** `app-dialog` en `shared/dialog` (eyebrow/title/body/actions, Esc/backdrop).
- Paso 6: «Ninguna coincide» / Nueva / Crear abren el modal (se quitó el bloque inline al pie).
- Paso 1: crear empresa usa el mismo dialog.
- Docs: `docs/06-components/shared/dialog.md` + INDEX / reconocimiento-estaciones / wizard.

### 2026-08-04 — Bloqueo: Auth 403 CLI + Agregar patente Paso 5

- **Síntoma (app `pnpm dev` / CLI `127.0.0.1:54321`):**
  - Consola: `GET http://127.0.0.1:54321/auth/v1/user` → **403 Forbidden**
  - Stack: `SupabaseService.getCurrentUser` → `GranularPermissionService.loadUserProfile` (también en `visibilitychange` / reinit cliente)
  - Efecto: en wizard **Paso 5** (`paso5-mapeo`) no se pueden **Agregar** / **Agregar todas** patentes unresolved (INSERT a `patentes` vía catálogo falla o no autentica).
- **Causa probable:** verificación Paso 7 corrió `npx supabase db reset --local --no-seed` → Auth local y seeds RBAC se borraron; el browser conserva sesión/JWT vieja inválida para el CLI recreado.
- **No es bug de F02-14/F02-16** (UI/bulk); es entorno CLI post-reset.
- **Mitigación (usuario / agente):**
  1. `cd ibarra-app` → `npm run seed:local` (o flujo en [cli-local-credenciales-y-permisos.md](./05-configuracion/cli-local-credenciales-y-permisos.md) § Tras un `db reset`)
  2. Cerrar sesión en la app / borrar storage del origen `localhost` / hard refresh
  3. Login de nuevo con usuario seed local
  4. Reintentar Paso 5 Agregar patente
- **Status:** documentado; fix de entorno, no de código del wizard.

### 2026-08-04 — Paso 7 factura (cuenta opcional + SMS/DRP)

- **Cuenta opcional:** migración `20260804141122_peajes_facturas_cuenta_nullable.sql`; RPC `peajes_confirmar_carga` NULLIF vacío; frontend sin `Validators.required` en cuenta.
- **Empresa:** `app-search-multi-select` `mode=single` disabled/clearable=false (empresa Paso 1).
- **Fecha:** `app-date-range-picker` `mode=single`.
- **Docs:** shared date-range/SMS, facturas-pasadas, wizard; cuenta opcional vía migración `20260804141122_peajes_facturas_cuenta_nullable.sql` (docs → `docs/backend/`).
- **Verify:** ng test paso7+SMS+DRP **8 SUCCESS**; build OK; `supabase test db` **55 PASS** (CLI).

### 2026-08-04 — F02-15 / F02-16 (fix VIA + bulk patentes)

- **Objetivo:** (1) Paso 6 no combine ESTACION+VIA si VIA está excluida en Paso 2; (2) toolbar Agregar todas / Quitar todas sobre patentes unresolved.
- **Hecho:**
  - F02-15: `viaIncluidaEnSeleccion` en paso6; `valorEstacionProveedorDesdeFila` en state (reemplaza hardcode `387882.csv`)
  - F02-16: `agregarTodasPatentes` / `quitarTodasPatentes` (filtro rápido, errores parciales)
  - Docs: `reconocimiento-estaciones.md`, `patentes-sin-resolver.md`
- **Verify:** `ng test` paso5+paso6+wizard-state → **17 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-15 / F02-16 `passing`

### 2026-08-04 — Reportes F02-15 / F02-16 (solo documentación)

- **F02-15 (bug, sin fix):** con `557074.csv`, Paso 2 deja `ESTACION` incluida y `VIA` excluida, pero Paso 6 arma código proveedor `CAMPANA - 0003`. Causa probable: `valorEstacionProveedor` concatena ESTACION+VIA sin respetar `columnasExcluidas`. Contexto en `docs/06-components/peajes/reconocimiento-estaciones.md`.
- **F02-16 (feature, sin impl):** botón encima de la tabla de patentes unresolved para **Agregar todas** (optimizar workflow). Spec en `docs/06-components/peajes/patentes-sin-resolver.md`.
- **feature_list.json:** entradas F02-15 / F02-16 `not_started` + evidence de reporte.

### 2026-08-04 — F02-12/13/14 Wizard UX (columnas, estaciones, patentes)

- **Objetivo:** (1) Paso 2 incluir solo columnas reconocidas; (2) Paso 6 filtrar estaciones por empresa + reconocimiento + alta mínima; (3) Paso 5 resolver patentes faltantes vía DataTable Agregar/Quitar.
- **Hecho:**
  - F02-12: `aplicarSeleccionPorReconocimiento` en `setPreview`
  - F02-14: `patentesExcluidas` + DataTable unresolved (Agregar/Quitar + filtro rápido)
  - F02-13: estaciones filtradas por peajes de empresa; auto exacta; slim create (sin peaje inline); reco crear
  - Docs: `reconocimiento-estaciones.md`, `patentes-sin-resolver.md`, INDEX/wizard/testing_plan
- **Verify:** `ng test` wizard-state+paso2+paso5+paso6+recognition → **24 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-12/13/14 `passing`

### 2026-08-03 — F02-11 Reconocimiento automático de columnas (Paso 2)

- **Objetivo:** asistente de importación semántico — detectar columnas comunes (PATENTE/DOMINIO, TARIFA, BONIFICACION, FECHA+HORA, ESTACION, DISPOSITIVO) y recomendar transformaciones reutilizables con un clic en Paso 2.
- **Decisión:** reconocimiento por **semántica de columna**, no por concesionaria. ESTACION prepara Paso 6 (reconocedor de catálogo); no se inventa Strategy `RESOLVER_ESTACION`.
- **Hecho:**
  - `column-recognition.ts` (aliases + recetas) + `PeajesColumnRecognitionService`
  - State: `recomendaciones`, `aceptarRecomendacion` / `descartar` / `aceptarTodas`; `seedDemoPipelineIfEmpty` comparte recetas
  - Paso 2 rail «Asistente de importación» (Aplicar / Descartar / Aplicar todas)
  - Docs: `reconocimiento-columnas.md` + INDEX / wizard / plantillas / testing_plan §10a
- **Verify:** `ng test` column-recognition + paso2 + wizard-state → **19 SUCCESS**; `ng build --configuration=development` OK
- **Status:** F02-11 `passing`

### 2026-08-03 — Empresas catalog + algoritmo UX PATENTE + docs

- **Catálogos:** card Empresas (`CATALOGOS_CARDS`), ruta `/peajes/catalogos/empresas`, peajes con dropdown empresa + crear (patrón Paso 1).
- **Algoritmos UI:** preview filas mock (estilo Paso 3), pasos guiados, botón Ejemplo PATENTE, empresa select, Guardar + plantilla `PATENTE_ID`.
- **Supabase CLI:** reparada/aplicada F06 (`20260803170620_…`); verificado `NORMALIZAR_PATENTE` (BORRAR → GUIONES → MAYÚSCULAS) y configs `→ PATENTE_ID` para Acceso Oeste y Demo. Fix SQL `UPDATE estaciones` FROM/WHERE.
- **Docs:** `guia-crear-plantillas.md`, actualización `plantillas-y-algoritmos.md` / `catalogos.md` / INDEX / F06 README.
- **Verify:** `ng build --configuration=development` OK; specs catalogos+algoritmos **6 SUCCESS**. Remoto MCP `uurlssweuhshbwpxxatw` no es DESARROLLO Peajes (sin tablas peajes) — testing solo CLI.

### 2026-07-31 — Pipeline editable Paso 3 (F02-10 / F03-9) — multiagente

- **Wave 0:** feature stubs + API contract en `session-handoff.md`.
- **Wave 1 (Grok parallel):** 03 motor (`AlgorithmDescriptor`, skip-disabled, `validarDependenciasPipeline`, `previsualizarPaso`); 02 draft state + AU fixture; 04 docs outline.
- **Wave 2 (Grok parallel):** 02 Paso3 CDK DnD editor + save/load plantilla + Paso4 `filasOrigen`; QA I-P* + `testing_plan.md` §10b; Demo **102060** / AU **132940.19**.
- **Wave 3:** Paso1 spec providers fixed; docs finalizados; features marcadas `passing`.
- **Verify:** `motor.verify.ts` PASS; `e2e-prd21.verify.ts` PASS; `npm run build` OK; `@angular/cdk@19.2.0`.
- **Docs:** `docs/06-components/peajes/pipeline-editable-paso3.md` (ya no outline).

### 2026-07-31 — Wave 0/1 outline docs — Agente 04

- Outline inicial `pipeline-editable-paso3.md` + enlaces INDEX / módulo (luego finalizado en Wave 3).

### 2026-07-30 — Rediseño wizard Peajes ↔ mockup + ejemplo MVP

- **Objetivo:** alinear UI/UX del wizard al mockup `module-automation-tool-mockup.html` y cablear el caso de `ejemplo-mvp-procesamiento-pasadas.md`.
- **Hecho:**
  - Shell + tokens CSS del mockup (stepper, content-card, status, tablas, footer).
  - Pasos 1–9 rediseñados (upload 2 columnas, chips de columnas, transform cards + preview I/O, mapeo con panel detalle, estaciones relation-layout, factura/validación cards, revisión con métricas + tabla).
  - Fixture `wizard/fixtures/mvp-ejemplo.fixture.ts` + botón **Cargar ejemplo MVP** (10 filas, selección/mapeo/factura sugeridos, total 102060).
  - Heurísticas MVP en `construirPasadasDesdeMapeo` (FECHA+HORA, patente, pase, importe neto).
  - Filtros de listado en catálogos peajes/estaciones (inputs tipo incidente-details).
- **Verificación:** `npm run build` OK.
- **Queda:** colapsar 9→7 pasos como el mockup (PRD mantiene plantilla/validación separados); editor modal de filtros del mockup; parse directo de `docs/plan/csv/1947768.xlsx` vía assets (hoy: fixture TS + upload .xlsx manual); polish plantillas F03.

### 2026-07-30 — DESARROLLO: sync historial + db push Peajes

- **Causa drift:** remoto `kfffigvyvtzyczeiadxh` tenía 6 versiones aplicadas (maquinas/sectores/stock/user_profile_roles) ausentes en `supabase/migrations/` local → `db push --linked` bloqueaba con “Remote migration versions not found”.
- **Estrategia A falló:** no había SQL hermano con esos timestamps (solo existían en `schema_migrations` remoto).
- **Acción segura:** `pnpm supabase migration fetch --linked` → recuperó los 6 SQL con los mismos version IDs. **No** se usó `migration repair --status reverted`.
- **Push:** `pnpm supabase db push --linked --yes` aplicó las 7 migraciones Peajes (`20260730125513`…`20260730150000`). Warning post-apply de cache pg-delta (timeout) — no falló el apply.
- **Verificación MCP** (`list_migrations` + `execute_sql`): 13 migraciones en remoto; `system_modules.name='peajes'` activo; roles `admin` y `administrador` tienen `peajes:read` (+ create/manage y resto de acciones del módulo); tablas peajes/estaciones/pasadas/plantillas/algoritmos presentes.
- **Next usuario:** cerrar sesión en la app / hard refresh y volver a entrar para refrescar caché de permisos JWT/UI.

### 2026-07-30 — Fix Admin acceso denegado Peajes

- **Causa raíz:** `PermissionGuard` exige `peajes:read`; F01 omitía `system_modules` peajes en CLI vacío y el alta **nunca se aplicó** a DESARROLLO → Admin tiene rol pero no `peajes:read` → `/access-denied` con “Tu rol actual: Admin”.
- **Fix:** migración repair `20260730150000_peajes_system_module_admin_permissions.sql` (idempotente; asigna peajes read/create/manage a roles `admin`/`administrador` case-insensitive; no-op si host RBAC ausente).
- CLI: `migration up --local` OK (NOTICE omit en CLI vacío). Frontend/guards ya alineados (`peajes` + `read`).
- **DESARROLLO:** aplicado vía `db push --linked` (sesión sync historial). Re-login app obligatorio.

### 2026-07-30 — Fase 3 Agente 05 Integrador/QA

- Merge rutas: wizard + catalogos + plantillas en `peajes.routes.ts`.
- Swap mocks → `PeajesCatalogo/Carga/PlantillasSupabaseService`.
- `peajes-home` con links reales; `ROUTE_PERMISSIONS` hijos peajes.
- Alineación catálogo SQL ↔ StrategyRegistry (migración `20260730140000_…`).
- E2E: `e2e-prd21.verify.ts` PASS (§21 + 10 filas + total 102060).
- Verificación: build OK; ng test peajes 27 SUCCESS; supabase reset + test db 30/30.
- Pendiente autorizado: `db push --linked` a DESARROLLO + `system_modules` peajes; merge a `main`.

### 2026-07-30 — Fase 2 Agente 04 Documentador

- Docs canónicas alineadas a implementación F01/F02/F03.
- Gap códigos SQL ↔ TS documentado → **resuelto por 05**.

### 2026-07-30 — Fase 1 Agente 01 Backend Supabase

- Migraciones, RPC, servicios Supabase; CLI 30/30.

### 2026-07-30 — Fase 1 Agente 03 Plantillas & Motor

- Motor Builder + Strategy; UI plantillas.

### 2026-07-30 — Fase 1 Agente 02 Wizard & Tablas

- Wizard pasos 1–9 + catálogos.

### 2026-07-30 — Fase 0 Orquestador/Setup

- Rama `feature/peajes-mvp`; contratos, rutas home, skills, handoff.

## Bloqueos y riesgos

- Schema Peajes **no** está en DESARROLLO remoto: `db push --linked` autorizado pero **bloqueado por ACL**.
- `init.sh` no ejecutable en este host Windows sin bash/WSL (evidencia F05-3).
- ~~**F13-RN16-FECHA**~~ cerrado 2026-08-10: `normalizarCeldaExcel` preserva HMS.

### 2026-07-30 — Intento `db push --linked` DESARROLLO (BLOCKED)

- Rama: `feature/peajes-mvp`; migraciones peajes presentes (incl. `20260730150000_peajes_system_module_admin_permissions.sql`).
- Link local OK: `supabase/.temp/project-ref` = `kfffigvyvtzyczeiadxh` (proyecto “Check-list”).
- App apunta a DESARROLLO (`environment.ts`).
- **No** se usaron refs OrdenCompra.
- `npx supabase db push --linked` → **403** `LegacyDbConfigLoginRoleStatusError` (cuenta CLI sin privilegios sobre el proyecto).
- CLI/MCP listan solo proyectos OrdenCompra de otras orgs; no aparece DESARROLLO en la cuenta activa.
- Verificación SQL/MCP de `system_modules` peajes: **no posible** sin acceso.
- **Acción requerida del usuario:** login CLI (`npx supabase login`) con cuenta miembro de la org del proyecto Check-list / DESARROLLO, o invitar la cuenta actual con rol Developer+; luego reintentar `npx supabase db push --linked` desde `ibarra-app`. Tras éxito: re-login app + `/peajes`.

## Próximo paso

1. Desbloquear ACL Supabase DESARROLLO y reintentar `db push --linked`.
2. Merge a `main` solo con OK explícito del usuario.

### 2026-08-03 — F07 AUSOL: seed y reconocedor de estaciones (en curso)

- Alcance autorizado: seed idempotente desde `docs/plan/seed/ESTACIONES.xlsx`, campos geográficos de estaciones, aliases por empresa, reconocimiento confirmable y plantilla/pipeline para `docs/plan/csv/557074.csv`.
- Contrato agregado: `EstacionAliasProveedor` y `ResultadoReconocimientoEstacion`; el Paso 6 resolverá coincidencias exactas automáticamente y exigirá confirmación para sugerencias parciales antes de habilitar una estación nueva.
- El motor incorporará `REEMPLAZAR_TEXTO` como estrategia registrada, con reglas ordenadas y sin ejecución dinámica.
- Estado: `F07-1` permanece `in_progress`; no hay evidencia de migración, pruebas Angular ni Supabase CLI todavía.

### 2026-08-03 — F08-1 fix vista `pasadas_con_peaje` (CLI)

- Causa: `CREATE OR REPLACE VIEW` con `p.*` tras `ALTER` de `user_id`/`file_upload_name` → 42P16.
- Fix en migración pendiente `20260803190348`: `DROP VIEW IF EXISTS` + `CREATE VIEW` (contrato intacto).
- `npx supabase migration up --local` → aplicada OK.
- `npx supabase test db`: `peajes_f01_test.sql` ok; fallos en AUSOL/F06 (conteos seed preexistentes: REVIEW 18 vs 14, aliases F06) **no atribuibles a F08**.
- DESARROLLO no tocado.

### 2026-08-04 — Sincronización documental

- Se revisaron `feature_list.json`, `src/app/components` y la documentación existente.
- Se documentaron los módulos host y se actualizó el índice.
- Peajes queda documentado como MVP integrado: F00–F05 passing; F06-1/2/3, F07-1 y F08-1 en progreso; F06-5 no iniciado.
- Se eliminó `docs/08-sql`; las migraciones y RPC se referencian desde `supabase/migrations` y servicios.
- Riesgos: evidencia E2E Acceso Oeste/AUSOL, discrepancias de seeds/conteos, cierre de gestión de pasadas e `init.sh` en Windows.

### 2026-08-04 — F10-1 IVA opcional y operaciones numéricas

- Paso 2 ya no propone la receta `ESTACION + VIA`; las columnas siguen disponibles para el Paso 6.
- Se agregaron `ELIMINAR_IVA` (divide `IMPORTE_NETO` por 1,21 y redondea a dos decimales) y `OPERAR_NUMERO` (sumar, restar, multiplicar o dividir por valor fijo) al registro, descriptores, editor y catálogo SQL.
- `ELIMINAR_IVA` se recomienda de forma opcional cuando se detectan tarifa y bonificación; al persistirse en el pipeline de una plantilla se reaplica solo para esa empresa.
- Verificación: `npx tsc --noEmit -p tsconfig.app.json` y `git diff --check` OK. El bundle de specs focalizados compiló, pero ChromeHeadless no inició por error local de caché/cifrado, por lo que F10-1 sigue `in_progress`.

### 2026-08-12 — F14-0 Contrato CATEGORIA + integración F14-4

- `PasadaColumnKey` / `PASADA_COLUMN_KEYS` incluyen `'CATEGORIA'` (10 keys); **no** en `PASADA_COLUMNAS_OBLIGATORIAS` (Patrón A intacto).
- `construirPasadasDesdeMapeo` inicializa `CATEGORIA: null`; specs de `PasadaEstandarizada` actualizados.
- Provider auditoría ya era Supabase (F14-2); `contracts.local.ts` re-exporta canónico.
- Verify: `tsc` EXIT 0; `ng test` auditoria-tarifas 14/14; peajes-carga+paso8+paso9 9/9.
- Status: F14-0 + F14-4 `passing`. Pendiente: F14-3 (aliases/MVP); F14-6 dataset DESARROLLO (skip sin remote).

### 2026-08-12 — F14-4 Auditoría de tarifas (frontend, agente 02)

- Pantalla `/peajes/auditoria-tarifas` implementada bajo `auditoria-tarifas/`: filtros con debounce, tabla padre/detalle, escalera tarifaria (barra multiplicador + riel 24h), botones de status por catálogo, diálogo de comparación, progreso por peaje, Recalcular.
- Ruta registrada en `peajes.routes.ts`, permiso en `permission.guard.ts`, tarjeta en `peajes-home`.
- Servicio: mock tipado para specs; runtime usa `PeajesAuditoriaTarifasSupabaseService` (F14-2). `contracts.local.ts` re-exporta `models/auditoria-tarifas.contracts.ts`.
- Verificación: `tsc` OK, `ng test` auditoría 14/14, `clasificacion.verify.ts` OK, `npm run build` OK.


- La migración posterior `20260804175001_peajes_facturas_iva_total_manual.sql` agrega `facturas.iva` y elimina la restricción de total derivado: subtotal, percepciones, IVA y total son valores ingresados de factura. RAE se ignora.
- Paso 7 conserva la suma por centavos de las pasadas y compara únicamente subtotal contra pasadas, con tolerancia de $5,00. Se cubrió la factura AUSOL `0840-0557074` del `2026-08-01`: subtotal 560832.27, percepciones 24676.62, IVA 117774.78, total 703283.67.
- `npx supabase migration up --local` OK; `peajes_f01_test.sql` OK (46 pruebas, incluidas F11). La suite global mantiene un fallo preexistente de AUSOL: REVIEW 19 vs 18. `npx tsc --noEmit -p tsconfig.app.json` y `git diff --check` OK. La suite Angular focalizada generó el bundle, pero ChromeHeadless no termina en el host.
