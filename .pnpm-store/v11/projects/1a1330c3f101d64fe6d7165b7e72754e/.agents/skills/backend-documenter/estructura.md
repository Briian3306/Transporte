# `docs/backend/` structure

Official map for backend documentation. One idea, one canonical location.

**Output language:** all files created under `docs/backend/` must be written in **Spanish**.

## Tree

```text
docs/backend/
├── index.md                 # General backend index
├── functions/               # Postgres RPC summary (Supabase)
│   ├── index.md
│   └── edge/                # Edge Functions (Deno)
│       └── index.md
├── peajes/                  # Domain docs + RPC detail
├── api/                     # Routes, endpoints, request/response (if any)
└── supabase/                # Queries, RLS, validations, CLI workflow, testing
    ├── index.md
    ├── backend-workflow.md
    └── backend-testing.md
```

## Purpose by folder

| Folder | Content | Do not document here |
|--------|---------|----------------------|
| `index.md` | Backend entry; links to modules and catalogs | Detail of a single RPC |
| `functions/` | RPC catalog summary: name, params, module, link | Extensive business logic |
| `functions/edge/` | Edge Functions: trigger, auth, env, I/O | Pure SQL RPCs |
| `peajes/` | Domain purpose, backend flows, module RPCs | Angular components |
| `api/` | HTTP contracts (Edge or REST) | Generic RLS policies |
| `supabase/` | Cross-cutting: RLS catalog, auth, CLI workflow (`backend-workflow.md`), testing strategy (`backend-testing.md`) | Single-module business flows |

## Supported modules

| Module | Source code | Typical RPC / SQL |
|--------|-------------|-------------------|
| `peajes/` | `src/app/components/peajes/`, `supabase/migrations/*peajes*` | confirmar_carga, duplicados, plantillas, pasadas |
| `api/` | `supabase/functions/*/index.ts` | HTTP endpoints (none for Peajes MVP) |
| `supabase/` | `supabase/migrations/` | RLS, triggers, shared helpers |

Do not duplicate content between `docs/modulos/peajes.md` and `docs/backend/peajes/`. **Do not use `docs/08-sql/`.**

## Code sources to inspect

```text
supabase/migrations/         # SQL migrations (source of truth)
supabase/functions/          # Edge Functions (Deno) if any
src/app/components/peajes/**/services/  # RPC consumption from Angular
```

## Correlation with other docs

| Backend | Frontend / cross-cutting |
|---------|--------------------------|
| `docs/backend/peajes/` | `docs/modulos/peajes.md`, `docs/06-tablas/peajes/` |
| `docs/backend/supabase/` | skill `supabase-postgres-best-practices`; migrations in `supabase/migrations/` |
| `docs/backend/functions/` | Quick entry; detail in `docs/backend/peajes/` |

**Do not use `docs/08-sql/`.** Link both ways; do not copy full paragraphs across folders.

## Naming conventions

- Folders: `kebab-case`
- Module files: `{tema}.md` or `{nombre-funcion-rpc}.md`
- Indexes: `index.md` in each folder with a document table

## Index chain

```text
docs/INDEX.md
  └── docs/backend/index.md
        └── docs/backend/pedidos/index.md
              └── docs/backend/pedidos/aprobar-pedido-item.md
```

When adding a document, update the parent index.
