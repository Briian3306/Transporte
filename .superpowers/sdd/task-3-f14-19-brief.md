### Task 3: Make Confirmed and Review Saves Atomic

**Files:**
- Create via Supabase CLI: migration basename `peajes_tarifa_matching_correcciones`
- Modify: `supabase/tests/peajes_refresh_tarifas_test.sql`
- Modify: `supabase/tests/peajes_tarifario_rpc_test.sql`

**Interfaces:**
- Consumes: `TarifaRefreshDecision[]` and the validity schema from Task 2.
- Produces: expanded `peajes_guardar_refresco_tarifas(jsonb)` and `peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)` behavior with unchanged SQL signatures.

```ts
export interface TarifaRefreshDecision {
  candidateId: string;
  action: 'CONFIRM_NEW' | 'MARK_REVIEW';
  peajeId: string;
  estacionId: string;
  categoriaProveedor: number;
  categoriaCalculada: number | null;
  status: 'PICO' | 'NO_PICO';
  sentido: 'IDA' | 'VUELTA' | 'AMBAS';
  importe: number;
  fechaVigenciaInicio: string | null;
  cases: number;
  requiereNormalizacionIva: boolean | null;
}
```

- [ ] Write failing pgTAP tests for a confirmed save that locks the tariff row, validates all payload elements before mutation, closes the prior current row at the new start, inserts a `CONFIRMADO` row with null end, updates `current_tarifa_id`, and updates `tarifas.fecha_actualizacion`.
- [ ] Assert the prior amount, category metadata, observation date, lineage, and cases are byte-for-byte unchanged after its end date closes.
- [ ] Assert `[2026-06-01, 2026-09-01)` followed by `[2026-09-01, infinity)` succeeds, while a start before the active start or inside another known interval rejects the entire batch.
- [ ] Write a failing test that `MARK_REVIEW` inserts `diagnostico = 'REVISAR'` with null validity, does not close the current row, and does not move the pointer.
- [ ] Validate allowed action/status/direction, positive amount, category 0â€“10, required start for `CONFIRM_NEW`, forbidden start for `MARK_REVIEW`, station ownership, explicit IVA for a missing identity, and duplicate candidate/identity cells before writes.
- [ ] Lock existing `tarifas` rows in deterministic `(peaje_id, estacion_id, sentido, categoria, status)` order to reduce grouped-save deadlock risk.
- [ ] For confirmed rows, update the prior end before inserting the new open interval. For review rows, append only the review observation. Return stable input order and include prior amount, prior end, new start/end, diagnostic, calculated category, and new history ID.
- [ ] Extend the route-editor save RPC JSON elements with `fecha_vigencia_inicio`; keep the function signature unchanged and set `diagnostico = 'CONFIRMADO'` internally.
- [ ] Run focused pgTAP, then the full database suite. Query constraints and function privileges to prove the functions remain `SECURITY INVOKER`, `PUBLIC` has no execute, and `authenticated, service_role` retain only the existing intended access.

