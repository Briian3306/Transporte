# Task 2 GREEN — schema migration only

Read this first. RED pgTAP is already written and review-approved. You implement production SQL only.

**Owner:** Backend write  
**Required skills:**
- `ibarra-app/.agents/skills/backend-supabase-write/SKILL.md`
- `ibarra-app/.agents/skills/supabase/SKILL.md`
- `ibarra-app/.agents/skills/supabase-postgres-best-practices/SKILL.md`
- TDD: make the existing tests pass; do not rewrite them

**Files:**
- Create: `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql`
- Do **not** modify `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` (tester owns it)
- Do **not** edit product docs, ETL, or Angular

**Produces:** Empty v2 tables, indexed FKs, RLS/grants, `pasadas.sentido`, nullable `pasadas.tarifa_importe_id`; no legacy behavior changes.

## Plan steps (GREEN)

- [ ] Create `tarifas`, `tarifa_importe`, FKs, checks, RLS/grants, the configuration unique key, lineage unique partial index, history index, and shadow `pasadas` columns exactly as specified in `.superpowers/sdd/task-2-brief.md`.
- [ ] Re-run from `ibarra-app`: `npx supabase db reset --local --no-seed` and `npx supabase test db --local`; confirm the new pgTAP file and existing suites pass.
- [ ] Confirm nothing was applied to DESARROLLO.
- [ ] Do not commit.

## Hard constraints

- **Do not remove, rename, or alter `tarifas_normalizadas` or its existing FKs.**
- Do not edit an already-applied migration. Only the new file named above.
- Do not add `pasadas.peaje_id`.
- `sentido` CHECK is `IDA` | `VUELTA` | `AMBAS` (default `AMBAS`) on both `tarifas` and `pasadas`.
- Unique `(tarifa_id, id)` on `tarifa_importe` must be an explicit unique (PK on `id` alone is not enough).
- History index must be `(tarifa_id, fecha_aparicion DESC, created_at DESC, id DESC)`.
- Task 3 owns current-pointer composite FK and immutability triggers — do not add them here. `current_tarifa_id` stays nullable.
- Follow existing Peajes RLS/grant pattern (authenticated ALL) from neighboring tariff migrations.
- Local CLI only. No `db push --linked`, no MCP `apply_migration` to DESARROLLO.
- Do not commit unless the user asks.

## Tests you must not edit

`ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql` (`plan(118)`). If a test fails after an honest schema, report DONE_WITH_CONCERNS / BLOCKED — do not weaken the test.

## Report

Write/append GREEN evidence to `.superpowers/sdd/task-2-report.md`: command, pass counts, files changed, self-review.
