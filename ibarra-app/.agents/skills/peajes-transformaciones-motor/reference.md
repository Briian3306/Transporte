# Transformation Engine — Reference

Detailed architecture adapted to **ibarra-app** Peajes. Read [SKILL.md](SKILL.md) first.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — PRESENTATION (Angular)                           │
│  • Paso3TransformacionesComponent                           │
│  • Preview ≤10 rows                                         │
│  • MVP_TRANSFORM_SPECS (Demo adapter fixture)               │
└──────────────────────┬──────────────────────────────────────┘
                       │ PeajesMotorTransformacionService
┌──────────────────────▼──────────────────────────────────────┐
│  LAYER 2 — ORCHESTRATION                                    │
│  • PipelineBuilder                                          │
│  • StrategyRegistry + ESTRATEGIAS_ATOMICAS                  │
│  • expandirAlgoritmo / construirPipeline / aplicarPipeline  │
└──────────────────────┬──────────────────────────────────────┘
                       │ services / RPC
┌──────────────────────▼──────────────────────────────────────┐
│  LAYER 1 — PERSISTENCE                                      │
│  • plantillas_configuracion / configuraciones_plantilla     │
│  • algoritmos_combinados / algoritmo_combinado_pasos        │
│  • peajes_algoritmos_catalogo                               │
│  • pasadas (+ estacion_id; peaje via estación)              │
└─────────────────────────────────────────────────────────────┘
```

## Strategy pattern

```
StrategyRegistry
  ├── BORRAR_ESPACIOS
  ├── ELIMINAR_GUIONES
  ├── CONVERTIR_MAYUSCULAS
  ├── COMBINAR_COLUMNAS
  ├── FORMATEAR_FECHA_HORA
  ├── CALCULAR_IMPORTE_NETO
  ├── CONVERTIR_NUMERO / CONVERTIR_TEXTO
  ├── ASIGNAR_VALOR
  └── COPIAR_COLUMNA
         │ resolve(codigo)
         ▼
  TransformStrategy.ejecutar(StrategyContext)
```

Files:

- `plantillas/motor/strategy-registry.ts`
- `plantillas/motor/strategies/estrategias-atomicas.ts`
- `plantillas/motor/strategy.types.ts`

Register new atomics in `ESTRATEGIAS_ATOMICAS`, `ALGORITMO_CODIGOS`, and `peajes_algoritmos_catalogo`.

## Builder pattern

Conceptual fluent API (product uses `PipelineBuilder`):

```typescript
const pasos = new PipelineBuilder()
  .conConfiguraciones(configs)
  .conAlgoritmos(algoritmos)
  .build();
```

UI component `PlantillaBuilderComponent` builds persisted `ConfiguracionPlantilla[]`; the motor builder expands them for execution.

Validation before run:

- RN-18: no duplicate `orden`
- RN-20 / RN-31-style: no unknown `algoritmo_codigo`, no missing `algoritmo_combinado_id`
- Required source columns present in file

## Adapter pattern

Provider Excel → canonical Pasada columns:

```
FECHA + HORA     → FECHA_HORA
DOMINIO          → PATENTE_ID (normalized)
DISPOSITIVON     → PASE_ID
TARIFA/BONIF.    → PRECIO / BONIFICACION / IMPORTE_NETO
—                → QUANTITY = 1
ESTACION         → mapped in Paso 5 (catálogo)
```

Demo reference: `wizard/fixtures/mvp-ejemplo.fixture.ts` → `MVP_TRANSFORM_SPECS`.

### IProviderAdapter (target)

```typescript
interface IProviderAdapter {
  readonly codigo: string;
  readonly nombre: string;
  readonly columnasEsperadas: string[];
  readonly mapeoSemantico: Map<string, string>;
  readonly transformacionesDefault: Array<{
    nombreColumna: string;
    orden: number;
    algoritmoCombinado?: string;
    algoritmo_codigo?: string;
    parametros?: Record<string, unknown>;
    obligatoria?: boolean;
  }>;
  detectarCompatibilidad(columnasDetectadas: string[]): {
    ok: boolean;
    faltantes: string[];
    extra: string[];
  };
  sugerirMapeo(columna: string): string | null;
}
```

### Demo defaults (PRD §21)

| Target | Orden | Combined / atomic | Params |
|--------|-------|-------------------|--------|
| FECHA_HORA | 10 | FORMATEAR_FECHA_HORA | columnas FECHA, HORA |
| PATENTE_ID | 20 | NORMALIZAR_PATENTE → 3 atomics | — |
| PASE_ID | 30 | CONVERTIR_TEXTO / COPIAR | DISPOSITIVON |
| IMPORTE_NETO | 40 | CALCULAR_IMPORTE_NETO | TARIFA, BONIFICACION |
| QUANTITY | 50 | ASIGNAR_VALOR | `{ valor: 1 }` |

## Combined algorithms

Stored in `algoritmos_combinados` + `algoritmo_combinado_pasos`; referenced by `configuraciones_plantilla.algoritmo_combinado_id`.

Example `NORMALIZAR_PATENTE`:

```json
{
  "pasos": [
    { "orden": 1, "algoritmo_codigo": "BORRAR_ESPACIOS", "parametros": {} },
    { "orden": 2, "algoritmo_codigo": "ELIMINAR_GUIONES", "parametros": {} },
    { "orden": 3, "algoritmo_codigo": "CONVERTIR_MAYUSCULAS", "parametros": {} }
  ]
}
```

Expansion (`PipelineBuilder`): config `orden=20` → effective orders `20001`, `20002`, `20003`.

- Expanded pipeline = execution + audit trail (RF-32).
- Combined id = reuse / persistence (RF-29).

## Semantic type inference (heuristic)

```typescript
function inferirTipoSemantico(nombreColumna: string, muestra: unknown[]): string {
  const nombre = nombreColumna.toUpperCase();
  if (nombre.includes('FECHA') && nombre.includes('HORA')) return 'DATETIME';
  if (nombre === 'FECHA' || nombre === 'HORA') return 'DATETIME_COMPONENT';
  if (nombre.includes('DOMINIO') || nombre.includes('PATENTE')) return 'PATENTE';
  if (nombre.includes('ESTACION')) return 'ESTACION';
  if (nombre.includes('TARIFA') || nombre.includes('PRECIO')) return 'MONEDA';
  if (nombre.includes('BONIFICACION')) return 'MONEDA';
  if (nombre.includes('DISPOSITIVO') || nombre.includes('PASE')) return 'DISPOSITIVO';
  const muestraStr = muestra.filter((v) => v != null).map(String);
  if (muestraStr.every((v) => /^\d{5,6}$/.test(v))) return 'TIME_RAW';
  if (muestraStr.every((v) => /^[A-Z0-9]{6,7}$/i.test(v))) return 'PATENTE';
  return 'TEXTO_GENERICO';
}
```

Prefer adapter dictionary over heuristics when available.

## Frontend integration notes

```typescript
// paso3-transformaciones.component.ts (existing pattern)
private readonly motor = inject(PeajesMotorTransformacionService);
readonly specs = MVP_TRANSFORM_SPECS;

aplicarSinConfig(): void {
  // Prefer motor when plantilla configs exist:
  // this.filas = this.motor.aplicarPipeline(preview, configs, algoritmos);
  // Demo fixture still drives visual specs until adapter extraction.
}
```

## Backend blueprint (Edge Function)

Optional for large files (RNF-03). Not required for MVP if RPC + client pipeline cover §21.

```typescript
// Conceptual — supabase/functions/process-peajes/index.ts
// 1. Load plantilla + configs + combined algorithms
// 2. PipelineBuilder.validar path via shared TS or RPC
// 3. Per-row StrategyRegistry execution
// 4. Dedup RN-16 then insert pasadas
// 5. Return { procesadas, errores: RechazoDetalle[] }
```

SQL already in repo:

- Dedup UK on `pasadas`
- UK on configuraciones `(plantilla_id, nombre_columna, orden)`
- Catalog FK on `algoritmo_codigo`

## Error detail (RN-24)

Align with `ErrorValidacionPasada` / future `RechazoDetalle`:

| Field | Meaning |
|-------|---------|
| fila | Source row index |
| columna | Source column |
| valor | Raw value |
| motivo | Human-readable (ES) |

Do not expose stack traces, SQL, or raw jsonb internals in UI.

## New provider checklist

1. Create adapter (or extend fixture).
2. Register adapter.
3. New atomics → registry + catalog + types.
4. Combined algorithms in DB if reusable.
5. Default plantilla via builder validation.
6. `detectarCompatibilidad` (RF-13).
7. Paso 3 preview + `motor.verify.ts` / e2e-prd21.

## Rules matrix

| Rule | Text | Enforcement |
|------|------|-------------|
| RN-16 | Dedup key pase+fecha_hora+estación+patente | `pasadas` UNIQUE |
| RN-18 | Ascending unique `orden` | Builder + `validarDefinicionPlantilla` + SQL UK |
| RN-20 | No code in jsonb; registered only | `StrategyRegistry` |
| RN-21 | Compatibility before run | Adapter / RF-13 |
| RN-23 | Global vs empresa scope | `empresa_id` / `__global__` |
| RN-24 | Rich rejection detail | Error models / UI |
| RN-25 | Transactional plantilla overwrite | Peajes RPC |
| RF-13 | Template vs file columns | `validarDefinicionPlantilla` |
| RF-29 | Reusable combined algorithms | `algoritmos_combinados` |
| RF-30 | Expand combined before run | `expandirAlgoritmo` / Builder |
| RF-32 | Audit load | `registros_carga_peajes` |

## Worked examples (plan docs)

| Provider | Doc | Adapter idea | Notable algorithm choice |
|----------|-----|--------------|--------------------------|
| Demo MVP | `docs/plan/ejemplo-mvp-procesamiento-pasadas.md` | `PROVEEDOR_DEMO` | `FORMATEAR_FECHA_HORA` + `CALCULAR_IMPORTE_NETO` |
| Autopistas Urbanas | `docs/plan/ejemplo-autopistas-urbanas-pasadas.md` | `AUTOPISTAS_URBANAS` | `COMBINAR_COLUMNAS` for date/time **and** `ESTACION-VIA`; `CONVERTIR_NUMERO` only for `TARIFA` |

Same generic patente pipeline in both: combined `NORMALIZAR_PATENTE` → `BORRAR_ESPACIOS` → `ELIMINAR_GUIONES` → `CONVERTIR_MAYUSCULAS`.

## Related docs

- PRD: `docs/plan/peaje-prd-es.md` §§7, 15, 21
- Skill agent 03: `.agents/skills/peajes-plantillas-builder/SKILL.md`
- Tables: `docs/06-tablas/peajes/plantillas-algoritmos.md`
- Motor service: `plantillas/motor/peajes-motor-transformacion.service.ts`
