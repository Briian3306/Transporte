### Task 9: Fan Out Shared Edits into Independent History Saves

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- Modify: `src/app/components/peajes/wizard/mocks/tarifa-refresh.mock.ts`

**Interfaces:**
- Consumes: `EditorGroup[]`, board drafts, candidate decisions, and start-date values.
- Produces: a flat `TarifaRefreshDecision[]` with one element per station tariff identity.

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

- [ ] Write the required failing test that a shared amount for Dock Sud and Hudson produces two save elements with distinct station ids and later receives two distinct `tarifa_id` / `tarifa_importe_id` results.
- [ ] Assert grouping shares only value, status, direction, and selected start date; it never reuses a tariff id, current pointer, history id, cases snapshot, or station id.
- [ ] Compute `cases` per station/candidate from that station’s imported row indexes instead of copying a combined group count to every history row.
- [ ] For `CONFIRM_NEW`, require non-empty New, exact identity, and start date. For `MARK_REVIEW`, require exact identity and candidate amount but keep validity null.
- [ ] If one group contains both IDA and VUELTA changes, emit both direction-specific decision sets in one atomic RPC call.
- [ ] Keep empty New cells out of the payload. Reject duplicate identities in the client before the RPC and preserve typed RPC errors for overlap/validation feedback.
- [ ] After success, emit every independently saved row to Paso 9 and re-run analysis. Do not close the dialog on error or partially clear drafts.
