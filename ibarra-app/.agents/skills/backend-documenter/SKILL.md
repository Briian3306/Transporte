---
name: backend-documenter
description: >-
  Creates and maintains backend documentation under docs/backend for Supabase RPC
  functions, Edge Functions, tables, triggers, RLS policies, validations, and
  business logic by module (pedidos, ordenes-compra, productos, proveedores, api,
  supabase). Use when documenting backend logic, database schema, Supabase
  functions, or when the user asks for backend docs, RPC docs, or module backend
  reference. Skill instructions are in English; all docs/backend output is in Spanish.
---

# Backend Documenter

Documents orden_compra_ibarra backend logic under `docs/backend/`. Do not modify
production code unless explicitly requested. When documentation depends on code
behavior, inspect the related files before writing.

## Language rule

| Artifact | Language |
|----------|----------|
| This skill (`SKILL.md`, `estructura.md`, `plantilla.md` instructions) | **English** |
| All files under `docs/backend/` | **Spanish** (technical Spanish, clear and concise) |

When writing or updating `docs/backend/`:

- Write headings, summaries, tables, and notes in **Spanish**.
- Keep section slugs in English only where the template requires it (`Summary`, `Purpose`, `Business Logic`, `Testing`, etc.) for consistency across backend docs.
- Do not mix English prose inside Spanish documentation unless quoting code, SQL, identifiers, or API names.

## Responsibilities

- Create or update `docs/backend/` documentation.
- Document Supabase RPC functions, Edge Functions, tables, triggers, policies, validations, and business logic.
- Document backend logic by module.
- Keep documentation clear, structured, and easy to maintain.
- When documentation depends on code behavior, inspect the related files before writing.
- **Do not run tests.** Document the **Testing** section (expected verification method, test paths, scenarios). Execution is **`backend-tester`** only.

## Before writing

1. Read [documentacion-proyecto](../documentacion-proyecto/SKILL.md) for index, linking, and minimal-update rules.
2. Read [supabase-postgres-best-practices](../supabase-postgres-best-practices/SKILL.md) for SQL, RLS, indexes, and performance context.
3. Identify real sources before documenting:

| Artifact | Typical locations |
|----------|-------------------|
| RPC / SQL | `supabase/functions/*.sql`, `sql/`, `docs/08-sql/{task}/`, `docs/08 - SQLs/` |
| Edge Functions | `supabase/functions/*/index.ts` |
| RLS / policies | `sql/rls_*.sql` |
| Angular services (context) | `src/app/features/{modulo}/services/` |
| DB types | `src/app/core/models/database.type.ts` |

4. Search existing docs in `docs/backend/`, `docs/08-sql/`, and `docs/08 - SQLs/`. One idea, one canonical location.
5. Omit empty sections with `—` or remove them when not applicable.

## Structure

See full map in [estructura.md](estructura.md). Base tree:

```text
docs/backend/
├── index.md
├── functions/
│   ├── index.md
│   └── edge/
│       └── index.md
├── pedidos/
├── ordenes-compra/
├── productos/
├── proveedores/
├── api/
└── supabase/
```

## Workflow

### 1. Classify the artifact

| Type | Canonical destination |
|------|----------------------|
| Postgres RPC summary | `docs/backend/functions/` + detail in module |
| Edge Function (Deno) | `docs/backend/functions/edge/` |
| Business logic by domain | `docs/backend/{modulo}/` |
| HTTP endpoints / contracts | `docs/backend/api/` |
| Cross-cutting queries, RLS, validations | `docs/backend/supabase/` |

### 2. Inspect code

- Read full SQL/RPC: parameters, return value, side effects, transactions.
- Read Edge Function: auth, CORS, env vars, payload, errors.
- Read RLS policies: roles, conditions, affected tables.
- Cross-check with `database.type.ts` and services that call the RPC.

### 3. Create or update the document

Use template in [plantilla.md](plantilla.md). Write content in **Spanish**.

Each file includes: `Summary`, `Index`, `Purpose`, `Business Logic`, `Relations`, `Tables`, `Functions`, `Policies`, `Validations`, `Testing`, `Notes`.

**Testing section (document only):** describe which verification applies (DB test, RLS scenario, Angular spec), expected file paths, and scenarios to cover. Set status to `pendiente` and leave evidence empty. Do not run `supabase test db`, SQL checks, or `ng test`. After handoff, **`backend-tester`** executes verification and updates **Testing** with commands, outputs, and evidence links.

Rules:

- Summary in `functions/index.md`: one row per RPC (name, module, purpose, link to detail).
- Deep detail in the module folder (`pedidos/`, `ordenes-compra/`, etc.).
- Link frontend module: `docs/modulos/{modulo}/` without duplicating UI flows.
- Update `docs/backend/index.md` and the affected folder `index.md`.

### 4. Minimal update

| Change | Update |
|--------|--------|
| New RPC | `functions/index.md` + module + `supabase/` if RLS applies |
| New Edge Function | `functions/edge/index.md` + consuming module |
| RLS policy change | module + `supabase/` |
| New API endpoint | `api/` + module |

Do not rewrite neighboring docs if behavior did not change.

## Required indexes

When adding a document:

1. Update the immediate folder `index.md`.
2. Update [docs/backend/index.md](../../../docs/backend/index.md).
3. If cross-cutting flows are affected, link from [docs/INDEX.md](../../../docs/INDEX.md) (backend section).

## When finished

When documentation is created or updated:

1. Verify links, code paths, and no duplication with `docs/08 - SQLs/` or `docs/modulos/`.
2. Confirm all new or changed prose in `docs/backend/` is in **Spanish**.
3. Invoke skill **`backend-tester`** to execute verification and fill the **Testing** section (commands, outputs, evidence).
4. If `backend-tester` is not available, leave **Testing** as `pendiente` with concrete scenarios in Spanish — do not mark verification as passed.

## References

- Structure and paths: [estructura.md](estructura.md)
- Document template (Spanish output): [plantilla.md](plantilla.md)
- Postgres / Supabase: [supabase-postgres-best-practices](../supabase-postgres-best-practices/SKILL.md)
- General repo docs: [documentacion-proyecto](../documentacion-proyecto/SKILL.md)
- Backend verification: [backend-tester](../backend-tester/SKILL.md)
