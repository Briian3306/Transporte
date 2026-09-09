# Testing Transformaciones — Reference

Concrete suite sketches for ibarra-app. Prefer Karma/Jasmine APIs already used in `motor.spec.ts` / `builder.spec.ts`.

## Critical I/O matrix (both providers)

| # | Feature | Demo expected | Autopistas expected | Suite |
|---|---------|---------------|---------------------|-------|
| 1 | FECHA_HORA row1 | `2026-06-25 20:50:05` | `2026-07-27 12:14:33` | motor / e2e |
| 2 | Hora pad | `85557` → `08:55:57` | N/A (already `HH:MM:SS`) | FORMATEAR_FECHA_HORA |
| 3 | Patente dirty | `" ad-625-qb "` → `AD625QB` | same pipeline on `PATENTE` | expander |
| 4 | Pase | `DISPOSITIVON` → text | `DISPOSITIVO` → text | strategy |
| 5 | Estación code | `3` → catalog | `VAR`+`02C` → `VAR-02C` | COMBINAR_COLUMNAS |
| 6 | AR number | N/A | `19.985,09` → `19985.09` | CONVERTIR_NUMERO |
| 7 | Importe neto | `17400-5220=12180` | `= PRECIO` | CALCULAR / copy |
| 8 | Invoice sum | `102060` | `132940.19` | validation |
| 9 | RN-20 unknown code | throws | throws | registry |
| 10 | RN-18 duplicate orden | error | error | builder |

## Strategy tests (extend `motor.spec.ts` or colocate)

Use `createDefaultRegistry()` and `StrategyContext`:

```typescript
const registry = createDefaultRegistry();
const s = registry.obtener('BORRAR_ESPACIOS');
const ctx = {
  fila: { DOMINIO: '  AD625QB  ' },
  resultado: {},
  columnaOrigen: 'DOMINIO',
  columnaDestino: 'PATENTE_ID',
  parametros: null,
};
expect(s.ejecutar(ctx)).toBe('AD625QB');
```

Demo pad via `FORMATEAR_FECHA_HORA` (not a separate pad code):

```typescript
// HORA 85557 → FECHA_HORA … 08:55:57 (see motor.spec §21 / ejemplo MVP)
```

Autopistas join:

```typescript
// COMBINAR_COLUMNAS params: columnas ['ESTACION','VIA'], separador '-'
// fila { ESTACION: 'VAR', VIA: '02C' } → 'VAR-02C'
```

## Builder / expander

Existing: `builder.spec.ts`, `motor.spec.ts` (`expandirAlgoritmo` / `construirPipeline`).

Assert effective orden uses `cfg.orden * 1000 + paso.orden` (not `20.1` floats).

## Paso3 TestBed sketch

File: `wizard/paso3-transformaciones/paso3-transformaciones.component.spec.ts`

- Spy `PeajesWizardStateService.snapshot` with Demo columns + 3 preview rows
- Assert `tieneColumnasMvp`
- Assert preview helpers for row1 FECHA_HORA / IMPORTE_NETO using fixture transformers or motor

## Validation

- `paso8-validacion.component.spec.ts` — sum vs factura
- SQL RN-16 — already in `supabase/tests/peajes_f01_test.sql`; do not duplicate in Angular unless testing client-side pre-check

## Autopistas fixture (to add)

Mirror `mvp-ejemplo.fixture.ts`:

- `AU_COLUMNAS`, first 10 rows from `docs/plan/csv/autopistas_urbanas.csv`
- Invoice mock `132940.19`
- Transform specs aligned with `ejemplo-autopistas-urbanas-pasadas.md`

## Anti-patterns

- Inventing Jest matchers / `toThrowError` Jest-only styles when local specs use Jasmine (`toThrowError` exists in Jasmine too; prefer `toThrowError(/no registrado/i)` like `motor.spec.ts`)
- Testing `RELLENAR_CEROS_IZQUIERDA` as registry code
- Hitting DESARROLLO for unit tests
- Committing real PII dumps as fixtures
