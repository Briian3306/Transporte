# Plantilla — cambio SQL / RPC (`docs/backend/peajes/`)

Documentar cada cambio backend en **`docs/backend/`** (no usar `docs/08-sql/`).

- Catálogo RPC: `docs/backend/functions/index.md`
- Detalle por dominio: `docs/backend/peajes/{nombre}.md`
- Workflow / testing: `docs/backend/supabase/`

Usar la plantilla de [backend-documenter/plantilla.md](../backend-documenter/plantilla.md). Resumen mínimo si el cambio es pequeño:

---

```markdown
# {Título del cambio}

## Summary

{Qué cambió y por qué.}

## Workflow Context

- Canonical workflow: Supabase CLI (testing) → DESARROLLO (`kfffigvyvtzyczeiadxh`)
- Workflow: `docs/backend/supabase/backend-workflow.md`
- Testing: `docs/backend/supabase/backend-testing.md`
- DESARROLLO push: solo con autorización explícita del usuario

## Affected Objects

- Tables:
- Functions / RPC:
- Views:
- Policies / RLS:
- Angular services:

## Migration

```text
supabase/migrations/<timestamp>_<name>.sql
```

## Local Verification

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

## Notes

- Invocar `backend-documenter` para actualizar catálogo/detalle y luego `backend-tester`.
```

---

## Reglas

- Una idea, una ubicación canónica bajo `docs/backend/`.
- Enlazar `feature_list.json` → `id` cuando corresponda.
- No incluir secrets, Bearer tokens ni `service_role`.
- Nunca `db reset --linked` sobre DESARROLLO.
