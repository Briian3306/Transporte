### Task 8: Render Dynamic AMBAS / IDA / VUELTA Editors and Candidate Decisions

**Files:**
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.ts`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.html`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.css`
- Modify: `src/app/components/peajes/wizard/paso9-revision/tarifa-refresh-dialog.component.spec.ts`
- Reuse: `src/app/components/shared/checkbox-multi-select/checkbox-multi-select.component.ts`
- Reuse: `src/app/components/shared/search-select/search-select.component.ts`
- Reuse: `src/app/components/shared/date-range-picker/date-range-picker.component.ts` with `mode="single"`
- Reuse: `src/app/components/shared/dialog/dialog.component.ts`

**Interfaces:**
- Consumes: pure groups/autocomplete from Task 6 and the board from Task 7.
- Produces: explicit candidate decisions with valid category/status/direction and optional confirmed start date.

- [ ] Build station options only from imported `detectedStations`; pass `badgeColor`/`iconColor` to the existing multi-select and set hint text that deselected stations receive independent editors.
- [ ] Rebuild editor groups on every selection change. Preserve singleton editors for deselected stations, including when the shared selection becomes empty.
- [ ] For `AMBAS`, render one board. For stations configured with directional tariffs, render both IDA and VUELTA boards in the same dialog. Never use tabs or navigate away.
- [ ] If explicit/lane context resolves a direction, preselect it. If only one `AMBAS` tariff family applies, preselect `AMBAS`. Otherwise render the existing searchable select with only IDA, VUELTA, and AMBAS and require a user choice.
- [ ] Render a candidate rail with station trace, provider category, calculated category/possible options, detected normalized amount, occurrence count, status, direction, validity evidence, and reason text.
- [ ] Let the operator assign one candidate to a specific allowed cell, confirm it as new, or mark it for review. Never assign by amount alone, and never let two distinct candidates silently replace the same `Nuevo` draft.
- [ ] Use the shared date picker only in `mode="single"`, labelled `Vigente desde`. Do not render or request an end-date control. Require the date only when at least one decision is `CONFIRM_NEW`.
- [ ] Keep `Nuevo` as the editable source of truth. Autocomplete writes a draft suggestion only; opening/reloading/grouping the dialog never calls a save RPC.
- [ ] Add accessible warnings for no compatible tariff, category/status/direction ambiguity, multiple prices, overlap rejection, missing permission, and `REVISAR` consequences.

