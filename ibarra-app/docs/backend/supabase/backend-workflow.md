# Backend workflow — Supabase CLI → DESARROLLO

## Summary

Flujo canónico para cambios SQL del módulo Peajes. Fuente de verdad de identidad: archivos en `supabase/migrations/`. Testing solo en CLI local; DESARROLLO es remoto de desarrollo. MCP no despliega schema.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Notes](#notes)

## Purpose

Evitar resets remotos y refs de otros productos; documentar el orden de trabajo.

## Business Logic

1. Crear migración: `npx supabase migration new nombre` desde `ibarra-app/` (nunca inventar el timestamp).
2. Editar `supabase/migrations/<timestamp>_….sql`.
3. Verificar local:

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
pnpm seed:local
```

`--no-seed` es solo schema. `pnpm seed:local` restaura Auth/pasadas/tarifario v2.

4. Documentar RPC/lógica en `docs/backend/` (skill `backend-documenter`). **No** `docs/08-sql/`.
5. DESARROLLO solo con autorización explícita, vía `db push --linked` (el ID remoto debe ser el filename). Si el historial está desfasado, alinear primero con [historial-migraciones.md](../../../.agents/skills/backend-supabase-write/historial-migraciones.md):

```powershell
npx supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Si `db push` da **403**: detener. No usar MCP `apply_migration` ni `execute_sql` DDL. Investigar `npx supabase projects list` / `login` / `link`. Emergencia MCP solo con OK explícito y `migration repair` en la misma sesión.

Tras el push, repetir el reset `--no-seed` + `pnpm seed:local` en el CLI local.

## Notes

- Prohibido: `db reset --linked`, refs OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`), MCP como fallback de deploy, timestamps inventados.
- MCP permitido: `list_migrations`, tablas, SELECT, advisors, investigar drift.
- Auth local y Kong: [cli-local-credenciales-y-permisos.md](../../05-configuracion/cli-local-credenciales-y-permisos.md).
- Historial MCP vs CLI (ids distintos): skill [historial-migraciones.md](../../../.agents/skills/backend-supabase-write/historial-migraciones.md).

---

> Última actualización: septiembre 2026
