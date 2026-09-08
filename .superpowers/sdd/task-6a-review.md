# Task 6A RED review — one Important fix before frontend GREEN

Reviewer: 75c90bb5-08d8-4e97-a37b-2ce7be805554
Outcomes/file-scope: ✅
Task quality labeled Approved, but one **Important** item must be patched (SDD: do not proceed while Important is open).

## Must fix (Important)

**Paso 8 never asserts `validarLote` arguments.** The mock returns the fixture regardless of input, so GREEN could call `validarLote([])`, drop mapped `SENTIDO`, or pass empty template configs and still pass.

In `paso8-validacion.component.spec.ts`:

- Spy/capture `validarLote` calls during `validar()`.
- Assert it is called with the mapped pasadas (not `[]`).
- Assert missing source direction is sent as `AMBAS` (or omitted `sentido` only if the service is what defaults — if the component is supposed to default, assert `AMBAS` in the payload).
- Assert template `configuraciones` are passed through when the selected pipeline is present (so IVA-once at the wizard→service boundary is not only a service-unit test).

Do **not** create `tarifa-validation.service.ts`. Do not edit component `.ts`/`.html`. Do not commit.

Re-run:
```
pnpm.cmd exec ng test --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Still expect RED (missing service module). New assertions must be in the spec so GREEN cannot skip the payload.

Append to `.superpowers/sdd/task-6a-report.md`.
