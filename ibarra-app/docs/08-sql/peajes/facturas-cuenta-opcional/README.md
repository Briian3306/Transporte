# Facturas — cuenta opcional

## Summary

`facturas.cuenta` deja de ser `NOT NULL`. El wizard Paso 7 y `peajes_confirmar_carga` aceptan factura sin cuenta (vacío → NULL).

## Workflow Context

- Canonical workflow: Supabase CLI (testing) → DESARROLLO (`kfffigvyvtzyczeiadxh`)
- Testing: CLI local only
- DESARROLLO push: solo con autorización explícita del usuario

## Affected Objects

- Tables: `public.facturas` (`cuenta` nullable)
- Functions: `public.peajes_confirmar_carga` (NULLIF vacío → NULL)
- Angular: `Paso7FacturaComponent`, `Factura.cuenta: string | null`, `facturaComoPersistible`

## Migration

```text
supabase/migrations/20260804141122_peajes_facturas_cuenta_nullable.sql
```

## SQL Commands

```sql
ALTER TABLE public.facturas
  ALTER COLUMN cuenta DROP NOT NULL;

-- peajes_confirmar_carga: v_cuenta := NULLIF(trim(...), '') en INSERT/UPDATE
```

## Local Verification

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

## Referencias

- Docs tabla: `docs/06-tablas/peajes/facturas-pasadas.md`
- UI: `paso7-factura`

---

> 2026-08-04
