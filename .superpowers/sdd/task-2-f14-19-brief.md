### Task 2: Add Validity and Diagnostic Schema with Safe Legacy Backfill

**Files:**
- Create via Supabase CLI: migration basename `peajes_tarifa_vigencia_diagnostico`
- Create: `supabase/tests/peajes_tarifa_vigencia_test.sql`
- Modify: `supabase/tests/peajes_f14_tarifas_importe_test.sql`

**Interfaces:**
- Consumes: current `tarifa_importe`, `tarifas_normalizadas.diagnostico`, immutable trigger, and current-pointer trigger.
- Produces: nullable `fecha_vigencia_inicio date`, `fecha_vigencia_fin date`, and `diagnostico text` with database-enforced interval rules.

- [ ] Run `npx supabase --version` and `npx supabase migration new peajes_tarifa_vigencia_diagnostico`; use the exact generated path for all edits and progress evidence.
- [ ] Write failing pgTAP assertions for the three columns, `date` types, nullability, six-value diagnostic check, invalid date ordering, and unchanged legacy table/FKs.
- [ ] Write failing pgTAP fixtures proving `tarifas_normalizadas.diagnostico` copies only through exact `tarifas_normalizadas_id` lineage and unlinked history remains `NULL`.
- [ ] Add the columns and named checks. The date check is `fecha_vigencia_fin IS NULL OR fecha_vigencia_inicio IS NULL OR fecha_vigencia_inicio < fecha_vigencia_fin`.
- [ ] Backfill only `diagnostico` through exact lineage. Assert that the migration leaves every pre-existing `fecha_vigencia_inicio` and `fecha_vigencia_fin` `NULL`.
- [ ] Enable `btree_gist` in the standard Supabase extensions schema and add a partial exclusion constraint over `tarifa_id WITH =` and `daterange(fecha_vigencia_inicio, COALESCE(fecha_vigencia_fin, 'infinity'::date), '[)') WITH &&`, limited to `diagnostico = 'CONFIRMADO' AND fecha_vigencia_inicio IS NOT NULL`.
- [ ] Replace `peajes_trg_tarifa_importe_immutable()` so amount, parent, calculated category, cases, observation date, diagnostic, start date, lineage, and creation time remain immutable; allow only one `fecha_vigencia_fin: NULL -> non-NULL` transition that passes the date check.
- [ ] Replace `peajes_trg_tarifa_importe_promote()` so only `CONFIRMADO` rows with a non-null start can promote. `REVISAR` and legacy/null-diagnostic inserts never move the pointer.
- [ ] Run the new pgTAP file alone, then reset local and run the complete database suite. Confirm no write touched DESARROLLO.

