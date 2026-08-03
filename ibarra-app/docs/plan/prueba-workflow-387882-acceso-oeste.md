# Prueba de workflow — Acceso Oeste (`387882.csv`)

## Resumen

Caso reproducible para verificar el recorrido completo del wizard de Peajes con
`csv/387882.csv`. Complementa, sin sustituir, el plan general de
[testing](./testing_plan.md).

## Datos y precondiciones

- Archivo: `docs/plan/csv/387882.csv`, delimitado por `;`.
- Datos esperados: 496 filas, 15 columnas, 45 pases/patentes únicos, 39 claves
  `ESTACION - VIA` y neto total `2189120.01`.
- Entorno obligatorio: Supabase CLI local; DESARROLLO no es entorno de prueba.
- Catálogo esperado: aliases de las 39 claves de estación y referencias de
  pase/patente resueltas a UUID antes de llamar a `peajes_confirmar_carga`.
- Factura de prueba: `importe_sin_iva = 2189120.01`.

## Workflow y evidencia

| Paso | Prueba | Resultado requerido |
|---|---|---|
| 1. Carga | Seleccionar el CSV | Acepta `.csv`, detecta `;`, 496 filas y 15 encabezados. |
| 2. Preview | Revisar las primeras 10 filas | Encabezados y valores de origen se conservan. |
| 3. Transformaciones | Ejecutar plantilla Acceso Oeste | Primera fila: `2026-07-16 04:36:48`, pase `94337220`, patente `OWG130`, precio `3976.59`, neto `3976.59`. |
| 4–5. Plantilla/mapeo | Aplicar plantilla y Structure Goal | `FECHA_HORA`, `PASE_ID`, `PATENTE_ID`, `ESTACION_ID`, `PRECIO`, `BONIFICACION`, `QUANTITY`, `IMPORTE_NETO` quedan cubiertos. |
| 6. Estaciones | Resolver todas las claves | Las 39 claves `ESTACION - VIA` quedan relacionadas, incluida `ITUZAINGO - 05`. |
| 7. Factura | Cargar factura de prueba | Importe sin IVA `2189120.01`. |
| 8. Validación | Validar importes y duplicados | 496 válidas, diferencia `0`, sin duplicados en la primera ejecución. |
| 9. Confirmación | Ejecutar RPC transaccional | Se crean factura, 496 pasadas y registro de carga. |

## Comandos de verificación

```powershell
npx.cmd ng test --include="**/peajes/**/*.spec.ts" --watch=false
npx.cmd tsx src/app/components/peajes/plantillas/motor.verify.ts
npx.cmd supabase db reset --local --no-seed
npx.cmd supabase test db
npx.cmd ng build --configuration=development
```

Después de la primera carga local, repetir la confirmación con la misma factura
y filas: la validación debe informar duplicados según RN-16.

## Estado actual

La evidencia se completa únicamente cuando las features F06-1, F06-2 y F06-3
estén verificadas. Hasta entonces F06-5 permanece `not_started` o `blocked`;
no debe registrarse como `passing` sin los resultados de los comandos y de la
confirmación local.

## Referencias

- [Plan de pruebas Peajes](./testing_plan.md)
- [Ejemplo MVP](./ejemplo-mvp-procesamiento-pasadas.md)
- [PRD Peajes](./peaje-prd-es.md)
- `feature_list.json` — F06-5
