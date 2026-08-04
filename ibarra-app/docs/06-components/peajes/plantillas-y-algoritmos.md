# Guía — Plantillas y algoritmos (motor + UI)

## Resumen

Dominio de plantillas de transformación y algoritmos combinados (F03-1…F03-9 `passing`). Incluye motor **Builder + Strategy** en TypeScript, validaciones de publicación/alcance, UI de builder/aplicar/algoritmos con **preview de filas de muestra**, y verify §21 del motor. Persistencia vía `PeajesPlantillasSupabaseService` (providers en `PEAJES_SUPABASE_PROVIDERS`).

Guía de usuario (paso a paso UI): [guia-crear-plantillas.md](./guia-crear-plantillas.md).

## Índice

- [Resumen](#resumen)
- [Arquitectura del motor](#arquitectura-del-motor)
- [Códigos Strategy (frontend)](#códigos-strategy-frontend)
- [Cómo crear un algoritmo](#cómo-crear-un-algoritmo)
- [Ejemplo PATENTE](#ejemplo-patente)
- [UI](#ui)
- [Validación](#validación)
- [Rutas](#rutas)
- [Providers](#providers)
- [Verificación](#verificación)
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
4. El wizard (pasos 3–5) **solo consume** esta interfaz; no duplica Strategy.

---

## Códigos Strategy (frontend)

| Código | Rol |
|--------|-----|
| `BORRAR_ESPACIOS` | Trim (legacy: TRIM) |
| `ELIMINAR_GUIONES` | Quita guiones |
| `CONVERTIR_MAYUSCULAS` | Upper (legacy: UPPER) |
| `CONVERTIR_TEXTO` / `CONVERTIR_NUMERO` | Cast |
| `ASIGNAR_VALOR` | Default / assign |
| `COPIAR_COLUMNA` | Copy |
| `FORMATEAR_FECHA_HORA` | Fecha/hora |
| `COMBINAR_COLUMNAS` | Concat |
| `CALCULAR_IMPORTE_NETO` | Precio − bonificación |

`NORMALIZAR_PATENTE` / `COMBINAR_FECHA_HORA` son **combinados**, no códigos del registry.

El wizard (Paso 2) puede **recomendar** estas cadenas atómicas según aliases de columna (F02-11). Las recetas viven en `column-recognition.ts` y reutilizan el mismo catálogo; ver [reconocimiento-columnas.md](./reconocimiento-columnas.md). No duplicar aquí la tabla de aliases.

---

## Cómo crear un algoritmo

1. Abrí `/peajes/plantillas` → tab **Algoritmos**.
2. **Ejemplo PATENTE** o pasos manuales (orden + código registry).
3. Empresa por dropdown (o global).
4. Preview con filas mock (`FILA_EJEMPLO_PRD_21` + variantes sucias) vía `aplicarPipeline`.
5. Guardar algoritmo; opcional **Guardar + plantilla PATENTE_ID** para crear la config `nombre_columna` → `columna_destino = PATENTE_ID`.

Detalle UX: [guia-crear-plantillas.md](./guia-crear-plantillas.md).

---

## Ejemplo PATENTE

Semilla F06 (CLI local verificada):

- Algoritmo `NORMALIZAR_PATENTE`: `BORRAR_ESPACIOS` → `ELIMINAR_GUIONES` → `CONVERTIR_MAYUSCULAS`
- Plantilla Demo: `DOMINIO` → `PATENTE_ID`
- Plantilla Acceso Oeste: `PATENTE` → `PATENTE_ID`

En Paso 5 el origen del mapeo es `PATENTE_ID` (salida del pipeline).

---

## UI

| Componente | Rol |
|------------|-----|
| `PlantillasHomeComponent` | Hub con tabs (listado / builders) |
| `PlantillaBuilderComponent` | Alta/edición plantilla + configs + empresa select |
| `AplicarPlantillaComponent` | Preview de aplicación |
| `AlgoritmoBuilderComponent` | Pasos, preview mock, ejemplo PATENTE |

Mocks de specs: `mocks/peajes-plantillas.mock.ts` (`GLOBAL_EMPRESA_ID = '__global__'`).

---

## Validación

`validacion/plantillas-validacion.ts`:

- Publicar solo si reglas de definición OK.
- Alcance empresa vs global (`puedeAplicarRecurso`).
- Códigos no registrados → error.

---

## Rutas

`plantillas/plantillas.routes.ts` fusionado en `peajes.routes.ts`:

| Path | Componente |
|------|------------|
| `/peajes/plantillas` | Hub (tabs lista / builder / aplicar / algoritmos) |

---

## Providers

```ts
{ provide: PEAJES_PLANTILLAS_SERVICE, useExisting: PeajesPlantillasSupabaseService }
```

Cableado en `PEAJES_SUPABASE_PROVIDERS` (raíz de rutas Peajes). Motor TS local (sin Supabase).

---

## Verificación

```text
npm run build -- --configuration=development
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
```

Specs: `motor.spec.ts`, `builder.spec.ts`, `aplicar.spec.ts`, `algoritmos.spec.ts`.

SQL seed PATENTE_ID: consultar la migración correspondiente en `supabase/migrations/`.

---

## Referencias

- Guía usuario: [guia-crear-plantillas.md](./guia-crear-plantillas.md)
- Contratos: `PeajesPlantillasService`, `PeajesMotorTransformacion`
- Tablas: [plantillas-algoritmos.md](../../06-tablas/peajes/plantillas-algoritmos.md)
- PRD §7 (motor), §14 (modelo), §21 (aceptación)
- Skill: `.agents/skills/peajes-plantillas-builder/SKILL.md`

---

> Última actualización: 2026-08-03
