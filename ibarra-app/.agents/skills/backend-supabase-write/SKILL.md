---
name: backend-supabase-write
description: >-
  Implements Supabase backend changes (RPC, SQL functions, views, triggers,
  policies, RLS, migrations) and Angular services that call Supabase. Uses the
  canonical Local -> DEV -> PROD workflow from
  docs/backend/supabase/backend-workflow.md. Production changes require explicit
  user authorization. Writes reproducible SQL task scripts
  to docs/08-sql/{task}/. Requires skill supabase for implementation and
  supabase-postgres-best-practices when writing or optimizing SQL queries.
  Use when implementing backend Supabase work, database schema changes, RPC functions, RLS policies, or Supabase service
  updates. Does not replace backend-documenter or backend-tester.
---

# Backend Supabase Write

You are an expert Supabase backend implementation assistant.

This skill is responsible for implementing backend changes related to Supabase and Angular services that interact with Supabase.

This skill does not replace documentation or testing skills.

After the implementation is completed, you must run:

1. `backend-documenter (first)`
2. `backend-tester`

## Main Responsibility

Your responsibility is to implement backend changes as reproducible migrations and SQL task documentation following the official workflow:

```text
Local CLI -> DEV -> PROD
```

Canonical docs:

| Document | Purpose |
|----------|---------|
| [docs/backend/supabase/backend-workflow.md](../../../docs/backend/supabase/backend-workflow.md) | CLI flow, environments, migrations, seeds, webhooks, Edge Functions |
| [docs/backend/supabase/backend-testing.md](../../../docs/backend/supabase/backend-testing.md) | Required verification after implementation |
| [docs/backend/supabase/index.md](../../../docs/backend/supabase/index.md) | Cross-module Supabase index: RLS, auth, links |

The project has local CLI plus two Supabase remote projects:

| Environment | Project ref | API URL |
|-------------|-------------|---------|
| **Local CLI** | Docker + Supabase CLI | `http://127.0.0.1:54321` |
| **DEV** | `edxoqshrzdqpnldktpzy` | `https://edxoqshrzdqpnldktpzy.supabase.co` |
| **PROD** | `kfffigvyvtzyczeiadxh` | `https://kfffigvyvtzyczeiadxh.supabase.co` |

Implement locally first. Push to DEV only after local rebuild succeeds. Never apply schema changes to production until DEV is validated and the user explicitly authorizes the production action.

**CLI rule:** always use `pnpm supabase`; the global `supabase` command is not available in this repo.

Before any `--linked` command, confirm the linked project:

```powershell
Get-Content supabase\.temp\project-ref
```

Expected refs:

| Environment | Expected ref |
|-------------|--------------|
| DEV | `edxoqshrzdqpnldktpzy` |
| PROD | `kfffigvyvtzyczeiadxh` |

When you make any change in Supabase, you must write the executed SQL commands in:

```txt
docs/08-sql/{task}/
```

Where `{task}` is the active feature `id` from `feature_list.json` or the current branch name.

The Markdown file in that folder must contain the exact SQL/migration notes needed to reproduce or review the change after it has passed Local and DEV validation.

This is required because changes are first implemented as migrations, tested locally, pushed to DEV, and only then considered for production after explicit user authorization.

## Responsibilities

You can:

- Create or modify Supabase RPC functions.
- Create or modify Supabase SQL functions.
- Create or modify database views.
- Create or modify triggers.
- Create or modify policies.
- Create or modify RLS rules.
- Create or modify tables only when explicitly required by the task.
- Create migrations when needed.
- Write SQL scripts in `docs/08-sql/{task}/`.
- Update Edge Functions in `supabase/functions/`.
- Modify Angular services only when they call Supabase directly.
- Update Supabase-related backend logic.

You must not:

- Create frontend components.
- Modify UI behavior unless it is directly required by a Supabase service call.
- Replace the responsibility of the documentation skill.
- Replace the responsibility of the testing skill.
- Make undocumented Supabase changes.
- Apply changes to **production** (`kfffigvyvtzyczeiadxh`) without explicit user authorization in the current conversation.
- Run `pnpm supabase db reset --linked` on production.
- Copy production URLs, Bearer tokens, or `service_role` keys into migrations.
- Commit sensitive seed data in `supabase/seed.sql`.

## Required companion skills

This skill orchestrates backend work. It does **not** replace specialized Supabase skills. Read the correct skill **before** writing code or SQL.

| When you are… | Read this skill | Path |
|---------------|-----------------|------|
| Implementing Supabase backend code (RPC, Edge Functions, migrations, RLS, policies, auth, storage, CLI, MCP, security checklist) | **`supabase`** | [../supabase/SKILL.md](../supabase/SKILL.md) |
| Writing or optimizing SQL **queries** (SELECT, JOINs, filters, indexes, EXPLAIN, pagination, N+1, schema design for read/write patterns) | **`supabase-postgres-best-practices`** | [../supabase-postgres-best-practices/SKILL.md](../supabase-postgres-best-practices/SKILL.md) |

### Decision rule

1. **Always read `supabase`** before any Supabase backend change (objects, permissions, deployment workflow, dev vs main safety).
2. **Also read `supabase-postgres-best-practices`** when the task includes query logic inside functions, views, or reports — not only DDL shells.
3. **Both skills** when adding or changing an RPC/view/trigger whose body contains non-trivial SQL (security from `supabase`, performance from `supabase-postgres-best-practices`).

Examples:

| Task | `supabase` | `supabase-postgres-best-practices` |
|------|:----------:|:------------------------------------:|
| New RLS policy on a table | ✓ | — |
| New table + GRANT + enable RLS | ✓ | ✓ (indexes, FK indexes) |
| RPC with complex SELECT/JOIN | ✓ | ✓ |
| Edge Function calling Supabase client | ✓ | — |
| Trigger with simple validation | ✓ | — |
| Kanban stats / aggregated query RPC | ✓ | ✓ |
| Angular service `.rpc()` call only | ✓ | — |

Do not guess Supabase APIs or security patterns from memory — follow `supabase` and verify against current docs/changelog as that skill requires.

## Before Writing Code

Before making any change, you must:

1. Read the active feature from `feature_list.json`.
2. Read [backend-workflow.md](../../../docs/backend/supabase/backend-workflow.md) and [backend-testing.md](../../../docs/backend/supabase/backend-testing.md).
3. Read skill **`supabase`** ([SKILL.md](../supabase/SKILL.md)).
4. If the change includes SQL queries (not DDL-only), also read **`supabase-postgres-best-practices`** ([SKILL.md](../supabase-postgres-best-practices/SKILL.md)).
5. Confirm current Supabase link before any `--linked` command with `Get-Content supabase\.temp\project-ref`.
6. Read existing files related to the backend area being modified.
7. Identify the exact backend object being changed, such as:

- RPC function
- SQL function
- Table
- View
- Trigger
- Policy
- RLS rule
- Storage bucket
- Edge Function
- Angular service method

8. Check whether the change affects:

- Authentication
- RLS
- Policies
- Views
- Storage
- Exposed tables
- RPC permissions
- Angular Supabase service calls

9. Verify if the change requires:

- A migration
- A SQL script in `docs/08-sql/{task}/`
- Updates to Angular services
- Documentation updates
- Tests
- DEV push and app validation

## SQL Documentation Requirement

Every Supabase change must be written in a Markdown file inside:

```txt
docs/08-sql/{task}/
```

The `{task}` is the feature or the branch.

Use the template in [plantilla-sql-task.md](plantilla-sql-task.md).

Required sections: Summary, Affected Objects, SQL Commands, Execution Notes, Main Database Instructions.

Apply structural changes through `supabase/migrations/`. Never create tables, columns, functions, triggers, policies, constraints, or indexes manually in Dashboard after normalization.

## Standard Change Cycle

Use this cycle for any DB / Supabase structural change:

```powershell
pnpm supabase migration new nombre_del_cambio
# edit supabase/migrations/<timestamp>_nombre_del_cambio.sql
pnpm supabase db reset --local --no-seed
pnpm supabase test db
pnpm supabase link --project-ref edxoqshrzdqpnldktpzy
Get-Content supabase\.temp\project-ref
pnpm supabase db push --linked --dry-run
pnpm supabase db push --linked
# validate app against DEV; production requires explicit user authorization
```

Production commands are reference-only unless the user explicitly authorizes a production action. If authorized, commands must be explicit:

```powershell
pnpm supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
pnpm supabase db push --linked --dry-run
pnpm supabase db push --linked
```

Never run `pnpm supabase db reset --linked` while linked to `kfffigvyvtzyczeiadxh`.

## Seeds, Webhooks, and Edge Functions

- `db push` applies migrations only; it does not apply `supabase/seed.sql`.
- Use `pnpm supabase db reset --local` to apply seed locally.
- Do not commit `supabase/seed.sql` when it contains real/sensitive data.
- Environment-specific webhooks must be configured per environment; do not hardcode production URLs or secrets in migrations.
- Edge Functions live in `supabase/functions/` and are deployed with:

```powershell
pnpm supabase functions deploy <function-name> --project-ref edxoqshrzdqpnldktpzy
pnpm supabase functions deploy <function-name> --project-ref kfffigvyvtzyczeiadxh
```

The production deploy command is reference-only unless the user explicitly authorizes it.

## Implementation Rules

When writing SQL:

- Use safe and explicit SQL.
- Prefer `create or replace function` for functions when appropriate.
- Include schema names explicitly, for example `public.function_name`.
- Put structural changes in `supabase/migrations/`.
- Do not drop objects unless the task explicitly requires it.
- Do not weaken RLS or policies without explaining the reason.
- Do not expose sensitive data through views, RPCs, or policies.
- Keep SQL commands reproducible.
- Keep SQL commands ordered exactly as they should be executed.
- Keep secrets out of migrations, SQL docs, and seeds.

When modifying Angular services:

- Only modify services that directly call Supabase.
- Keep frontend components unchanged.
- Keep the service method names consistent unless the task requires a change.
- Update TypeScript types when the Supabase response shape changes.
- Handle Supabase errors clearly.

## Common source locations

| Artifact | Location |
|----------|----------|
| RPC / standalone SQL | `supabase/functions/*.sql`, `sql/` |
| Edge Functions | `supabase/functions/*/index.ts` |
| RLS | `sql/rls_*.sql` |
| Migrations | `supabase/migrations/` |
| Backend workflow docs | `docs/backend/supabase/backend-workflow.md`, `docs/backend/supabase/backend-testing.md` |
| Angular services | `src/app/features/*/services/` |
| DB types | `src/app/core/models/database.type.ts` |
| Legacy SQL | `docs/08 - SQLs/` (reference; new tasks → `docs/08-sql/`) |


## Completion Criteria

This skill is complete only when the backend code change has been implemented.

The overall task is not considered fully complete until the documentation and testing skills have also been executed.

After this skill completes the backend implementation, run the following skills only if the backend task is completed:

1. `backend-documenter`
2. `backend-tester`

Checklist before handoff:

- [ ] Canonical docs read: `backend-workflow.md` and `backend-testing.md`
- [ ] Change implemented as migration in `supabase/migrations/` when structural
- [ ] Local schema rebuild succeeds: `pnpm supabase db reset --local --no-seed`
- [ ] pgTAP command considered or run by `backend-tester`: `pnpm supabase test db`
- [ ] If pushed remotely, CLI linked to DEV (`edxoqshrzdqpnldktpzy`) and dry-run reviewed
- [ ] Markdown task file in `docs/08-sql/{task}/` with exact SQL / migration notes
- [ ] Angular service/types updated if RPC shape changed
- [ ] No command applied to **production** (`kfffigvyvtzyczeiadxh`) unless explicitly authorized by the user
- [ ] No production URLs, Bearer tokens, or `service_role` keys copied into migrations
- [ ] `supabase` security checklist reviewed if auth/RLS/views/storage touched
- [ ] Query performance rules applied if SQL queries were added or changed
- [ ] Invoke `backend-documenter`
- [ ] Invoke `backend-tester`

## References

- SQL task template: [plantilla-sql-task.md](plantilla-sql-task.md)
- Dev vs main: [entornos.md](entornos.md)
- Supabase CLI workflow: [docs/backend/supabase/backend-workflow.md](../../../docs/backend/supabase/backend-workflow.md)
- Backend testing workflow: [docs/backend/supabase/backend-testing.md](../../../docs/backend/supabase/backend-testing.md)
- Backend docs: [backend-documenter](../backend-documenter/SKILL.md)
- Supabase implementation: [supabase](../supabase/SKILL.md)
- SQL queries / performance: [supabase-postgres-best-practices](../supabase-postgres-best-practices/SKILL.md)

