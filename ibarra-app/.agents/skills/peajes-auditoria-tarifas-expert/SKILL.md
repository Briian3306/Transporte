---
name: peajes-auditoria-tarifas-expert
description: >-
  Advises on Peajes auditoria-tarifas algorithms (Patrón A/B, diagnóstico vs
  status, peajes_normalizar_tarifas / peajes_recalcular_tarifas) and wizard
  CSV/Excel upload plus Strategy/Builder transforms. Inspects DESARROLLO via
  Supabase MCP (read-only) and implements or tests on Supabase CLI. Use when
  the user asks about auditoría de tarifas, tarifas_normalizadas, CSV upload,
  CATEGORIA mapping, diagnosis algorithms, file_upload_name, or recommendations
  to implement or fix tariff normalization. Never writes to DESARROLLO without
  explicit user authorization.
---

# Peajes Auditoría Tarifas Expert

Project expert for **F14 auditoría tarifaria** and the **CSV/Excel upload pipeline** that feeds it. Primary job: inspect, explain, and recommend. Implement on **Supabase CLI** when asked. Never mutate DESARROLLO without explicit authorization.

Read first: `docs/backend/index.md`, `docs/backend/peajes/auditoria-tarifas.md`, this skill’s [reference.md](reference.md).

## Environment contract (mandatory)

```text
Supabase CLI (local)  =  testing / verification / the only place to edit SQL
DESARROLLO (remote)   =  inspect via MCP (read-only) unless user authorizes writes
```

| Environment | Role | Project ref | API |
|-------------|------|-------------|-----|
| **Supabase CLI** | Migrations, `db reset --local`, pgTAP, algorithm experiments | Docker | `http://127.0.0.1:54321` |
| **DESARROLLO** | Live data for diagnosis / CSV vs DB inspection | `kfffigvyvtzyczeiadxh` | `https://kfffigvyvtzyczeiadxh.supabase.co` |

There is **no** staging/prod split. Forbidden OrdenCompra refs: `edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`.

From `ibarra-app/`, use `npx supabase` (not global `supabase` / `pnpm supabase`).

**Never:** `db reset --linked`, MCP `apply_migration` without authorization, `service_role` in chat/docs, inventing a third environment.

## Mode of work

Default: **advise**. Gather evidence, then recommend. Do not jump to remote writes.

```text
1. Read code + docs/backend (source of truth for intended behavior)
2. Inspect DESARROLLO with MCP SELECT (read-only)
3. Reproduce / fix on Supabase CLI
4. Recommend implementation (migration + tests + docs/backend)
5. DESARROLLO write ONLY if the user explicitly authorizes it
```

Copy and track:

```text
Advisor Progress:
- [ ] 1. Restate the question (algorithm vs CSV vs data vs UI)
- [ ] 2. Confirm environment (CLI vs DESARROLLO)
- [ ] 3. Inspect with MCP (read) and/or CLI
- [ ] 4. Cite invariants (RN-05, two layers, patrón A/B)
- [ ] 5. Recommend: keep / fix / implement — with files and RPCs
- [ ] 6. If implementing: CLI only; tests green; docs/backend
- [ ] 7. DESARROLLO push: wait for explicit authorization
```

## MCP vs CLI

### MCP (DESARROLLO) — information

Server: `plugin-supabase-supabase`. Call `GetMcpTools` before `CallMcpTool`.

| Tool | Allowed without extra auth | Forbidden without explicit auth |
|------|----------------------------|---------------------------------|
| `list_tables`, `list_migrations`, `get_advisors`, `query_logs` | Yes | — |
| `execute_sql` | **SELECT / EXPLAIN / read-only RPC** only | INSERT, UPDATE, DELETE, DDL, `TRUNCATE` |
| `apply_migration`, `deploy_edge_function` | No | Always |

Always pass `project_id: "kfffigvyvtzyczeiadxh"`. If MCP points elsewhere, **stop**.

Do not dump hundreds of rows in chat. Summarize + small samples. Do not commit production dumps.

Inspect queries: [reference.md](reference.md#mcp-inspect-queries).

### CLI (local) — the place to edit

```powershell
cd ibarra-app
npx supabase start
npx supabase migration new nombre_del_cambio
npx supabase db reset --local --no-seed
npx supabase test db
```

Before any `--linked` command:

```powershell
Get-Content supabase\.temp\project-ref
# expected: kfffigvyvtzyczeiadxh
```

SQL writes go through `supabase/migrations/`. Then `backend-documenter` + `backend-tester`. Companion: `backend-supabase-write`.

## Domain — two layers (never mix)

| Layer | Field | Owner | Values |
|-------|-------|-------|--------|
| 1 Algorithm | `diagnostico` | Motor SQL | `MUESTRA_INSUFICIENTE` `TARIFA_UNICA` `CATEGORIA` `POSIBLE_HORARIO` `REVISAR` `CONFIRMADO` |
| 2 Human | `status` | Analyst + catalog | Universals `PENDIENTE` `POSIBLE_HORARIO` **or** `tarifas_status_catalogo.codigo` for that peaje |
| 3 Human (Patrón A) | `categoria_calculated` | Analyst | Optional smallint 0–10; `NULL` = unset. Not provider `categoria`. |

`confirmado_manual` blocks recálculo from overwriting diagnóstico/status.

**Patrón A** = `categoria IS NULL` (no CATEGORIA mapped). Family = estación.  
**Patrón B** = `categoria` text from provider (Paso 5 destination `CATEGORIA`). Family = estación + categoría.  
Detection is **Paso 5**, not file headers alone. `CATEGORIA` is optional (not in `PASADA_COLUMNAS_OBLIGATORIAS`).

`pasadas.categoria` is **raw provider text**. Never join to `patentes.categoria` (RN-15).

Peaje is derived: `pasadas.estacion_id → estaciones.peaje_id` (RN-05). **Never** add `peaje_id` to `pasadas`. `tarifas_normalizadas` **does** store `peaje_id`.

## Algorithms (SQL)

Two RPCs, different depth:

| RPC | When | Diagnosis |
|-----|------|-----------|
| `peajes_normalizar_tarifas(documento_id)` | Post `peajes_confirmar_carga` (Angular, separate TX; NC → `(0,0)`) | Fast match + new levels. New groups: `MUESTRA_INSUFICIENTE` or `REVISAR` only |
| `peajes_recalcular_tarifas(peaje_id)` | Manual “Recalcular” | Full photo of FC `precio > 0`. Full diagnosis tree |

Grouping key: `(peaje_id, estacion_id, categoria, importe)` with `UNIQUE NULLS NOT DISTINCT`.  
Hour of day: `fecha_hora AT TIME ZONE 'UTC'` (not ART). `stddev_pop`. Defaults: muestra **15**, dispersión **4.100** (`tarifas_parametros_peaje`).

Full diagnosis tree: [reference.md](reference.md#diagnosis-tree).

UI helpers (not the SQL motor): `suggestStatusByPrice`, `detectPicoNoPicoPair` in `auditoria-tarifas.helpers.ts`. Cheaper → first catalog code; two prices → NO_PICO / PICO via `tipo_meta`.

MVP does **not** auto-confirm horario (`auto_confirmar_horario = false`). Motor says *probable surcharge*, never the exact window.

## CSV / Excel upload (feeds auditoría)

Wizard Paso 1 → 9. CSV is first-class alongside `.xlsx`.

`PeajesExcelService.parsearArchivo`:

- CSV: **text cells** (do not send through SheetJS — it turns `19.985,09` into `19.98509` and breaks `CONVERTIR_NUMERO_ARS`).
- Strip BOM. Delimiter: `;` `,` tab (header with most splits; default `;`).
- Quoted fields via `splitCsvLine`. Preview = 10 rows. `file_upload_name` = original filename.

Then Strategy/Builder (`peajes-transformaciones-motor`): never execute jsonb. Semantic type → atomic codes (`CONVERTIR_NUMERO_ARS`, `FORMATEAR_FECHA_HORA`, `FILTRAR_COLUMNA`, …). Combined names `NORMALIZAR_PATENTE` / `COMBINAR_FECHA_HORA` expand to steps.

Patrón B requires Paso 5 map to destination `CATEGORIA`. After confirm: `peajes_confirmar_carga` then `peajes_normalizar_tarifas`.

CSV pitfalls and fixtures: [reference.md](reference.md#csv-upload).

## Recommendation format

Lead with the answer, then evidence:

```markdown
## Recommendation
- Action: keep | fix CLI | implement migration | wait for auth to push DESARROLLO
- Why: (algorithm invariant / data / CSV parse)

## Evidence
- MCP / CLI: (counts, sample, not dumps)
- Code: path + RPC / helper

## Proposed change (if any)
- Migration / files
- Tests: `supabase/tests/peajes_f14_test.sql` and/or Angular specs
- Docs: `docs/backend/peajes/auditoria-tarifas.md`

## Risk
- RN-05 / RN-15 / confirmado_manual / NC vs FC
```

Do not invent RPCs, tables, or `peaje_id` on `pasadas`. Consume contracts in `src/app/components/peajes/models/`.

## Ownership

| Do | Don't |
|----|--------|
| Advise; inspect MCP read; edit CLI migrations/tests | Wizard UI owned by agent 02 (`auditoria-tarifas/**`, `wizard/**`) unless asked and files don't collide |
| Angular services under `peajes/**/services/*.service.ts` (agent 01) | Redefine agent-00 models |
| Document via `backend-documenter` under `docs/backend/` | Use `docs/08-sql/` |
| Align SQL catalog with `StrategyRegistry` | Treat DESARROLLO as SQL test env |

Companions: `backend-supabase-write`, `supabase`, `supabase-postgres-best-practices`, `peajes-transformaciones-motor`, `verification-pasadas-files` (read-only file↔pasadas), `backend-tester`.

## Verify

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
npx ng test --include=**/peajes/auditoria-tarifas/**/*.spec.ts --watch=false
npx --yes tsx src/app/components/peajes/auditoria-tarifas/clasificacion.verify.ts
```

## Canonical paths

```text
docs/backend/index.md
docs/backend/peajes/auditoria-tarifas.md
docs/plan/auditoria-pasadas-patrones/
src/app/components/peajes/auditoria-tarifas/
src/app/components/peajes/services/peajes-auditoria-tarifas.service.ts
src/app/components/peajes/wizard/services/peajes-excel.service.ts
src/app/components/peajes/plantillas/motor/
supabase/migrations/202608121406*_peajes_tarifas_*.sql
supabase/tests/peajes_f14_test.sql
```
