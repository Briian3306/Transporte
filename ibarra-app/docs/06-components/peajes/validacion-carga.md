# Validación diagnóstica de carga — Peajes

## Resumen

El Paso 8 valida una carga sin reducir el resultado a «Error al validar». Cada control conserva estado, explicación, acción sugerida y —cuando interviene Supabase— detalles técnicos expandibles.

La regla que habilita avanzar es el contraste entre el **subtotal declarado** de la factura y la suma de `IMPORTE_NETO` de las pasadas: la diferencia absoluta debe ser menor o igual al **1% del subtotal** (`abs(subtotal) * 0.01`).

## Flujo

```text
Paso 5/6: mapeos y referencias
        ↓
Paso 8: resuelve códigos de patente/pase → UUID internos
        ↓
validarCarga + detectarDuplicados
        ↓
Checklist diagnóstico → habilitar Paso 9 si no hay bloqueos y |diferencia| ≤ 1% del subtotal
```

El CSV puede traer códigos operativos, como `DISPOSITIVO=94891934`; no son UUID. Antes de invocar el RPC de duplicados, el Paso 8 busca el pase y la patente en los catálogos. Si el pase no existe y la patente sí fue resuelta, crea el pase reutilizable y lo vincula a esa patente. Si una referencia continúa sin resolver, no envía un UUID inválido al backend.

## Controles visibles

| Control | Éxito | Bloquea | Paso sugerido |
|---|---|---|---|
| Importe de factura | `abs(subtotal - suma_neta) <= abs(subtotal) * 0.01` | Sí | 7 |
| Detección de duplicados | No hay claves repetidas en lote ni en base | Sí | 5 |
| Campos obligatorios | Fecha, pase, patente, estación, precio, bonificación, cantidad e importe neto presentes | Sí | 5 |
| Estaciones | `ESTACION_ID` es UUID del catálogo | Sí | 6 |
| Patentes | `PATENTE_ID` es UUID del catálogo | Sí | 5 |

Cada tarjeta presenta estado, explicación, recomendación y un botón para volver al paso que puede resolverla. Las tarjetas de RPC incluyen un `<details>` con nombre del RPC, HTTP/PostgreSQL cuando corresponde, solicitud, respuesta y stack solo si está disponible en desarrollo.

## Errores y acciones

| Señal | Causa | Acción del usuario | Tratamiento |
|---|---|---|---|
| `22P02 invalid input syntax for type uuid: "94891934"` | Se envió un dispositivo del proveedor como `pase_id` | Revisar Paso 5; el Paso 8 intenta resolver/crear el pase desde catálogo | Bloquea y expone `peajes_detectar_duplicados` si no puede resolverse |
| `suma_pasadas: 0` | Las filas se excluyeron antes de sumar o la lista enviada era vacía | Revisar errores de campos/referencias; revalidar | Bloquea el control de factura |
| `IMPORTE_NETO difiere de PRECIO - BONIFICACION` | El proveedor declaró descuentos netos no desglosados en `BONIFICACION` | No modificar la factura si el subtotal total coincide | No bloquea por sí solo; se conserva el neto declarado |
| Diferencia de subtotal mayor al 1% | Total de las pasadas no concilia con el subtotal | Corregir subtotal o importes/mapeo | Bloquea |
| Duplicado | Misma combinación pase + fecha/hora + estación + patente | Quitar/corregir la fila o revisar una carga previa | Bloquea |

## Frontend

`Paso8ValidacionComponent` usa `PeajesWizardStateService` para obtener las filas y `PeajesCargaSupabaseService` para validar.

- Calcula el neto local cuando el origen no declaró `IMPORTE_NETO`.
- Si el origen lo declaró, conserva ese valor: es el importe facturado que participa en la conciliación total.
- No realiza una llamada HTTP por fila a `peajes_calcular_importe_neto`; evita el patrón N llamadas por N pasadas.
- Resuelve `PASE_ID` y `PATENTE_ID` mediante `PeajesCatalogoService` antes de la detección de duplicados.
- Guarda las referencias UUID resueltas en el estado para la revisión y confirmación.

Fuentes:

- `src/app/components/peajes/wizard/paso8-validacion/paso8-validacion.component.ts`
- `src/app/components/peajes/services/peajes-carga.service.ts`

## Backend

| Artefacto | Responsabilidad |
|---|---|
| `peajes_validar_factura_pasadas` | Suma el arreglo de netos y devuelve `valido`, `diferencia`, `tolerancia` (1% del subtotal por defecto), `suma_pasadas` y `dentro_tolerancia` |
| `peajes_detectar_duplicados` | Detecta la clave de negocio en lote y contra `pasadas` persistidas; requiere UUIDs |
| `peajes_confirmar_carga` | Inserta factura, pasadas y auditoría solo si el subtotal total cumple la tolerancia |

Las migraciones `20260804183929_peajes_permitir_neto_declarado_si_total_valido.sql`, `20260804184205_peajes_permitir_neto_declarado_en_pasadas.sql` y `20260805113339_peajes_tolerancia_factura_uno_por_ciento.sql` alinean la persistencia y la tolerancia adaptativa con el Paso 8: `pasadas.importe_neto` conserva el importe declarado (no negativo) y el criterio vinculante es la conciliación del subtotal total (±1%).

## Caso AUSOL 557074

| Campo | Valor |
|---|---:|
| Subtotal | $560.832,27 |
| Suma de pasadas observada | $560.832,29 |
| Diferencia | $0,02 |
| Tolerancia (1%) | ~$5.608,32 |

La diferencia está dentro del 1% del subtotal, por lo que no debe bloquear el avance por el control de importe. Los netos de fila que reflejan descuentos del proveedor se conservan para alcanzar dicha conciliación.

## Verificación

```powershell
npx.cmd tsc --noEmit -p tsconfig.app.json
npx.cmd supabase migration up --local
npx.cmd supabase test db
```

El test SQL `peajes_f01_test.sql` incluye casos F11 de tolerancia porcentual. La suite completa puede conservar un fallo ajeno de seed AUSOL: estaciones `REVIEW` 19 frente a 18 esperadas.

## Referencias

- [Wizard](./wizard.md)
- [Auditoría y RPCs](../../06-tablas/peajes/auditoria-y-rpcs.md)
- [SQL task](../../08-sql/peajes/tolerancia-factura-uno-por-ciento/README.md)
- [Workflow AUSOL](../../plan/prueba-workflow-557074-ausol.md)
