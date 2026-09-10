### Task 5: Extend Angular Contracts and Date-Aware Candidate Extraction

**Files:**
- Modify: `src/app/components/peajes/models/tarifa-refresh.contracts.ts`
- Modify: `src/app/components/peajes/models/tarifario.contracts.ts`
- Modify: `src/app/components/peajes/services/tarifa-refresh.service.ts`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.ts`
- Modify: `src/app/components/peajes/services/tarifa-refresh.service.spec.ts`
- Modify: `src/app/components/peajes/services/peajes-tarifario.service.spec.ts`

**Interfaces:**
- Consumes: existing standardized pasadas, document signs, lane-direction map, template configuration, and expanded RPCs.
- Produces: typed candidates/results/decisions/summaries used by the dialog and Paso 9.

- [ ] Write failing unit tests proving the candidate key includes the pasada calendar date, preserves all original row indexes, excludes omitted documents, and keeps provider category separate from calculated category.
- [ ] Keep `normalizarImportesPasada` for FC/NC physical sign and `TarifaComparisonAdapterService` for conditional IVA comparison; add a regression test that spies on the adapter so no duplicate normalization path appears.
- [ ] Extend candidates with `fechaPasada`, station display metadata, and source price/count while keeping explicit/lane-map direction confidence.
- [ ] Extend RPC payload mappers and result guards for category correction codes, possible matches, diagnostics, validity dates, and `categoriaCalculada`.
- [ ] Replace aggregate `pendientes` alone with counts for current matches, historical matches, category corrections, confirmed-new rows, unresolved rows, and validity changes; retain old fields temporarily if another component still consumes them.
- [ ] Extend association eligibility to current/history category-correction results and persisted `REVIEW_RECORDED` results without changing `pasadas.categoria`.
- [ ] Run the refresh and tariff-service specs and both TypeScript no-emit builds.

