# <Epic> — Execution Plan

> Plan only; do not implement product code while writing this document.

**Goal:** <verifiable outcome>  
**Source:** <PRD, issue, or request path>  
**Status:** Planned

## Scope

- In: <capabilities>
- Out: <explicit exclusions>
- Invariants: <business/security/data constraints>
- Decisions needed: <material blockers only>

## Waves and ownership

| Wave | Tasks | Gate | Parallelism |
|---|---|---|---|
| 0 | <contracts> | <contract/decision> | Serial |
| 1 | <tasks> | Wave 0 verified | Disjoint files only |
| 2 | <QA/docs> | Wave 1 verified | Serial |

| Task | Owner | Skills | Exact files |
|---|---|---|---|
| <ID> | `<agent>` | `<skills>` | `<paths>` |

## Tasks

### <ID> — <deliverable>

**Owner:** `<agent>` · **Depends on:** `<IDs/none>` · **Skills:** `<skills>`

**Files:** Create `<path>`; modify `<path>`; test `<path>`.

**Contracts:** Consumes `<signature/table/type>`; produces `<signature/table/type>` for `<consumer>`.

- [ ] Red: write `<test behavior>` in `<test file>`.
- [ ] Verify red: run `<command>`; expected failure: `<missing behavior>`.
- [ ] Green: implement `<minimal ordered changes and validation/result>`.
- [ ] Verify green: run `<command>`; expected `<pass/result>`.
- [ ] Refactor: `<allowed cleanup>`; repeat `<command>`.
- [ ] Evidence: record actual commands/results in the feature record and progress log.
- [ ] Commit: stage only owned files; message `<message>`.

## Verification matrix

| Layer | Component/task | Command | Expected evidence |
|---|---|---|---|
| Unit | <component> | `<command>` | <behavior passes> |
| Integration | <boundary> | `<command>` | <contract result> |
| Database | <migration/RPC> | `<npx supabase ...>` | <CLI result; no remote write> |
| Static/build | <app> | `<command>` | <clean output> |
| Manual/visual | <flow> | <steps> | <observation> |

## Completion

- [ ] Feature statuses and evidence reflect executed work only.
- [ ] `feature_list.json`, progress log, and handoff match the plan.
- [ ] Documentation and integrator verification are scheduled.
