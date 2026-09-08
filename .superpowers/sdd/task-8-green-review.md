# Task 8 GREEN review — parallel `pwbi_tarifas_v2`

Reviewer: task-scoped gate against Approved RED (`task-8-review.md`) + `task-8-brief.md` + plan Task 8. Did **not** re-run `npx supabase test db` (report already exit 0 / Files=14 Tests=412; the migration matches tests 171–176 and pwbi 42–45). Reconstruct of the uncommitted GREEN delta is in `review-task-8-green.diff`.

## Spec Compliance

- ✅ Spec compliant

GREEN adds only the parallel VIEW `public.pwbi_tarifas_v2`. Join is `tarifa_importe.id = tarifas.current_tarifa_id` **and** `tarifa_importe.tarifa_id = tarifas.id` (not `MAX(fecha_aparicion)`). Quoted PascalCase columns match RED. `pwbi_tarifas` and legacy RPCs are untouched. No DROP of `tarifas_normalizadas` or other legacy objects. Test files were not edited.

## Spec / file-scope check

GREEN files only:

- `supabase/migrations/20260907103000_peajes_tarifas_v2_compat_cutover.sql` (created)
- `.superpowers/sdd/task-8-green-report.md`
- `.superpowers/sdd/progress.md`

Did **not** edit `peajes_f14_tarifas_importe_test.sql` (header still says `RED: pwbi_tarifas_v2 absent`; `plan(176)` and tests 166–176 match Approved RED). Did **not** edit `peajes_pwbi_views_test.sql` (`plan(45)`; tests 42–45 only; combined `pwbi_*` GRANT `ok()` groups still omit v2). No ETL / Angular / product docs / `feature_list.json` / `claude-progress.md`. Node `splitSentidoCollisions remaps the second sentido onto a new parent id` still skipped (Task 9). No DESARROLLO.

Hard constraints held in the migration:

- `CREATE VIEW public.pwbi_tarifas_v2` — not a table, not `CREATE OR REPLACE` of `pwbi_tarifas`
- `LEFT JOIN tarifa_importe ti ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id`
- Columns: `Tarifa_ID`, `Peaje_ID`, `Estacion_ID`, `Categoria`, `Sentido`, `Status`, `Importe`, `Current_Tarifa_ID`
- `Categoria` from `tarifas.categoria` (smallint), not TN text
- `GRANT SELECT` to `anon`, `authenticated`, `service_role`
- `security_invoker = false` + `NOTIFY pgrst, 'reload schema'` (same pattern as live `pwbi_tarifas` in `20260902185000`)
- Filename matches the plan: `20260907103000_peajes_tarifas_v2_compat_cutover.sql` (after Task 6 `…102000`, before Task 7 `20260908100000`; the view does not need pasadas backfill)

Tests: implementer reported pgTAP PASS exit 0, Files=14 Tests=412, including f14 166–176 and pwbi 42–45. This review did not re-run pgTAP (gate instruction; migration does not contradict the tests).

## Strengths

- Parallel reader is a **VIEW** over `tarifas` + current `tarifa_importe`. `pwbi_tarifas` viewdef is not rewritten; legacy RPCs are not DROPped or re-signed.
- Pointer join addresses the RED minor that `MAX(fecha_aparicion)` would still pass fixture 176: `Importe` is `ti.importe` of `current_tarifa_id`, and the dual key `ti.tarifa_id = t.id` refuses a pointer that belongs to another parent.
- Quoted PascalCase set is complete, including `Sentido` (the discriminator vs `pwbi_tarifas`). `Categoria` is the calculated smallint on `tarifas`.
- Grants include `service_role` even though pgTAP only asserts `anon` / `authenticated`. `NOTIFY pgrst` matches the other Power BI views.
- Additive 28-line migration. Tests left as RED wrote them (stale “absent” header is the proof).

## Issues

### Critical

None.

### Important

None.

### Minor

1. **`LEFT JOIN` keeps tarifas without a current pointer.** File: `20260907103000_peajes_tarifas_v2_compat_cutover.sql:19-21`. Rows with `current_tarifa_id` NULL (or a pointer that fails `ti.tarifa_id = t.id`) still appear with `Importe` NULL. The brief’s join is satisfied; INNER JOIN would also pass 176. Fine for a configuration dimension. Task 10 should say v2 is “all `tarifas` + current amount when the pointer is valid,” not “only rows that have an amount.”

2. **Thinner than `pwbi_tarifas`.** No `Peaje_Nombre` / `Estacion_Nombre` / `hora_*` / current `fecha_aparicion`. Brief required **at least** the eight PascalCase columns; extras are YAGNI here. Task 10 should not describe v2 as a drop-in column clone of `pwbi_tarifas`.

## Assessment

**Task quality:** Approved

**Reasoning:** The cutover migration is the Approved RED contract: a parallel VIEW joined on `current_tarifa_id` (and `tarifa_id`), PascalCase columns, Power BI grants, leftover `pwbi_tarifas` and legacy RPCs. Tests were not edited. Minors are Task 10 wording, not Task 9 blockers.
