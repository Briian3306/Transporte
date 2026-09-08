# Task 1 Report — Register F14-16 and Freeze the Superseded Scope

**Status:** DONE  
**Owner:** Documentation agent  
**Date:** 2026-09-07  
**Commits:** none (forbidden)

## What you implemented

Registered **F14-16** in `feature_list.json` as `in_progress` (not `passing`), owner `01-backend-supabase`, dependency `F14-11`, suggested title verbatim, PRD refs pointing at the gradual plan plus Wave 0 historical fixture plan.

Copied Tasks 2–9 verification gates onto F14-16 in Spanish, matching neighboring F14 entries. Gates 1 and 8 were extended only to state the 2026-09-07 hard constraint: `tarifas_normalizadas` stays as the compatibility path and is not dropped, renamed, or replaced. F14-16 evidence is a docs-only registration note (no schema/RPC/UI claimed as implemented).

Froze **F14-12..F14-15**: titles, owners, `depends_on`, and historical verification left intact. Status stayed `not_started` because `blocked` is unused in this file. Added the F14-16 plan to `prd_refs` and evidence: `superseded by F14-16, never implemented`, plus why (sentido, current pointer, audited Cross, IVA flag, immutable history) and that `tarifas_normalizadas` remains the compatibility path.

Linked the gradual plan from both plan indexes without creating product table/RPC docs. Wave 0 remains done. Progress and handoff now treat F14-16 as the executable SQL/ETL/UI work, additive/shadow only.

Hard constraint applied everywhere this task writes: **do not remove `tarifas_normalizadas`**. Keep table, columns, FKs, writers, existing RPC signatures, views, and `pasadas.tarifa_normalizada_id`. Retirement is a later explicit project, out of F14-16.

## What you tested

N/A for product tests (docs-only task).

Sanity:

- `JSON.parse` of `ibarra-app/feature_list.json` succeeded (94 features).
- F14-11 status `passing`, evidence, fixture paths, verification, and “no SQL” history unchanged.
- F14-16 `in_progress`, 9 verification strings, not `passing`.
- F14-12..F14-15 `not_started` with superseded evidence.
- No `docs/06-tablas/peajes/tarifas-tarifa-importe.md` or `docs/backend/peajes/tarifas-tarifa-importe.md` created.

## TDD Evidence

N/A for this docs registration task.

## Files changed

Only the five files listed in the brief:

1. `ibarra-app/feature_list.json` — add F14-16; freeze F14-12..F14-15; F14-11 untouched
2. `ibarra-app/docs/plan/refactor-tarifas-importe/INDEX.md` — Wave 0 done; F14-16 executable plan; compatibility path
3. `ibarra-app/docs/plan/INDEX.md` — link gradual plan
4. `ibarra-app/docs/claude-progress.md` — 2026-09-07 registration entry
5. `ibarra-app/docs/session-handoff.md` — current F14-16 handoff at top

Did **not** modify product SQL or TypeScript. Did **not** commit or push.

## Self-review findings

- Completeness: F14-16 registered; F14-12..F14-15 frozen; indexes, progress, handoff updated; product schema/RPC docs deferred to Task 10.
- Quality: entry shape matches F14-11 (id, title, prd_refs, agent_owner, depends_on, status, verification[], evidence[]).
- Discipline (YAGNI): no extra product docs; no rewrite of F14-11; historical F14-12..F14-15 verification/titles kept.
- Hard constraint: new text states `tarifas_normalizadas` stays as compatibility path; no wording that F14-16 drops, renames, or replaces it.
- Verification gates 1 and 8 have small additive clauses vs the brief’s verbatim list, required by the user confirmation. Core gate text is otherwise the Tasks 2–9 list.
- `session-handoff.md` Wave 0 paragraph got a one-line pointer that SQL/ETL is now F14-16, so later agents do not follow the stale “wait for F14-12+” instruction. Fixture evidence itself was not rewritten.

## Issues or concerns

None blocking. Later F14-16 agents must treat `tarifas_normalizadas` as additive compatibility path only; do not change writers or `pasadas.tarifa_normalizada_id` in this feature.

---

## Review fix (2026-09-07, post-review)

Reviewer verdict was Spec ❌ / Needs fixes. Two Important items; no Critical. Controller adjudication: do not revert F18-2, F14-10, or 2026-08-28..2026-09-04 DESARROLLO/pico history.

### Fixes applied

1. `ibarra-app/docs/session-handoff.md` — Wave 0 sections (former lines 16 and 27–33) rewritten as **histórico / superseded**. Fixture paths kept. Explicit: F14-12..F14-15 superseded by F14-16, never implemented, must not be implemented. SQL/ETL/UI pointed at F14-16 / `PLAN_migracion-gradual-tarifas-tarifa-importe.md`. Ownership of F14-12..F14-15 labeled obsolete.

2. `ibarra-app/docs/claude-progress.md` — 2026-09-04 “F14-11..F14-15 `not_started`” paragraph marked **[histórico]** with vigente 2026-09-07 pointer. Added `### 2026-09-07 — F14-16 registro y freeze F14-12..F14-15` under Registro de sesiones. F18-2 / F14-10 / pico DESARROLLO entries untouched.

Did **not** modify `feature_list.json`, plan indexes, product SQL/TS, or product `tarifas-tarifa-importe.md`. Did **not** mark F14-16 `passing`. Did **not** commit.

### Covering checks re-run

- `JSON.parse` of `ibarra-app/feature_list.json` — OK, 94 features.
- F14-11 unchanged: `passing`; evidence still Wave 0 dump + 21 PASS + “Sin SQL”; 4 verification strings.
- F14-16 still `in_progress` (9 verification strings; not `passing`).
- F14-12..F14-15 still `not_started` with superseded evidence.
- `session-handoff.md`: grep of F14-12..F14-15 only hits freeze/histórico/superseded language. No current assignment of F14-12..F14-15 as implementable work. No “No implementar SQL hasta F14-12+”.
