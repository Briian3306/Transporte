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
├── pedidos/                 # General docs + function detail
├── ordenes-compra/
├── productos/
├── proveedores/
├── api/                     # Routes, endpoints, request/response
└── supabase/                # Queries, RLS, validations, CLI workflow, testing
    ├── index.md             # Transversal index (RLS catalog, links)
    ├── backend-workflow.md  # Supabase CLI: migrations, seeds, deploy
    ├── backend-testing.md   # pgTAP, RLS scenarios, Edge Function tests
    └── auth-roles-globales.md
```

## Purpose by folder

| Folder | Content | Do not document here |
|--------|---------|----------------------|
| `index.md` | Backend entry; links to modules and catalogs | Detail of a single RPC |
| `functions/` | RPC catalog summary: name, params, module, link | Extensive business logic |
| `functions/edge/` | Edge Functions: trigger, auth, env, I/O | Pure SQL RPCs |
| `{modulo}/` | Domain purpose, backend flows, module RPCs | Angular components |
| `api/` | HTTP contracts (Edge or REST) | Generic RLS policies |
| `supabase/` | Cross-cutting: RLS catalog, auth, CLI workflow (`backend-workflow.md`), testing strategy (`backend-testing.md`) | Single-module business flows |

## Supported modules

| Module | Source code | Typical RPC / SQL |
|--------|-------------|-------------------|
| `pedidos/` | `src/app/features/pedidos/` | approval, items, notifications |
| `ordenes-compra/` | `src/app/features/orden-compra/` | OC generation, kanban stats, CSV export |
| `productos/` | `src/app/features/productos/` | catalog, categories |
| `proveedores/` | `src/app/features/proveedores/` | supplier, payment terms |
| `api/` | `supabase/functions/*/index.ts` | HTTP endpoints |
| `supabase/` | `sql/`, `supabase/functions/*.sql` | RLS, triggers, shared functions |

> Facturas and other domains: document under the closest backend module or extend the tree only with explicit agreement; do not duplicate content between `docs/modulos/` and `docs/backend/`.

## Code sources to inspect

```text
supabase/functions/          # Edge Functions + some RPC .sql
sql/                         # RLS, views, standalone functions
docs/08-sql/{task}/          # Reproducible SQL tasks (dev → main)
docs/08 - SQLs/              # Versioned SQL scripts
src/app/core/models/         # Types aligned with tables
src/app/features/*/services/ # RPC consumption from Angular
```

## Correlation with other docs

| Backend | Frontend / cross-cutting |
|---------|--------------------------|
| `docs/backend/pedidos/` | `docs/modulos/pedidos/` |
| `docs/backend/ordenes-compra/` | `docs/modulos/ordenes-compra/` |
| `docs/backend/supabase/` | `docs/08 - SQLs/`, `docs/08-sql/`, skill `supabase-postgres-best-practices` |
| `docs/backend/functions/` | Quick entry; detail in module |

Link both ways; do not copy full paragraphs across folders.

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
