### Task 11: Keep the Standalone Tarifario Compatible with Validity

**Files:**
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.html`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.css`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor.component.spec.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-historial-dialog.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-historial-dialog.component.html`
- Modify: `src/app/components/peajes/models/tarifario.contracts.ts`

**Interfaces:**
- Consumes: expanded tariff editor/history RPC payloads.
- Produces: one explicit effective-start date for route-editor saves and a truthful validity/diagnostic history view.

- [ ] Add one shared `Vigente desde` single-date control for the route editor save batch; do not add an end-date input.
- [ ] Require the start date only when at least one New cell is non-empty and pass it with each change.
- [ ] Extend current/editor/history mappings with validity and diagnostic fields while preserving `fecha_aparicion` as observation time.
- [ ] Show `Desde`, `Hasta`, `Diagnóstico`, `Categoría calculada`, and `Vigente` in history. Use `—` / `Sin fecha conocida` for legacy nulls rather than inventing dates.
- [ ] Add tests that the standalone editor closes the previous validity through the same RPC behavior and still treats blank New cells as no-op.
