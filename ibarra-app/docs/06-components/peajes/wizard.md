# Guía — Wizard de carga de peajes

## Resumen

`PeajesWizardComponent` (`app-peajes-wizard`) orquesta el asistente guiado de carga Excel → transformaciones → mapeo → factura → validación → confirmación (PRD §4). Implementado por Agente 02 (F02-1…F02-9 `passing`). Pasos 3–4 consumen el motor de Agente 03 sin duplicar Strategy.

## Índice

- [Resumen](#resumen)
- [Ubicación y rutas](#ubicación-y-rutas)
- [Pasos](#pasos)
- [Estado (RF-25)](#estado-rf-25)
- [Excel](#excel)
- [Providers actuales](#providers-actuales)
- [Dependencias](#dependencias)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Ubicación y rutas

| Artefacto | Path |
|-----------|------|
| Shell | `src/app/components/peajes/wizard/peajes-wizard.component.*` |
| Fragmento rutas | `wizard/wizard.routes.ts` → `PEAJES_WIZARD_ROUTES` |
| Path esperado | `/peajes/wizard` |

**Estado de integración:** el fragmento **no** está mergeado en `peajes.routes.ts` (solo home). Merge = Agente 05.

---

## Pasos

| # | Label | Componente | Notas |
|---|-------|------------|-------|
| 1 | Carga | `paso1-carga` | Upload `.xlsx` |
| 2 | Preview | `paso2-preview` | Máx. 10 filas (RNF-03) |
| 3 | Transformaciones | `paso3-transformaciones` | Motor 03 |
| 4 | Plantilla | `paso4-plantilla` | Selección/aplicación plantilla |
| 5 | Mapeo | `paso5-mapeo` | Columnas → Structure Goal |
| 6 | Estaciones | `paso6-estaciones` | Relación proveedor ↔ estación |
| 7 | Factura | `paso7-factura` | Datos Bill |
| 8 | Validación | `paso8-validacion` | Errores fila/columna/valor/motivo |
| 9 | Revisión | `paso9-revision` | Confirmación de carga |

---

## Estado (RF-25)

`PeajesWizardStateService` mantiene el paso actual y datos intermedios del flujo (archivo, preview, mapeos, relaciones, factura, resultado de validación).

---

## Excel

`PeajesExcelService` usa dependencia `xlsx` para parsear el archivo y producir preview tipado (`ExcelCargaPreview`).

---

## Providers actuales

El wizard y `wizard.routes.ts` aún proveen **mocks**:

```ts
{ provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService }
{ provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService }
```

Servicios reales listos (F01): `PeajesCatalogoSupabaseService`, `PeajesCargaSupabaseService`. Swap documentado en [servicios-y-providers.md](./servicios-y-providers.md).

---

## Dependencias

- Contratos: `peajes-services.contracts.ts`
- Motor: `PeajesMotorTransformacionService` (pasos 3–4)
- Catálogos UI hermanados: [catalogos.md](./catalogos.md)
- Persistencia: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md)

---

## Verificación

```text
ng build --configuration=development → OK
ng test --watch=false --browsers=ChromeHeadless
  --include="**/peajes/wizard/**/*.spec.ts"
  --include="**/peajes/catalogos/**/*.spec.ts" → 12 SUCCESS
```

---

## Referencias

- PRD §4 (pasos), §21 (caso E2E — pendiente Agente 05)
- Código: `src/app/components/peajes/wizard/**`

---

> Última actualización: julio 2026
