# Guía — Plantillas y algoritmos (motor + UI)

## Resumen

Dominio de plantillas de transformación y algoritmos combinados (F03-1…F03-8 `passing`). Incluye motor **Builder + Strategy** en TypeScript, validaciones de publicación/alcance, UI de builder/aplicar/algoritmos y verify §21 del motor. Persistencia real vía `PeajesPlantillasSupabaseService` (F01); la UI aún usa mock hasta swap de providers (05).

## Índice

- [Resumen](#resumen)
- [Arquitectura del motor](#arquitectura-del-motor)
- [Códigos Strategy (frontend)](#códigos-strategy-frontend)
- [UI](#ui)
- [Validación](#validación)
- [Rutas](#rutas)
- [Providers](#providers)
- [Verificación](#verificación)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Referencias](#referencias)

---

## Arquitectura del motor

```text
plantillas/motor/
  strategy.types.ts              # AlgoritmoCodigo, TransformStrategy, PasoEjecucion
  strategy-registry.ts           # Registro seguro (RN-20)
  strategies/estrategias-atomicas.ts
  pipeline-builder.ts            # Expande configs + algoritmos → pasos
  peajes-motor-transformacion.service.ts  # PeajesMotorTransformacion
```

Flujo:

1. Configuraciones de plantilla (+ algoritmos combinados) → `PipelineBuilder`.
2. Cada paso resuelve un código en `StrategyRegistry` (falla si no está registrado).
3. `aplicarPipeline(filas, configuraciones, algoritmos)` transforma filas en memoria.
4. El wizard (pasos 3–4) **solo consume** esta interfaz; no duplica Strategy.

---

## Códigos Strategy (frontend)

| Código | Rol |
|--------|-----|
| `BORRAR_ESPACIOS` | Trim |
| `ELIMINAR_GUIONES` | Quita guiones |
| `CONVERTIR_MAYUSCULAS` | Upper |
| `CONVERTIR_TEXTO` / `CONVERTIR_NUMERO` | Cast |
| `ASIGNAR_VALOR` | Default / assign |
| `COPIAR_COLUMNA` | Copy |
| `FORMATEAR_FECHA_HORA` | Fecha/hora |
| `COMBINAR_COLUMNAS` | Concat |
| `CALCULAR_IMPORTE_NETO` | Precio − bonificación |

Ver gap vs catálogo SQL en [docs/06-tablas/peajes/plantillas-algoritmos.md](../../06-tablas/peajes/plantillas-algoritmos.md).

---

## UI

| Componente | Rol |
|------------|-----|
| `PlantillasHomeComponent` | Hub con tabs (listado / builders) |
| `PlantillaBuilderComponent` | Alta/edición plantilla + configs |
| `AplicarPlantillaComponent` | Preview de aplicación |
| `AlgoritmoBuilderComponent` | Pasos de algoritmo combinado |

Mocks: `mocks/peajes-plantillas.mock.ts` (`GLOBAL_EMPRESA_ID = '__global__'`).

---

## Validación

`validacion/plantillas-validacion.ts`:

- Publicar solo si reglas de definición OK.
- Alcance empresa vs global (`puedeAplicarRecurso`).

---

## Rutas

Declaración en `plantillas/plantillas.routes.ts` (`PLANTILLAS_ROUTE_PATHS`, `PLANTILLAS_ROUTES_DECLARATION`).

Paths previstos: `/peajes/plantillas`, `/nueva`, `/:id`, aplicar, algoritmos.

**No mergeadas** en `peajes.routes.ts` — Agente 05 unifica estilo (`Routes[]` tipado vs string declaration).

---

## Providers

Swap objetivo:

```ts
{ provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService }
```

Motor: ya es servicio real en TS (sin Supabase); no requiere swap.

---

## Verificación

```text
npm run build -- --configuration=development → OK
npx tsx src/app/components/peajes/plantillas/motor.verify.ts → PASS
```

Specs: `motor.spec.ts`, `builder.spec.ts`, `aplicar.spec.ts`, `algoritmos.spec.ts`.

---

## Limitaciones conocidas

1. UI con mock; servicio Supabase listo pero no cableado.
2. Rutas no cableadas al home.
3. Desalineación códigos catálogo SQL ↔ `ALGORITMO_CODIGOS` del motor (pendiente 05/follow-up).
4. E2E PRD §21 completo = F05-1 (no documentado como hecho).

---

## Referencias

- Contratos: `PeajesPlantillasService`, `PeajesMotorTransformacion`
- Tablas: [plantillas-algoritmos.md](../../06-tablas/peajes/plantillas-algoritmos.md)
- PRD §7 (motor), §14 (modelo plantillas)

---

> Última actualización: julio 2026
