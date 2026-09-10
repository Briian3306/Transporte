# F14-19 Subagent-Driven Development ledger

Plan: `ibarra-app/docs/superpowers/plans/2026-09-09-tarifa-refresh-dialog-paso9-validity-corrections.md`

Workspace: `C:\Users\FRANCIS\Documents\progamacion\Transporte` on `codex/tarifa-importe-cases`. Work in the current checkout (no extra git worktree). Do not commit, amend, push, or deploy. No DESARROLLO writes. Do not delete/alter `tarifas_normalizadas`.

**Resume note:** Conversation-start git snapshot listed uncommitted dialog/helpers/checkbox-multi-select work. At controller start (2026-09-09) that product work is already in HEAD `95033bda8434b21473aa51937dfa8831acf0d3b9` (`refactor(peajes): update tarifa refresh dialog and service integration`). Working tree only has untracked plan copies. Do not destroy existing F14-18 product files; do not re-dispatch F14-18.

**Baseline HEAD:** `95033bd` — branch up to date with `origin/codex/tarifa-importe-cases`.

**Last refresh:** 2026-09-10 (Task 13 complete. F14-19 `passing`.)

| Task | Status | Owner | Notes |
| --- | --- | --- | --- |
| 1 Register F14-19 + baseline | complete | Documentation/QA | Uncommitted docs only (no commits). Review clean. Baseline HEAD `95033bd`. Angular focused 7 FAILED / 85 SUCCESS (paso9 pre-existing). pgTAP Files=17 Tests=487 FAIL (6 pre-existing: refresh direction + tarifa_importe cases). F14-19 `in_progress`. |
| 2 Validity/diagnostic schema | complete | Backend | Uncommitted (no commits). Review Approved. Dedicated pgTAP 51/51; full local suite Files=18 Tests=547 PASS. Writer shim `_peajes_append_tarifa_importe_confirmado` + fixture CONFIRMADO dates until Task 3. **Minors:** weak global NULL-dates assertion after no-seed reset; promote treats NULL-start current as older than any dated CONFIRMADO; shim stamps CURRENT_DATE; F14-16 assertion messages still mention created_at/id. `seed:local` EXIT 1 (`null_current_pointers=27`) — ETL/collisions, not this task. |
| 3 Confirmed/review atomic saves | complete | Backend | Uncommitted. Review Approved after fix. Full suite Files=18 Tests=575 PASS. `CONFIRM_NEW` same-amount later start closes+inserts; `SIN_CAMBIO` only same amount + start null/equal. **Minors:** no editor pgTAP for same-amount later start; unreachable NULL in SIN_CAMBIO predicate; duplicated overlap/SIN_CAMBIO logic; editor duplicate-cell check weaker than refresh; invalid editor dates reuse required-start message; `prior_fin` assigned even if close UPDATE matches 0 rows. |
| 4 Validity-aware matching | complete | Backend | Uncommitted. Review Approved after `possible_matches` validity filter. Refresh pgTAP 79/79; full suite Files=18 Tests=589 PASS. **Minors:** helper rank smoke test; unused `peajes_detectar_refresco_tarifas_legacy`. |
| 5 Angular contracts + extraction | complete | Frontend | Uncommitted. Review Approved. Refresh+tarifario specs 33/33; tsc app+spec noEmit 0. **Minors:** `filasNuevasConfirmadas` 0 until Task 10; mock analizar omits documentos/catalog; leftover `as never`; `fechaPasadaCanonico` yyyy-MM-dd only; dialog save still lacks action until Task 9. |
| 6 Pure station grouping reducer | complete | Frontend | Uncommitted. Review Approved. helpers.spec 28/28. Dialog empty-selection reject left for Task 8. **Minors:** preserveIdentityDrafts test does not regroup; catalog-only uses object identity; no peajeId share test; leftover signaturesDe dual-status expansion. |
| 7 Tarifario board Actual/Detected/Nuevo | complete | Frontend | Uncommitted. Review Approved. Board 16/16; Tarifario suite 53/53. **Minors:** detected buttons lack aria-label; shared-current test weak vs row-anchor; === on money; board tokens hardcoded vs dialog --at-*. |
| 8 Dynamic AMBAS/IDA/VUELTA editors | complete | Frontend | Uncommitted. Review Approved after Important fixes. Dialog 21/21; helpers 28/28; tsc app+spec 0. Empty selection rebuilds singletons; AMBAS one board / DIRECCIONAL IDA+VUELTA; rail Confirm/Revisar; Vigente desde single-date. **Minors for final review:** STATUS_AMBIGUOUS Confirm stays disabled (no rail status picker); dual draft+decision payload until Task 9; remapAssignedByCell can copy lock onto overlapping editors; history title uses editors[0]; occupied-cell lock treats autocomplete as taken; toIsoDate duplicates toDateInputValue; warnings spec omits categoria/direccion; precios warning per editor not per cell. |
| 9 Fan-out independent history saves | complete | Frontend | Uncommitted. Controller skipped re-review per user (do not chase the 1-test RED). Implementer: dialog 28/28 after Confirm-category fix; helpers 28/28; tsc 0. Flat `TarifaRefreshDecision[]`, Dock Sud+Hudson distinct ids, CONFIRM_NEW date+New. **Minors for final review:** reviewCovers sentido no dedicated spec; synthetic duplicate-identity test; relatedCandidate no amount match. |
| 10 Paso 9 summary + review gate | complete | Frontend | Uncommitted. Controller skipped re-review per user. Implementer after Critical/Important fix: Paso 9 21/21; dialog 28/28; tsc 0. Six sections, REVISAR overlay, Revisar tarifas reopen, contextIncomplete from overlaid results. **Minors for final review:** vigencia can overlap nuevas; detect still overlay-only; no browser pass. |
| 11 Standalone Tarifario validity | complete | Tarifario | Uncommitted. Review Approved. Editor 15/15; Tarifario 59/59; service 14/14; tsc 0. Shared Vigente desde; blank New no-op; history Desde/Hasta/Diagnóstico/Categoría calculada/Vigente. **Minors:** live `peajes_listar_tarifa_historial` still F14-17 shape (Sin fecha conocida until SQL emits fields); mock list/editor omit vigencia; canSave ignores date; extra Importe column. |
| 12 Full gates | complete | QA | pgTAP 589 PASS; Angular focused 172 SUCCESS; tsc 0. Browser/a11y deferido documentado. |
| 13 Docs + close F14-19 | complete | Documentation | Docs actualizados; F14-19 `passing` en feature_list.json; handoff + claude-progress. |

---

# F14-18 Subagent-Driven Development ledger

Plan executed: `ibarra-app/docs/plan/refactor-tarifas-importe/PLAN_refresh-tarifas-paso9.md`

Coordinator note: Task 1 is already complete (F14-18 registered `not_started`, plan indexes linked, planning-only `claude-progress` entry). Resume at Task 2. Do not redo Task 1. Do not commit or push. No DESARROLLO writes. Work in the current checkout (no extra git worktree).

Workspace: `c:\Users\FRANCIS\Documents\progamacion\Transporte` on current branch. F14-16 and F14-17 are prerequisites; keep `tarifas_normalizadas`, F14-16 public RPC signatures, and legacy `tarifa_status` intact.

**Last refresh:** 2026-09-08 (Task 3 complete; Task 4 in progress).


| Task | Status | Owner | Notes |
| --- | --- | --- | --- |
| 1 Register F14-18 | complete | Documentation | F14-18 `not_started` in `feature_list.json`; deps F14-16/F14-17; plan links in refactor INDEX + plan INDEX; planning-only `claude-progress`. No product SQL/TS. |
| 2 Contracts + extractor | complete | Frontend | RED then GREEN. Extraction 10 SUCCESS; mapping/Paso8/column-recognition 45 SUCCESS. Pure extractor in contracts; refresh method signatures on `PeajesTarifarioService`; implementers throw until Task 4. |
| 3 Batch RPCs prepare/detect | complete | Backend | RED then GREEN. Local pgTAP Files=16 Tests=456 PASS. Helper + prepare/detect INVOKER. F14-16 public signatures intact. No DESARROLLO. |
| 4 Transactional save + wrappers | in_progress | Backend | — |
| 5 Editor board + Dialog xl/top | pending | Frontend | — |
| 6 Refresh service + dialog host | pending | Frontend | — |
| 7 Paso 9 gate + mass import | pending | Frontend | — |
| 8 Full local verification | pending | QA | — |
| 9 Docs + close F14-18 | pending | Documentation | `passing` only if Task 8 gates all pass. |
