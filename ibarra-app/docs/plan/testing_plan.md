# Testing Plan — Peajes MVP (Transformation & Validation)

## Resumen

Plan de pruebas del MVP Peajes centrado en la **lógica de transformación Excel/CSV**, pipelines, mapeo de columnas, validación de salida y manejo de errores. Aplicable al **wizard** y a los **servicios/motor** del dominio Peajes.

**Fuentes de verdad:** `peaje-prd-es.md`, [ejemplo-mvp-procesamiento-pasadas.md](./ejemplo-mvp-procesamiento-pasadas.md), [ejemplo-autopistas-urbanas-pasadas.md](./ejemplo-autopistas-urbanas-pasadas.md).

**Skill de ejecución:** `.agents/skills/peajes-testing-transformaciones/SKILL.md`  
**Arquitectura bajo prueba:** `.agents/skills/peajes-transformaciones-motor/SKILL.md`

## Índice

- [Test objectives](#1-test-objectives)
- [Testing scope](#2-testing-scope)
- [Out of scope](#3-out-of-scope)
- [Test environment](#4-test-environment)
- [Required test data](#5-required-test-data)
- [Unit test cases](#6-unit-test-cases)
- [Integration test cases](#7-integration-test-cases)
- [Validation scenarios](#8-validation-scenarios)
- [Expected results](#9-expected-results)
- [Error scenarios](#10-error-scenarios)
- [Editable pipeline matrices (F02-10 / F03-9)](#10b-editable-pipeline-matrices-f02-10--f03-9)
- [Acceptance criteria](#11-acceptance-criteria)
- [Future testing improvements](#12-future-testing-improvements)

---

## 1. Test objectives

1. Verificar que cada estrategia atómica del `StrategyRegistry` produce salidas deterministas.
2. Verificar que `PipelineBuilder` / algoritmos combinados expanden y ordenan pasos (RN-18, RN-20).
3. Verificar pipelines completos sobre **todas las filas del preview (10)** de ambos proveedores ejemplo.
4. Verificar mapeo a Structure Goal (`FECHA_HORA`, `PATENTE_ID`, `PASE_ID`, `ESTACION_ID`/`código`, `PRECIO`, `IMPORTE_NETO`, `QUANTITY`).
5. Verificar reglas de validación de importes vs factura y forma de errores (RN-24).
6. Asegurar compatibilidad Angular (`ng test`) + reglas SQL críticas vía Supabase CLI (`supabase test db`) sin usar DESARROLLO como entorno de test.

---

## 2. Testing scope

| Área | Qué se prueba |
|------|----------------|
| Excel / CSV transform logic | Parseo y algoritmos por tipo semántico |
| Transformation pipelines | Demo + Autopistas plantillas |
| Data validation rules | Importes, vacíos, formatos |
| Column mapping validation | Columnas requeridas por adapter / plantilla |
| Output validation | Filas estandarizadas + suma vs factura |
| Error handling | Códigos desconocidos, columnas faltantes, rechazo trazable |
| Wizard (transform/validate) | Paso 3 (+ servicios de estado/motor); validación de totales (Paso 8) |
| Peajes services | `PeajesMotorTransformacionService` y builders |

---

## 3. Out of scope

- Auth / RBAC / permisos de módulo
- Catálogos UI (CRUD peajes/estaciones) salvo el **match** de código estación en pipeline
- Persistencia completa en DESARROLLO / Netlify
- Playwright/Cypress E2E de UI (mejora futura)
- Edge Functions deploy
- Módulos host (Checklists, Stock, etc.)
- Performance / carga masiva (> preview) salvo blueprint futuro

---

## 4. Test environment

| Componente | Entorno |
|------------|---------|
| Unit / integration Angular | Local — Karma + Jasmine (`ng test`) |
| Verify scripts | Local — Node `tsx` |
| Uniqueness / SQL constraints | **Supabase CLI** (`npx supabase test db`) |
| App manual smoke | `pnpm dev` → CLI local (opcional) |
| Remoto DESARROLLO | **No** para esta suite de transformación |

Comandos:

```powershell
cd ibarra-app
npx ng test --include="**/peajes/**/*.spec.ts" --watch=false
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
npx tsx src/app/components/peajes/e2e-prd21.verify.ts
npx supabase db reset --local --no-seed   # si hace falta schema limpio
npx supabase test db
```

---

## 5. Required test data

### 5.1 Archivos en `docs/plan/csv/`

| Archivo | Proveedor | Uso |
|---------|-----------|-----|
| `1947768.xlsx` | Demo / Corredores (caso MVP) | Ground truth físico; alineado a `ejemplo-mvp-procesamiento-pasadas.md` |
| `autopistas_urbanas.csv` | Autopistas Urbanas | Ground truth; primeras 10 filas = preview del ejemplo |

### 5.2 Fixtures de código

| Fixture | Ubicación |
|---------|-----------|
| Demo 10 filas + specs | `wizard/fixtures/mvp-ejemplo.fixture.ts` |
| Autopistas 10 filas + configs plantilla | `wizard/fixtures/autopistas-urbanas.fixture.ts` (`auFilasParaMotor`, `buildAuPlantillaConfigs`) |
| Plantilla/algoritmos mock | `plantillas/mocks/peajes-plantillas.mock.ts` |

### 5.3 Facturas mock

| Proveedor | `Importe_SIN_IVA` | Filas |
|-----------|------------------:|------:|
| Demo | `102060.00` | 10 |
| Autopistas Urbanas | `132940.19` | 10 |

### 5.4 Catálogo estación (ficticio en docs)

- Demo: códigos `1,2,3,5` → `EST-091…`
- Autopistas: `VAR-02C`, `KDT-02P`, etc. → `EST-AU-*` (ver ejemplo Autopistas)

---

## 6. Unit test cases

### 6.1 StrategyRegistry & atomics

| ID | Caso | Entrada | Esperado |
|----|------|---------|----------|
| U-S01 | RN-20 unknown | `CODIGO_FANTASMA` | throw `/no registrado/i` |
| U-S02 | `BORRAR_ESPACIOS` | `"  AD625QB  "` | `AD625QB` |
| U-S03 | `CONVERTIR_MAYUSCULAS` | `ad625qb` | `AD625QB` |
| U-S04 | `FORMATEAR_FECHA_HORA` pad | FECHA `25/06/2026`, HORA `85557` | `2026-06-25 08:55:57` |
| U-S05 | `FORMATEAR_FECHA_HORA` | HORA `205005` | `… 20:50:05` |
| U-S06 | `COMBINAR_COLUMNAS` Demo | FECHA+HORA sep espacio | join crudo o vía formatear según plantilla |
| U-S07 | `COMBINAR_COLUMNAS` AU | `VAR`+`02C` sep `-` | `VAR-02C` |
| U-S08 | `CONVERTIR_NUMERO` AR | `19.985,09` | `19985.09` |
| U-S09 | `CONVERTIR_NUMERO` Demo | `17400` | `17400` |
| U-S10 | `CALCULAR_IMPORTE_NETO` | 17400−5220 | `12180` |
| U-S11 | `ASIGNAR_VALOR` | `{ valor: 1 }` | `1` |

### 6.2 Combined / Builder

| ID | Caso | Esperado |
|----|------|----------|
| U-B01 | Expand `NORMALIZAR_PATENTE` | 3 pasos: BORRAR→GUIONES→MAYUSCULAS |
| U-B02 | Ejecución secuencial dirty | `" ad-625-qb "` → `AD625QB` |
| U-B03 | RN-18 orden duplicado | error en `validarDefinicionPlantilla` |
| U-B04 | Columna faltante obligatoria | error con nombre de columna |
| U-B05 | Sort por `orden` | pasos ascendentes |
| U-B06 | Orden efectivo combinado | `orden * 1000 + paso.orden` |

Archivos actuales a extender: `plantillas/motor.spec.ts`, `builder.spec.ts`, `algoritmos.spec.ts`.

---

## 7. Integration test cases

| ID | Componente / servicio | Caso |
|----|----------------------|------|
| I-01 | `Paso3TransformacionesComponent` | `tieneColumnasMvp === true` con headers Demo |
| I-02 | Paso3 | `tieneColumnasMvp === false` si falta `DOMINIO` |
| I-03 | Paso3 | Preview fila 1 Demo → `FECHA_HORA` / `IMPORTE_NETO` |
| I-04 | Paso3 | Emite `completado` / `atras` |
| I-05 | Paso3 | Muestra errores cuando motor valida fallido |
| I-06 | `PeajesWizardStateService` | Guarda columnas/preview tras transform |
| I-07 | `PeajesMotorTransformacionService` | `aplicarPipeline` 10 filas Demo |
| I-08 | Motor + plantilla AU | `aplicarPipeline` 10 filas Autopistas |
| I-09 | Paso8 validación | Compara suma vs factura Demo |
| I-10 | Paso8 / servicio | Compara suma vs factura Autopistas |

---

## 8. Validation scenarios

| ID | Regla | Escenario | Resultado |
|----|-------|-----------|-----------|
| V-01 | RN-16 | Misma clave pase+fecha_hora+estación+patente | Duplicado / rechazo o UK SQL |
| V-02 | RN-16 | Mismo pase, distinta hora | OK |
| V-03 | RN-16 | Mismo pase, distinta estación (AU filas 6–7) | OK |
| V-04 | Factura | Suma Demo = 102060.00 | Válido |
| V-05 | Factura | Suma AU = 132940.19 | Válido |
| V-06 | Factura | Suma ≠ Importe_SIN_IVA | Inválido |
| V-07 | Importe | `IMPORTE_NETO` negativo | Rechazo |
| V-08 | RF-13 | Faltan columnas adapter | Pipeline bloqueado |
| V-09 | RN-24 | Error expuesto | Incluye fila/columna/motivo; sin stack SQL |

---

## 9. Expected results

### 9.1 Demo (10 filas) — extracto

| Check | Valor |
|-------|--------|
| Filas válidas | 10 |
| Row1 `FECHA_HORA` | `2026-06-25 20:50:05` |
| Row2 hora pad | `08:55:57` |
| Row1 `IMPORTE_NETO` | `12180` |
| Row8 `IMPORTE_NETO` | `4620` |
| Row10 `IMPORTE_NETO` | `7560` |
| Suma | `102060` |

Detalle completo: [ejemplo-mvp-procesamiento-pasadas.md](./ejemplo-mvp-procesamiento-pasadas.md) §8–10.

### 9.2 Autopistas Urbanas (10 filas) — extracto

| Check | Valor |
|-------|--------|
| Filas válidas | 10 |
| Row1 `FECHA_HORA` | `2026-07-27 12:14:33` (solo join) |
| Row1 código estación | `VAR-02C` |
| Row1 `PRECIO` / neto | `19985.09` |
| Row3 `PRECIO` | `7918.73` |
| Suma | `132940.19` |

Detalle: [ejemplo-autopistas-urbanas-pasadas.md](./ejemplo-autopistas-urbanas-pasadas.md) §9–10.

---

## 10. Error scenarios

| ID | Condición | Comportamiento esperado |
|----|-----------|-------------------------|
| E-01 | `algoritmo_codigo` no registrado | Throw / error validación RN-20 |
| E-02 | Orden duplicado en plantilla | Error RN-18 |
| E-03 | Falta `HORA` (Demo) o `VIA` (AU) | Error columnas / incompatibilidad |
| E-04 | `TARIFA` no numérica | Error estrategia / fila rechazada |
| E-05 | BONIFICACION > TARIFA (Demo) | Rechazo neto inválido |
| E-06 | Mensaje al usuario | Texto ES; sin SQL ni stack |

---

## 10b. Editable pipeline matrices (F02-10 / F03-9)

Ground truth inmutable:

| Proveedor | Row1 `FECHA_HORA` | Row1 `IMPORTE_NETO` | Suma 10 filas |
|-----------|-------------------|--------------------:|--------------:|
| Demo | `2026-06-25 20:50:05` | `12180` | **102060** |
| Autopistas Urbanas | `2026-07-27 12:14:33` | `19985.09` | **132940.19** |

### U-P — Unit (motor / descriptors)

| ID | Caso | Archivo | Esperado |
|----|------|---------|----------|
| U-P01 | Skip `habilitado === false` | `motor.spec.ts` | Paso omitido en `construirPipeline` / `aplicarPipeline` |
| U-P02 | Deps OK productores primero | `motor.spec.ts` | Sin errores use-before / ciclo |
| U-P03 | Use-before-create | `motor.spec.ts` | Error `/uso antes de crear/i` |
| U-P04 | Dependencia circular | `motor.spec.ts` | Error `/circular/i` |
| U-P05 | `previsualizarPaso` hasta orden N | `motor.spec.ts` | Solo pasos `orden <= N` |
| U-P06 | `descriptor.validar` ASIGNAR_VALOR | `motor.spec.ts` | Rechaza sin `valor` |
| U-P07 | Código desconocido | `motor.spec.ts` | Throw / error RN-20 |
| U-P08 | Disable → enable restaura | `motor.spec.ts` | QUANTITY reaparece |

### I-P — Integration (Paso 3 + pipeline sums)

| ID | Caso | Archivo | Esperado |
|----|------|---------|----------|
| I-P01 | Seed draft MVP al iniciar | `paso3-transformaciones.component.spec.ts` | Draft no vacío + 10 descriptors |
| I-P02 | Añadir paso | idem | `drafts.length + 1` |
| I-P03 | Editar paso | idem | algoritmo / destino actualizados |
| I-P04 | Eliminar paso | idem | draft removido |
| I-P05 | Duplicar paso | idem | copia con nuevo `clientId` |
| I-P06 | Reordenar (DnD) | idem | orden 10,20,… |
| I-P07 | Deshabilitar paso | idem | `habilitado === false`, badge `off` |
| I-P08 | Errores de dependencia en UI | idem | `errores.length > 0` |
| I-P preview | Preview motor Demo row1 | idem | `FECHA_HORA` + `IMPORTE_NETO=12180` vía motor |
| I-P emitters | `completado` / `atras` | idem | emitters disparan |
| I-P09 | Demo seed → suma | `motor.spec.ts` / `motor.verify.ts` | **102060** |
| I-P10 | AU plantilla → suma | idem + `auFilasParaMotor()` | **132940.19** |

### V-P — Validation (factura / deps editable)

| ID | Regla | Escenario | Resultado |
|----|-------|-----------|-----------|
| V-P01 | Factura Demo | Suma pipeline editable = 102060 | Válido |
| V-P02 | Factura AU | Suma pipeline AU = 132940.19 | Válido |
| V-P03 | Skip disabled | QUANTITY off no altera IMPORTE_NETO Demo | Neto OK; QUANTITY ausente |
| V-P04 | Deps use-before | IMPORTE antes de PRECIO | Inválido / lista errores |
| V-P05 | Preview parcial | `previsualizarPaso(..., 20)` | PASE_ID sí; PATENTE_ID no |

### E-P — Error (pipeline editable)

| ID | Condición | Comportamiento esperado |
|----|-----------|-------------------------|
| E-P01 | Columna entrada fantasma en draft | `validarDependenciasPipeline` → error; Paso3 `errores` |
| E-P02 | Ciclo A↔B en drafts | Error circular; badge error en cards |
| E-P03 | Continuar con errores | Confirm; si cancela no emite `completado` |
| E-P04 | Código no registrado al construir | Throw / validación RN-20 (U-P07) |
| E-P05 | TARIFA AR cruda sin pre-parse | `CONVERTIR_NUMERO` actual → null/NaN; usar `auFilasParaMotor` hasta locale AR |

Comandos de evidencia Wave 2:

```powershell
cd ibarra-app
npx tsx src/app/components/peajes/plantillas/motor.verify.ts
npx tsx src/app/components/peajes/e2e-prd21.verify.ts
npx ng test --include="**/peajes/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
```

---

## 11. Acceptance criteria

El MVP de transformación/validación se considera **aceptable para testing** cuando:

1. `ng test` de specs Peajes relevantes pasa en CI/local.
2. `motor.verify.ts` y/o `e2e-prd21.verify.ts` reproducen el caso Demo §21 (al menos fila canónica + totales documentados).
3. Existe (o se agrega) cobertura pipeline Autopistas 10 filas con suma `132940.19`.
4. Totales Demo `102060` y AU `132940.19` están assertados.
5. RN-20 y RN-18 tienen tests unitarios.
6. Errores de validación no exponen internals.
7. `supabase test db` sigue en verde para constraints RN-16 del schema Peajes.
8. Este plan y la skill `peajes-testing-transformaciones` se mantienen alineados a los docs ejemplo.

---

## 12. Future testing improvements

1. E2E UI (Playwright) upload real de `1947768.xlsx` y `autopistas_urbanas.csv`.
2. Contrato compartido TS para Edge Function bulk (misma suite de vectores).
3. Cobertura medible (Karma coverage) con umbrales del skill.
4. Property-based tests para pad de hora y parse monetario.
5. Snapshot de filas estandarizadas versionado junto a los docs ejemplo.
6. CONVERTIR_NUMERO locale AR nativo sin pre-normalizar fixture (`auFilasParaMotor`).

---

## Referencias

- PRD: [peaje-prd-es.md](./peaje-prd-es.md)
- Demo: [ejemplo-mvp-procesamiento-pasadas.md](./ejemplo-mvp-procesamiento-pasadas.md)
- Autopistas: [ejemplo-autopistas-urbanas-pasadas.md](./ejemplo-autopistas-urbanas-pasadas.md)
- CSV/XLSX: [csv/](./csv/)
- Pipeline editable outline: [../06-components/peajes/pipeline-editable-paso3.md](../06-components/peajes/pipeline-editable-paso3.md)
- Skill testing: `.agents/skills/peajes-testing-transformaciones/`
- Skill motor: `.agents/skills/peajes-transformaciones-motor/`
- Plan index: [INDEX.md](./INDEX.md)

---

> Última actualización: 2026-07-31 (Wave 2 QA — matrices U-P / I-P / V-P / E-P pipeline editable)
