# Auditoría tarifas — reference

Read from SKILL.md only when you need the diagnosis tree, MCP queries, CSV details, or file map.

## Diagnosis tree

Used by `peajes_recalcular_tarifas`. Family = `(peaje_id, estacion_id, categoria)` — `categoria` may be NULL (Patrón A).

Defaults if no `tarifas_parametros_peaje` row: `umbral_muestra_minima = 15`, `umbral_dispersion = 4.100`.

Hour metric (UTC wall-clock):

```sql
extract(hour FROM fecha_hora AT TIME ZONE 'UTC')
+ extract(minute FROM fecha_hora AT TIME ZONE 'UTC') / 60.0
```

`desvio` = `stddev_pop` of that hour. Uniform 0–23 h ≈ 6.922. Low desvío ⇒ concentrated in a time band.

```text
cases < umbral_muestra
  → MUESTRA_INSUFICIENTE   status stays PENDIENTE

niveles_familia = 1
  → TARIFA_UNICA           (one price in the family)

categoria IS NULL AND (desvio IS NULL OR desvio >= umbral)
  → CATEGORIA              (Patrón A: spread looks like vehicle class, not time)

desvio IS NOT NULL AND desvio < umbral
  → POSIBLE_HORARIO        status seeded POSIBLE_HORARIO (still human confirm)

else
  → REVISAR
```

`peajes_normalizar_tarifas` does **not** run this full tree. New groups get `MUESTRA_INSUFICIENTE` or `REVISAR` + `PENDIENTE`. Full labels need Recalcular.

`peajes_recalcular_tarifas` also **DELETEs** niveles of that peaje with no remaining FC `precio > 0` pasadas (ghosts after a station move). `confirmado_manual` only protects overwrite of live levels; orphans are removed even if they were `MUESTRA_INSUFICIENTE` or `CONFIRMADO`. FK `pasadas.tarifa_normalizada_id` is `ON DELETE SET NULL`.

NC documents: function returns `(0,0)` — negative amounts are not tariff levels.

`multiplicador` = `importe / importe_base` where `importe_base` = min importe in the family. Fast-path insert uses multiplicador `1.0000` until recálculo.

`peajes_grupos_similares_tarifa`: compares `max/min` ratio; documented limit = 2-level families.

`peajes_marcar_diagnostico_tarifa`: only `CATEGORIA` | `REVISAR`.

Trigger `trg_validar_status_tarifa`: `PENDIENTE` | `POSIBLE_HORARIO` or catalog code for **that** `peaje_id`. Invalid → `23514`.

## RPC catalog (F14)

| Function | Args | Returns |
|----------|------|---------|
| `peajes_normalizar_tarifas` | `uuid` documento | `(pasadas_matcheadas, grupos_nuevos)` |
| `peajes_recalcular_tarifas` | `uuid` peaje | `int` pasadas updated |
| `peajes_confirmar_status_tarifa` | `jsonb` asignaciones | `{niveles_confirmados, pasadas_actualizadas}` |
| `peajes_marcar_diagnostico_tarifa` | `uuid, text` | jsonb row |
| `peajes_listar_tarifas_normalizadas` | filtros jsonb, page, page_size, sort `campo:dir` | `{rows, total, page, page_size}` |
| `peajes_grupos_similares_tarifa` | id, tolerancia numeric | rows with `tarifa_ids[]` |

List filters: `peaje_id`, `peaje_ids[]`, `estacion_ids[]`, `categorias[]` (`__SIN_CATEGORIA__`), `status[]`, `diagnosticos[]`, `patron`, `muestra_confiable` / `solo_muestra_confiable`, `confirmado_manual`, `q_estacion`.

Hook: after `peajes_confirmar_carga`, Angular `PeajesCargaSupabaseService.confirmarCarga` calls `peajes_normalizar_tarifas` in a **separate** transaction — normalization failure must not roll back the load.

Migrations: `20260812140628` … `20260812140653_peajes_tarifas_*` + `20260814190600_peajes_recalcular_prune_orphans`. Tests: `supabase/tests/peajes_f14_test.sql` (B-01..B-16 + prune huérfanos).

## MCP inspect queries

`CallMcpTool` server `plugin-supabase-supabase`, tool `execute_sql`, `project_id` = `kfffigvyvtzyczeiadxh`. SELECT only.

Confirm project first (`list_projects` / user). Wrong ref → stop.

```sql
-- Counts by diagnóstico / status / patrón
SELECT diagnostico, status, patron, count(*)
FROM tarifas_normalizadas
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Queue: unconfirmed, reliable sample
SELECT peaje_id, diagnostico, status, count(*)
FROM tarifas_normalizadas
WHERE confirmado_manual = false
  AND muestra_confiable = true
GROUP BY 1, 2, 3;

-- Pasadas vs niveles for a file
SELECT p.file_upload_name,
       count(*) AS pasadas,
       count(p.tarifa_normalizada_id) AS con_nivel,
       count(*) FILTER (WHERE p.categoria IS NULL) AS patron_a,
       count(*) FILTER (WHERE p.categoria IS NOT NULL) AS patron_b
FROM pasadas p
WHERE p.file_upload_name = '<FILE>'
GROUP BY 1;

-- Family for one estación (UTC hours already stored on the row)
SELECT estacion_id, categoria, importe, cases, multiplicador, desvio,
       hora_min, hora_max, diagnostico, status, confirmado_manual
FROM tarifas_normalizadas
WHERE estacion_id = '<UUID>'
ORDER BY importe;
```

`list_tables` verbose on `tarifas_normalizadas`, `tarifas_parametros_peaje`, `tarifas_status_catalogo`. `list_migrations` to see if F14 is applied on DESARROLLO.

Do not paste 100+ row dumps. Report aggregates + a few example ids.

## CSV upload

Parser: `src/app/components/peajes/wizard/services/peajes-excel.service.ts`.

| Rule | Why |
|------|-----|
| Keep CSV as text | SheetJS numeric coerce breaks `CONVERTIR_NUMERO_ARS` (`19.985,09`) |
| Default delimiter `;` | Telepase / AR exports; also `,` and tab if header splits more |
| Strip UTF-8 BOM | Otherwise first header is `\uFEFFcolumna` |
| Preview 10 rows | Wizard Paso 2; `filasOrigen` keeps all |
| `file_upload_name` = filename | Batch filter on `pasadas` |

Wizard: 1 Cargar · 2 Preview (CATEGORIA aliases) · 3 Transform · 4 Plantilla · **5 Map** (`CATEGORIA` optional) · 6 Estaciones · 7 Documento · 8 Validar · 9 Guardar.

Fecha: store/compare UTC wall-clock (`peajes-fecha.util.ts` / `formatUtcDateTime`). Do not use browser-local `Date#getHours()`.

Reference union CSV (latin-1, `;`): `scripts/telepeaje plus/taifa_normalizacion_test/tarifa_test_resumen_union.csv` (119 family rows). Plan notes: that file’s `PATRON = B` is an **estimated** category from multiplier — source ConsumosResumen books have **no** CATEGORIA column, so wizard loads are Patrón **A** unless mapped. Folder `202607-2` ≠ `file_upload_name`; that load is `ConsumosResumen.xlsx`. ZARATE 1500: CSV 114 cases vs DB 89 (known gap).

File revision vs DB (read-only): skill `verification-pasadas-files`.

Fixtures: `docs/plan/csv/` (`557074.csv`, `autopistas_urbanas.csv`, `pasadas_2026-07-01_79157.csv`).

## Strategy codes that matter for tarifas CSV

Atomic (`ALGORITMO_CODIGOS` / `peajes_algoritmos_catalogo`):

| Code | Typical use on Telepase CSV |
|------|-----------------------------|
| `CONVERTIR_NUMERO_ARS` | `19.985,09` importe |
| `CONVERTIR_NUMERO` | Point decimal |
| `FORMATEAR_FECHA_HORA` / `COMBINAR_COLUMNAS` | FECHA + HORA |
| `BORRAR_ESPACIOS` `ELIMINAR_GUIONES` `CONVERTIR_MAYUSCULAS` | Patente combined `NORMALIZAR_PATENTE` |
| `FILTRAR_COLUMNA` | Keep rows (e.g. MERCOSUR estación) |
| `COPIAR_COLUMNA` | CATEGORIA pass-through when Patrón B |

Unknown code → throw (RN-20). Combined algorithm **names** are not registry codes.

## UI suggestion (not SQL)

`suggestStatusByPrice`: sort niveles by importe; skip `MUESTRA_INSUFICIENTE`; assign catalog codes by `orden`; extra levels get last code. ZARATE expected: cheapest `NO_PICO`, rest `PICO` (`clasificacion.verify.ts`).

`detectPicoNoPicoPair`: exactly two distinct prices + catalog `tipo_meta` PICO/NO_PICO.

`categoria_calculated` (F14-9): optional smallint 0–10 on `tarifas_normalizadas` for Patrón A. Human annotation, not provider `categoria`. Confirm payload may omit it; recalc does not wipe it. UI: plaza CAT stamp in the family panel.

## Invariants checklist

- [ ] No `pasadas.peaje_id` (RN-05)
- [ ] No join `pasadas.categoria` ↔ `patentes.categoria` (RN-15)
- [ ] Unique pasadas `(pase_id, fecha_hora, estacion_id, patente_id)` untouched (RN-16)
- [ ] Hours in UTC
- [ ] NC excluded from levels
- [ ] `confirmado_manual` preserved on recálculo
- [ ] Status via trigger, not CHECK
- [ ] `pg_cron` not installed — recálculo is manual

## File map

| Path | Role |
|------|------|
| `docs/backend/peajes/auditoria-tarifas.md` | RPC/tables canonical |
| `docs/06-components/peajes/auditoria-tarifas.md` | Screen |
| `docs/plan/auditoria-pasadas-patrones/` | F14 plan + appendices A–D |
| `peajes-auditoria-tarifas.service.ts` | Angular → RPC |
| `auditoria-tarifas.helpers.ts` | Patrón, Pico/No Pico, suggest |
| `20260812140637_peajes_tarifas_rpc_normalizar.sql` | Motor |
| `20260814204300_peajes_tarifas_categoria_calculated.sql` | `categoria_calculated` + confirmar/listar |
| `peajes_f14_test.sql` | pgTAP |
