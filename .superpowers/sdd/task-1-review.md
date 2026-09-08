# Task 1 review — needs fixes

Reviewer: 6bcf95db-c3ab-4e96-b0ee-be12d02519b4
Verdict: Spec ❌, Task quality: Needs fixes
No Critical. Two Important (one adjudicated as Task 1; one adjudicated as pre-existing dirty tree).

## Must fix (Important)

1. **Incomplete freeze in `ibarra-app/docs/session-handoff.md`.**
   - Top section (lines 3–12) correctly freezes F14-12..F14-15.
   - Line 16 still says: do not implement SQL until explicit request for F14-12+.
   - Lines 27–33 still title “Handoff F14-11..F14-15” and assign F14-12..F14-14 to agent 01 as implementable work.
   - Rewrite those historical Wave 0 sections so they cannot be read as current instructions. Keep fixture paths. State clearly that F14-12..F14-15 are superseded by F14-16 and must not be implemented. Point SQL/ETL/UI work at F14-16 / `PLAN_migracion-gradual-tarifas-tarifa-importe.md`.

2. **`ibarra-app/docs/claude-progress.md` current-state contradiction.**
   - Line 17 correctly registers F14-16.
   - Line 21 (dated 2026-09-04) still says Features F14-11..F14-15 `not_started`, which conflicts with the freeze two lines above.
   - Make that 2026-09-04 paragraph explicitly historical (do not present it as current). Add a `### 2026-09-07` F14-16 registration section if the file uses `###` dated sections for features.

## Do not “fix” (controller adjudication)

The review package was working-tree vs HEAD `19369b4`. This checkout already had dirty `feature_list.json` / `claude-progress.md` / `session-handoff.md` before Task 1.

- **Do not revert F18-2 evidence** (`feature_list.json` around the F18-2 entry). Treat as pre-existing dirty work, not Task 1.
- **Do not delete F14-10** or rewrite F14-11 Wave 0 evidence/fixture paths.
- **Do not strip** 2026-08-28..2026-09-04 DESARROLLO/pico/F14-10 progress entries that already existed.

## Still out of scope

- No product SQL/TypeScript
- Do not create `tarifas-tarifa-importe.md` product docs
- Do not mark F14-16 `passing`
- Do not commit
- Keep `tarifas_normalizadas` as compatibility path (do not remove)

## Tests to re-run

- `JSON.parse` of `ibarra-app/feature_list.json`
- Confirm F14-11 status/evidence unchanged
- Confirm F14-16 still `in_progress`
- Confirm session-handoff no longer tells agents to implement F14-12..F14-15
