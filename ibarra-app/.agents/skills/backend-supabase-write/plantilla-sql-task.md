# Plantilla — SQL task (`docs/08-sql/{task}/`)

Crear un archivo por cambio backend, por ejemplo `docs/08-sql/{task}/{descripcion-corta}.md`.

---

```markdown
# Task Title

## Summary

Brief explanation of the backend change.

## Workflow Context

- Canonical workflow: Local CLI -> DEV -> PROD
- Workflow doc: `docs/backend/supabase/backend-workflow.md`
- Testing doc: `docs/backend/supabase/backend-testing.md`
- DEV project ref: `edxoqshrzdqpnldktpzy`
- PROD project ref: `kfffigvyvtzyczeiadxh`
- Production authorization: required explicitly from the user before linking, pushing, deploying, or applying any change to PROD

## Affected Objects

- Tables:
- Functions:
- RPC:
- Views:
- Triggers:
- Policies:
- RLS:
- Angular services:

## Migration

```text
supabase/migrations/<timestamp>_<name>.sql
```

## SQL Commands

```sql
-- Exact SQL commands included in the migration or required to reproduce the change
```

## Execution Notes

Explain the order of execution and any important considerations.

## Local Verification

```powershell
pnpm supabase db reset --local --no-seed
pnpm supabase test db
```

## DEV Verification

```powershell
pnpm supabase link --project-ref edxoqshrzdqpnldktpzy
Get-Content supabase\.temp\project-ref
pnpm supabase db push --linked --dry-run
pnpm supabase db push --linked
```

Record app/API validation against:

```text
https://edxoqshrzdqpnldktpzy.supabase.co
```

## Main Database Instructions

Explain how these commands should be applied to production only after Local and DEV passed and the user explicitly authorized production.

```powershell
pnpm supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
pnpm supabase db push --linked --dry-run
pnpm supabase db push --linked
```

Never run `pnpm supabase db reset --linked` on production. Never run the production commands above unless the user explicitly authorized them in the current conversation.
```

---

## Reglas del archivo

- El bloque `SQL Commands` debe ser copiable tal cual para ejecutar en `main`.
- Ordenar comandos en el orden real de ejecución.
- Si hay dependencias (tabla antes de FK, función antes de grant), documentarlas en Execution Notes.
- Enlazar feature: `feature_list.json` → `id` = carpeta `{task}` cuando sea posible.
- Documentar la migración asociada en `supabase/migrations/`.
- Documentar validación local y DEV antes de instrucciones de producción.
- Indicar que producción requiere autorización explícita del usuario.
- No incluir secrets, Bearer tokens, `service_role` ni datos sensibles.
- Recordar que `db push` aplica migraciones, no `supabase/seed.sql`.
