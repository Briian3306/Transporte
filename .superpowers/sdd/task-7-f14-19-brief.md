### Task 7: Refactor the Reusable Tariff Board for Actual / Detected / New Clarity

**Files:**
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.ts`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.html`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.css`
- Modify: `src/app/components/peajes/tarifario/tarifario-editor-board.component.spec.ts`
- Verify: `src/app/components/peajes/tarifario/tarifario-editor.component.spec.ts`

**Interfaces:**
- Consumes: tariff rows, drafts, station-labelled current values, and candidate suggestions.
- Produces: a presentation-only editor usable by both the route editor and each Paso 9 group.

- [ ] Write failing tests for persistent `Actual`, `Detectado`, and `Nuevo` labels, station-labelled detected amounts/counts, solid editable fields, placeholder text, `aria-label`, and visible invalid/focus classes.
- [ ] Expand `TarifarioDetectedAmount` with station id/name/color and candidate id. Add an explicit `candidateSelected` event instead of mutating a draft from the board.
- [ ] When grouped current values are identical, render one amount plus all station names; when they differ, render one station-labelled amount per station so an anchor value never masquerades as the groupâ€™s current value.
- [ ] Change empty inputs from dashed/subtle to a solid border and distinct editable background. Preserve blank-as-no-op, decimal parsing, tabular numbers, Enter/Tab navigation, and history events.
- [ ] Implement the mobile order `Actual -> Detectado -> Nuevo` for each status and retain reduced-motion/focus behavior.
- [ ] Run board specs and the complete Tarifario component suite to prove route-editor behavior did not regress.

