# Backend workflow — Supabase CLI → DESARROLLO

## Summary

Flujo canónico para cambios SQL del módulo Peajes. Testing solo en CLI local; DESARROLLO es remoto de desarrollo.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Notes](#notes)

## Purpose

Evitar resets remotos y refs de otros productos; documentar el orden de trabajo.

## Business Logic

1. Crear migración: `npx supabase migration new nombre` desde `ibarra-app/`.
2. Editar `supabase/migrations/<timestamp>_….sql`.
3. Verificar local:

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

4. Documentar RPC/lógica en `docs/backend/` (skill `backend-documenter`). **No** `docs/08-sql/`.
5. DESARROLLO solo con autorización explícita:

```powershell
npx supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

## Notes

- Prohibido: `db reset --linked`, refs OrdenCompra (`edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`).
- Auth local: ver [cli-local-credenciales-y-permisos.md](../../05-configuracion/cli-local-credenciales-y-permisos.md).

---

> Última actualización: agosto 2026
