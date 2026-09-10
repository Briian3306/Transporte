### Task 10: Add the Five-Part Paso 9 Tariff Summary and Review Gate

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.html`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.css`
- Modify: `src/app/components/peajes/wizard/paso9-revision/paso9-revision.component.spec.ts`

**Interfaces:**
- Consumes: expanded analysis summary and saved confirmed/review results.
- Produces: final review sections and a confirmation gate based on explicit decisions rather than “no unresolved rows exist.”

- [ ] Render separate sections for current matches, historical matches, category corrections, new confirmed tariffs, unresolved tariffs marked `REVISAR`, and validity changes.
- [ ] Show station names rather than UUIDs and show provider category beside calculated category for corrections: `Categoría proveedor 3 -> calculada 2`.
- [ ] For validity changes, render station, category, status, direction, previous price, new price, and `Vigente desde` in `dd/MM/yyyy`.
- [ ] Change the gate so unacknowledged candidates still block, while candidates explicitly persisted as `REVIEW_RECORDED` / `REVISAR` allow continuation. A silent close/cancel never counts as acknowledgement.
- [ ] Keep `peajes:manage` required for both confirmed and review history writes. A user without it can inspect candidates but cannot bypass the tariff decision gate.
- [ ] After document confirmation, associate current, historical, category-correction, newly confirmed, and review history ids to their exact persisted pasadas. Never update `pasadas.categoria`.
- [ ] Preserve omitted-document filtering, per-document row-index mapping, FC/NC sign normalization, duplicate consent, partial mass-import failures, and the existing post-confirm association warning.
- [ ] Add the required test that continuing an unresolved candidate creates/uses a `REVISAR` result and enables confirmation only after that explicit action.
