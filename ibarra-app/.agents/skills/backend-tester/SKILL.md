---
name: backend-tester
description: >-
  Verifies backend changes after implementation and documentation for Peajes /
  Transporte Ibarra. All SQL/migration testing runs against Supabase CLI (local).
  DESARROLLO is remote development only — not a testing substitute. Records
  evidence in feature_list.json and docs/claude-progress.md. Use after
  backend-supabase-write and backend-documenter.
---

# Backend Tester — Peajes / Transporte

Verifies backend changes only. Does not implement features.

Use **after**:

1. `backend-supabase-write`
2. `backend-documenter`

A backend feature **cannot** be `passing` without verification evidence.

## Environment contract

```text
Supabase CLI (local)  =  testing / verification (REQUIRED)
DESARROLLO (remote)   =  development remote (optional app check)
```

| Environment | Project ref | This skill |
|-------------|-------------|------------|
| **Supabase CLI** | Docker + CLI → `http://127.0.0.1:54321` | **Yes** — schema rebuild, pgTAP, Edge serve |
| **DESARROLLO** | `kfffigvyvtzyczeiadxh` | App/API smoke only after CLI green; never as SQL test source of truth |

**No** staging/prod split. **Never** reuse OrdenCompra refs `edxoqshrzdqpnldktpzy` / `uurlssweuhshbwpxxatw`.

See [../backend-supabase-write/entornos.md](../backend-supabase-write/entornos.md).

## Scope

| In scope | Out of scope |
|----------|--------------|
| `npx supabase db reset --local --no-seed` | Treating DESARROLLO as SQL testing |
| `npx supabase test db` (pgTAP) | OrdenCompra project refs |
| RLS / permission scenarios on CLI | Replacing write/documenter skills |
| Angular `.spec.ts` for peajes services | Marking `passing` without evidence |
| Evidence in `feature_list.json` + `claude-progress.md` | Secrets in docs |

## CLI setup (from `ibarra-app/`)

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db
```

If checking DESARROLLO link:

```powershell
Get-Content supabase\.temp\project-ref
# expected: kfffigvyvtzyczeiadxh
```

Never `db reset --linked` against DESARROLLO.

## Evidence format

Record in `feature_list.json` → `evidence`:

- command executed
- exit code / result summary
- date

Also append a short note to `docs/claude-progress.md`.

## Language

Skill instructions: English. Evidence and progress notes: Spanish acceptable (project convention).
