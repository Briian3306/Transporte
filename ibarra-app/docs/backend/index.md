# Backend — ibarra-app

## Summary

Documentación canónica del backend Supabase del módulo Peajes: catálogo RPC, detalle por dominio, workflow CLI→DESARROLLO y estrategia de testing. Fuente SQL: `supabase/migrations/`. **No usar `docs/08-sql/`.**

## Index

- [Summary](#summary)
- [Navegación](#navegación)
- [Entornos](#entornos)
- [Referencias](#referencias)

## Navegación

| Sección | Contenido |
|---------|-----------|
| [functions/](./functions/index.md) | Catálogo de RPCs Postgres |
| [functions/edge/](./functions/edge/index.md) | Edge Functions (ninguna en MVP Peajes) |
| [peajes/](./peajes/index.md) | Detalle de dominio Peajes |
| [supabase/](./supabase/index.md) | Workflow CLI, testing, transversal |

## Entornos

| Entorno | Rol | Ref |
|---------|-----|-----|
| Supabase CLI (local) | Testing / verificación | Docker + CLI `http://127.0.0.1:54321` |
| DESARROLLO | Remoto de desarrollo | `kfffigvyvtzyczeiadxh` |

No hay staging/prod separados en este flujo. Push a DESARROLLO solo con autorización explícita. Nunca `db reset --linked`.

## Referencias

- PRD: [docs/plan/peaje-prd-short.md.md](../plan/peaje-prd-short.md.md)
- Módulo UI: [docs/modulos/peajes.md](../modulos/peajes.md)
- Modelo tablas: [docs/06-tablas/peajes/](../06-tablas/peajes/INDEX.md)
- Features: `feature_list.json`
- Skills: `backend-documenter`, `backend-supabase-write`, `backend-tester`

---

> Última actualización: agosto 2026
