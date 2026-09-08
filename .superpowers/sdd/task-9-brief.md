# Task 9 — Independent verification and evidence (F14-16)

**Owner:** Backend tester  
**Date:** 2026-09-08  
**Skills:** `ibarra-app/.agents/skills/backend-tester/SKILL.md`  
**Target:** **local** only (Supabase CLI Docker). Not DESARROLLO. No `db reset --linked`, `db push --linked`, or MCP `apply_migration`.  
**Commits:** none (forbidden). Do **not** mark F14-16 `passing` (Task 10).

## Role

Verify Tasks 2–8. Do not implement features, views, ETL load, or product UI. If any required gate fails, leave F14-16 `in_progress` and record the failure.

## Allowed edits

- Unskip Node test `splitSentidoCollisions remaps the second sentido onto a new parent id` in `ibarra-app/scripts/peajes-catalogo-audit/migrate-tarifario-v2.test.mjs` (remove `{ skip: ... }` only).
- After gates: F14-16 **evidence** only in `ibarra-app/feature_list.json` (status stays `in_progress`).
- Task 9 entry in `ibarra-app/docs/claude-progress.md`.
- `.superpowers/sdd/task-9-report.md` and `.superpowers/sdd/progress.md`.

Do **not** edit product UI, migrations, ETL load logic, or canonical docs.

## Carry-forward (record; do not “fix”)

| Item | Treatment |
|---|---|
| Unskip `splitSentidoCollisions remaps the second sentido onto a new parent id` | Required this task. Function already satisfies it (Task 7 GREEN review replay). Failure is a **gate failure**. |
| Empty pasadas 0/0/0 after `--no-seed` | **Explained**, not a hidden mismatch. Real-volume pasadas backfill still unproven outside pgTAP fixtures. |
| Task 8: `pwbi_tarifas_v2` LEFT JOIN can yield null `Importe`; v2 is not a drop-in clone of `pwbi_tarifas` | Mention for Task 10. Do not rewrite the view unless a test fails. |
| Task 6A: `asociarTrasConfirmacion` unwired after confirm | Deferred. Do not implement. |
| Task 7 minors (ON CONFLICT DO NOTHING, `_stg_precio_last`, 8 TN lineage skips) | Record for Task 10 / final review. Not gates unless tests fail. |

## Gates (all from `ibarra-app` unless noted)

Record command, date **2026-09-08**, exit code, and counts.

1. `npx supabase start` (if needed)
2. `npx supabase db reset --local --no-seed`
3. `npx supabase test db` — expect Files=14, Tests=412 (or current plan sum)
4. Unskip then `node --test scripts/peajes-catalogo-audit/*.test.mjs` — 0 skip for the sentido test
5. Focused Angular:
   ```
   pnpm.cmd exec ng test --include="**/tarifa-comparison-adapter.service.spec.ts" --include="**/tarifa-validation.service.spec.ts" --include="**/paso8-validacion.component.spec.ts" --watch=false --browsers=ChromeHeadless
   ```
6. Cheap F14/audit regression (existing specs only):
   ```
   pnpm.cmd exec ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
   ```
   Do **not** run the full app `ng test`.
7. `pnpm.cmd exec npx tsc --noEmit -p tsconfig.app.json`
8. `pnpm.cmd exec npx tsc --noEmit -p tsconfig.spec.json`
9. Review `.superpowers/sdd/task-7-parity-report.md`: unexplained pointer/lineage/price mismatches must be **zero**. Empty pasadas after `--no-seed` is explained (do not re-run `--load-local`; that is not this gate).

## Pass / fail rule

- All gates green → evidence in F14-16; status remains `in_progress`; Task 9 complete; next is Task 10.
- Any required gate fails → F14-16 stays `in_progress`; Task 9 blocked; do not hide the failure.

## Out of scope

- Marking F14-16 `passing`
- Canonical product docs (Task 10)
- DESARROLLO writes or treating DESARROLLO as evidence
- Implementing `asociarTrasConfirmacion` wiring, INNER JOIN on the view, or a real-volume pasadas seed
