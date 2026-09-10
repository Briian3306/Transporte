### Task 1: Register F14-19 and Capture the Baseline

**Files:**
- Modify: `feature_list.json`
- Modify: `docs/claude-progress.md`

**Interfaces:**
- Consumes: F14-16/F14-17/F14-18 `passing` state and this approved plan.
- Produces: One active `F14-19` record with exact verification criteria; no product behavior.

- [ ] Add `F14-19` titled `Tarifa Refresh Dialog validity, category correction and unresolved review`, owned by the tariff/Paso 9 workflow and dependent on F14-16, F14-17, and F14-18.
- [ ] Copy the acceptance cases from this plan into `verification`; set only F14-19 to `in_progress` when implementation begins.
- [ ] Record the clean starting commit and `git status --short` in `docs/claude-progress.md`; do not rewrite prior feature evidence.
- [ ] From `ibarra-app`, run the current focused Angular suites and `npx supabase test db` before changes. Record existing failures as baseline evidence rather than attributing them to F14-19.

