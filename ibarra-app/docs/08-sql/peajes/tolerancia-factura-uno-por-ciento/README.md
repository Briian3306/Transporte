# Tolerancia factura vs pasadas — ±1% del subtotal

## Summary

La validación `peajes_validar_factura_pasadas` deja de usar una tolerancia fija de $5 y adopta **1% del subtotal** (`importe_sin_iva`) cuando `p_tolerancia` es NULL. Un `p_tolerancia` explícito sigue siendo override absoluto.

## Workflow Context

- Canonical workflow: Supabase CLI (testing) → DESARROLLO (`kfffigvyvtzyczeiadxh`)
- Testing: CLI local only
- DESARROLLO push: solo con autorización explícita del usuario

## Affected Objects

- Functions / RPC: `public.peajes_validar_factura_pasadas`
- Angular: `Paso7FacturaComponent`, `Paso8ValidacionComponent`, `PeajesCargaMockService`, `PeajesCargaSupabaseService` (comentario)
- Docs: `validacion-carga.md`, `wizard.md`, `auditoria-y-rpcs.md`

## Migration

```text
supabase/migrations/20260805113339_peajes_tolerancia_factura_uno_por_ciento.sql
```

## SQL Commands

```sql
-- Default: v_tol := COALESCE(p_tolerancia, abs(p_importe_sin_iva) * 0.01);
-- Response JSON: suma_pasadas, importe_sin_iva, diferencia, tolerancia, dentro_tolerancia, valido
```

## Local Verification

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

## Notes

- No modifica `peajes_tolerancia_importe()` (centavo RN-11 por fila).
- Caso AUSOL 560832.27 vs 560832.29 ($0.02) sigue válido (~$5608 de tolerancia).
