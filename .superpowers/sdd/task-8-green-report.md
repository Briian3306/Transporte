# Task 8 GREEN — parallel `pwbi_tarifas_v2` view

**Status:** DONE (waiting review)  
**Owner:** Backend write  
**Date:** 2026-09-08  
**Commits:** none (forbidden)

## What you implemented

Parallel Power BI reader **`public.pwbi_tarifas_v2`** (VIEW, not a rewrite of `pwbi_tarifas`).

Join: `tarifas` LEFT JOIN `tarifa_importe` on `ti.id = tarifas.current_tarifa_id` **and** `ti.tarifa_id = tarifas.id`. Not `MAX(fecha_aparicion)`. `Importe` comes from the current history row.

Quoted PascalCase columns:

| Column | Source |
|---|---|
| `Tarifa_ID` | `tarifas.id` |
| `Peaje_ID` | `tarifas.peaje_id` |
| `Estacion_ID` | `tarifas.estacion_id` |
| `Categoria` | `tarifas.categoria` (smallint) |
| `Sentido` | `tarifas.sentido` |
| `Status` | `tarifas.status` |
| `Importe` | current `tarifa_importe.importe` |
| `Current_Tarifa_ID` | `tarifas.current_tarifa_id` |

Grants: `SELECT` to `anon`, `authenticated`, `service_role`. `security_invoker = false` (same Power BI pattern as `pwbi_tarifas`). `NOTIFY pgrst, 'reload schema'`.

Did **not** rewrite `pwbi_tarifas`.  
Did **not** DROP `tarifas_normalizadas`, legacy FKs, triggers, or RPC signatures.  
Did **not** change `peajes_normalizar_tarifas`, `peajes_recalcular_tarifas`, `peajes_confirmar_status_tarifa`.  
Did **not** edit test files, ETL, Angular, product docs, `feature_list.json`, or `claude-progress.md`.  
Did **not** write DESARROLLO. No `/ 1.21`. No data load. No Task 9 docs.

Migration filename from the plan: `20260907103000_peajes_tarifas_v2_compat_cutover.sql`. Timestamp did not collide (applies after Task 6 `…102000`, before Task 7 `20260908100000`).

## Verify GREEN

Local CLI only. No DESARROLLO, no `db reset --linked`, no MCP `apply_migration`.

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

**Date:** 2026-09-08  
**Reset:** exit 0. Applied `20260907103000_peajes_tarifas_v2_compat_cutover.sql`.  
**pgTAP:** PASS. Exit 0. Files=14, Tests=412. Wstat 0.

Both Task 8 files `ok`:

- `peajes_f14_tarifas_importe_test.sql` — `plan(176)` including tests 166–176 (legacy RPCs + `pwbi_tarifas` + v2 columns / grants / current importe 9999).
- `peajes_pwbi_views_test.sql` — `plan(45)` including tests 42–45 (`pwbi_tarifas_v2` + `Tarifa_ID` / `Importe` / `Sentido`).

## Files changed

1. `ibarra-app/supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql` — new VIEW
2. `.superpowers/sdd/task-8-green-report.md` — this report
3. `.superpowers/sdd/progress.md` — Task 8 GREEN done, waiting review

Did **not** edit `supabase/tests/**`.  
Did **not** commit.  
Did **not** write DESARROLLO.
