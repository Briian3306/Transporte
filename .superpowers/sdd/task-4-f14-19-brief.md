### Task 4: Implement Validity-Aware Ordered Matching and Category Correction

**Files:**
- Modify: the Task 3 generated migration
- Modify: `supabase/tests/peajes_refresh_tarifas_test.sql`

**Interfaces:**
- Consumes: `{ id, estacion_id, categoria_proveedor, status_solicitado, sentido_solicitado, fecha_pasada, precio_directo, precio_normalizado }[]`.
- Produces: one ordered result per candidate with result code, provider/calculated categories, safe match or all possible matches, validity metadata, and diagnostic.

- [ ] Write failing pgTAP cases for the exact five-stage order: original-category current, original-category historical, other-category current, other-category historical, then unresolved/new.
- [ ] Add a candidate relation that returns current and historical rows across all categories while retaining `same_category`, direction rank, current rank, validity rank, diagnostic, and relative error.
- [ ] Apply price normalization selection exactly as today: `precio_normalizado` only when the matched identityâ€™s IVA flag is true; never perform IVA arithmetic in SQL.
- [ ] Filter safe matches to the inclusive 1% boundary and compatible validity. Prefer known covering intervals to unknown legacy intervals.
- [ ] Collapse to a correction only when one unique compatible target identity remains. Return `CURRENT_CATEGORY_CORRECTION` or `HISTORICAL_CATEGORY_CORRECTION`, provider category unchanged, and target category as `categoria_calculada`.
- [ ] When more than one category, status, direction, or historical identity remains, return `AMBIGUOUS_TARIFF_MATCH` (or the existing specific status/direction code) plus every `TarifaMatchOption`; do not pick by lowest error or amount order.
- [ ] Exclude `REVISAR` rows from safe current/history matches but include them in `possible_matches` with their diagnostic so the operator sees prior unresolved evidence.
- [ ] Preserve fail-closed direction behavior from `20260908200056_peajes_refresh_direction_fail_closed.sql`: null/conflicting direction never becomes `AMBAS` at the RPC boundary.
- [ ] Add explicit tests for `5300` matching only Category 2 PICO when provider category is 3, the same `5300` appearing in Categories 2 and 3 remaining ambiguous, and a historical Category 2 match never returning `NEW_TARIFF`.

