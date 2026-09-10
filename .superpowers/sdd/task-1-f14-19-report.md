# Task 1 report — Register F14-19 and Capture the Baseline

## What you implemented

Documentation/QA only. No product behavior.

- Inserted feature `F14-19` in `ibarra-app/feature_list.json` immediately after `F14-18` and before `F17-1`.
- Title (verbatim): `Tarifa Refresh Dialog validity, category correction and unresolved review`
- `agent_owner`: `02-frontend-wizard-tablas`
- `depends_on`: `F14-16`, `F14-17`, `F14-18`
- `status`: `in_progress`
- `prd_refs`:
  - `docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md`
  - `docs/plan/refactor-tarifas-importe/PLAN_refresh-tarifas-paso9.md`
- Copied plan acceptance cases into `verification` (Task 1 bullets + Required Test Matrix + Final Acceptance Checklist). 36 verification items.
- `evidence` is baseline-only (git SHA, git status, test commands/exit codes). No product claims.
- Prepended a dated F14-19 baseline entry to `ibarra-app/docs/claude-progress.md`. Prior F14-16/F14-17/F14-18 entries were not rewritten.
- Did not change F14-16/F14-17/F14-18 status, verification, or evidence (`git diff --stat`: 68 insertions, 0 deletions).
- Did not implement Tasks 2–13. Did not commit, amend, push, or deploy.

## What you tested and test results

Commands run **before** editing `feature_list.json` / `claude-progress.md`, from repo root then `ibarra-app`.

### Git (repo root)

```
git rev-parse HEAD
95033bda8434b21473aa51937dfa8831acf0d3b9

git branch --show-current
codex/tarifa-importe-cases

git status --short
 M .superpowers/sdd/progress.md
?? .pnpm-store/v11/projects/1a1330c3f101d64fe6d7165b7e72754e/docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md
?? .superpowers/sdd/task-1-f14-19-brief.md
?? ibarra-app/docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md
```

HEAD matches the dispatch SHA (`refactor(peajes): update tarifa refresh dialog and service integration`). Working tree was **not** empty: SDD ledger modification, SDD brief, plan copies (including a `.pnpm-store` copy that was not touched). Recorded verbatim as baseline.

### Focused Angular suites (`ibarra-app`)

```
pnpm exec ng test --watch=false --browsers=ChromeHeadless --include="**/peajes/services/tarifa-refresh.service.spec.ts" --include="**/peajes/wizard/paso9-revision/**/*.spec.ts" --include="**/peajes/tarifario/**/*.spec.ts" --include="**/peajes-tarifario.service.spec.ts"
```

- **EXIT 1**
- **TOTAL: 7 FAILED, 85 SUCCESS** (92 specs)
- Include globs resolved; helpers + dialog specs exist and were included.

All 7 failures are in `paso9-revision.component.spec.ts` (confirmed by a second focused run of that file: 7 FAILED, 3 SUCCESS):

1. `marca coincidencia histórica como informativa sin diálogo`
2. `masiva: confirma con rowIndexes sobre pasadasEstandarizadas, no validacion.validas concatenadas`
3. `no abre diálogo ni bloquea confirmar cuando el precio vigente coincide`
4. `incluye sentido AMBAS por defecto en el payload de confirmación`
5. `confirma carga y guarda pasadas + registro (mock)`
6. `masiva: no confirma documentos omitidos y los lista en el resumen`
7. `tras confirmar muestra el diálogo y al cerrarlo emite reiniciar`

These pre-exist at HEAD. Not fixed. Not attributed to F14-19.

### Local pgTAP (`ibarra-app`, `npx supabase`)

`npx supabase status` succeeded (local stack already up; some optional services stopped: imgproxy, edge_runtime, pooler). DB URL on `127.0.0.1:54322`. No `db push --linked`. No DESARROLLO writes.

```
npx supabase test db
```

- **EXIT 1**
- **Files=17, Tests=487, Result: FAIL**
- Failed files:
  - `peajes_refresh_tarifas_test.sql` — Failed 4/44, tests 41–44:
    - 41: `directional collision audit is read-only and callable`
    - 42: `directionless refresh candidates fail closed instead of becoming AMBAS` (have `HISTORICAL_TARIFF_MATCH`, want `DIRECTION_REQUIRED`)
    - 43: `station/lane direction catalogue exists`
    - 44: `station/lane catalogue rejects inferred AMBAS` (caught `42P01: relation "public.estaciones_vias_sentido" does not exist`)
  - `peajes_tarifa_importe_cases_test.sql` — Failed 2/16, tests 13, 16:
    - 13: `Paso 9 writes each detected row count to its own IDA or VUELTA identity`
    - 16: `invalid Paso 9 payload leaves both directional current pointers unchanged`
- Remaining 15 pgTAP files: ok.

These pre-exist at HEAD. Not fixed. Not attributed to F14-19.

### JSON validity

```
node -e JSON.parse(feature_list.json)
```

- **EXIT 0**
- Placement: F14-18 index 88, F14-19 index 89, F17-1 index 90 (`orderOk: true`)

## TDD Evidence

N/A for this bookkeeping task (JSON/markdown only). Baseline test evidence is recorded above and in `feature_list.json` evidence / `docs/claude-progress.md`.

Did not re-run Angular or pgTAP after the two doc edits; those suites do not cover `feature_list.json` or `claude-progress.md`.

## Files changed

- `ibarra-app/feature_list.json` — add F14-19 object only
- `ibarra-app/docs/claude-progress.md` — prepend dated F14-19 baseline entry
- `.superpowers/sdd/task-1-f14-19-report.md` — this report (required by dispatch; not a product file)

Not touched: SDD ledger `.superpowers/sdd/progress.md`, product Angular/SQL, F14-16/F14-17/F14-18 records, `.pnpm-store`.

## Self-review findings

- Title, owner, depends_on, status, placement, and prd_refs match the brief verbatim.
- Verification copies the plan’s Required Test Matrix, Final Acceptance Checklist, and Task 1 bullets as concrete, testable strings.
- Evidence contains commands, exit codes, pass/fail counts, and named failing tests. No “dialog works” / product-success claims.
- `git diff --stat` for the two owned files is insert-only (68 insertions, 0 deletions).
- Constraints honored: no DESARROLLO, no commit/push/deploy, no worktree, no Tasks 2–13, no `tarifas_normalizadas` changes.

## Issues or concerns

1. **Working tree was not clean at baseline.** Extra paths are SDD/controller files and plan copies (plus an ignored `.pnpm-store` copy). Recorded verbatim; not cleaned.
2. **HEAD already has failing focused suites.** Angular 7/92 and pgTAP 6/487 fail before any F14-19 product work. Later tasks must treat these as pre-existing unless they change those files. The Paso 9 confirmation specs appear blocked (`Hay pasadas sin estación o categoría numérica` / `confirmationBlocked`). pgTAP 43–44 fail because `public.estaciones_vias_sentido` is missing locally; test 42 returns `HISTORICAL_TARIFF_MATCH` instead of `DIRECTION_REQUIRED`.
3. **F14-18 remains `passing` in the feature list** with older evidence (pgTAP 16/467 PASS, ng 50 SUCCESS). This task was forbidden to rewrite that evidence. The newer HEAD baseline (17 files / 487 tests, 92 focused Angular specs) is recorded only on F14-19.
