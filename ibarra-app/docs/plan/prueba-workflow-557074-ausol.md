# Prueba de workflow AUSOL — `557074.csv`

## Objetivo

Evidencia reproducible para comprobar que el wizard procesa [557074.csv](./csv/557074.csv) sin omitir las decisiones del Reconocedor de Estaciones. Este documento define el caso; sus resultados se registran solo después de ejecutar las pruebas locales.

## Datos y precondiciones

| Dato | Esperado |
|---|---:|
| Filas CSV | 191 |
| Pases / patentes únicos | 45 / 45 |
| Valores distintos de estación | 12 |
| Total neto | 678607.05 |
| Factura de prueba, sin IVA | 678607.05 |

La base Supabase CLI debe contener el seed AUSOL de `ESTACIONES.xlsx`: empresa y peaje AUSOL, estaciones con `ZONA` como nombre canónico y aliases `CODIGO` / `ZONA - AUTOPISTA`. Las estaciones con ambas coordenadas deben quedar `OK`; las restantes, `REVIEW`.

## Flujo a verificar

| Paso | Acción | Condición de aprobación |
|---:|---|---|
| 1 | Cargar CSV `;` | 191 filas y encabezados detectados. |
| 2 | Previsualizar | Primeras 10 filas preservan valores y tipos. |
| 3 | Aplicar plantilla AUSOL | Genera fecha/hora, normaliza patente, convierte importes y asigna cantidad. |
| 4 | Seleccionar plantilla | Pipeline compatible con los encabezados del archivo. |
| 5 | Mapear Structure Goal | `PATENTE_ID`, `PASE_ID`, `PRECIO`, `BONIFICACION`, `IMPORTE_NETO` y `QUANTITY` completos. |
| 6 | Resolver estaciones | Exactos/aliases se asignan; coincidencias parciales esperan confirmación; ninguna crea estaciones automáticamente. |
| 7 | Cargar factura | `importe_sin_iva = 678607.05`. |
| 8 | Validar | 191 pasadas, diferencia 0, sin claves duplicadas. |
| 9 | Revisar y confirmar | Solo se habilita con validación correcta y decisiones de estaciones completas. |

## Casos específicos del Reconocedor

| Caso | Acción esperada |
|---|---|
| Alias exacto | Resolver automáticamente y reutilizar `estacion_id`. |
| Nombre `ZONA` exacto | Resolver automáticamente dentro de AUSOL. |
| `BUEN AYRE ASCENDENTE` frente a `BUEN AYRE` | Mostrar propuesta y pedir confirmación. |
| Más de una propuesta posible | No seleccionar ninguna automáticamente. |
| Sin propuesta | Permitir crear una estación solo tras confirmación explícita del usuario. |
| Alias confirmado | Persistirlo y resolverlo automáticamente en cargas siguientes. |

## Comandos de evidencia

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
npx ng test --include="**/peajes/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
```

La ejecución debe registrar el comando, resultado y cualquier bloqueo en `feature_list.json` y `docs/claude-progress.md`. Hasta entonces este caso permanece pendiente de verificación, no `passing`.

## Referencias

- [Ejemplo AUSOL](./ejemplo-ausol-procesamiento-pasadas.md)
- [Plan de pruebas](./testing_plan.md)
- [Wizard](../06-components/peajes/wizard.md)

