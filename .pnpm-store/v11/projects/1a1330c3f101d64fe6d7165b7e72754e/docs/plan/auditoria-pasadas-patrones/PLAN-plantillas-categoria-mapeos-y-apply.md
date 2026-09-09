# F14 — Plantillas: mapeo `CATEGORIA` + apply DESARROLLO + QA

Plan operativo **único** para que las plantillas recurrentes no vuelvan a cargar pasadas en Patrón A cuando el CSV sí trae `CATEGORIA`. No implementa código ni autoriza `db reset --linked`.

**Entorno remoto de este repo:** DESARROLLO `kfffigvyvtzyczeiadxh` (no hay staging/prod separados; “producción” = este proyecto). Push solo con autorización explícita.

Estado al 2026-08-13: F14 DDL/RPC ya en remoto; backfill `pasadas.categoria` **1750** (CSV Telepase); ConsumosResumen **1711** null; `peajes_recalcular_tarifas` ya corrido (281 niveles). Este plan cubre **plantillas futuras**, no rehacer el backfill.

## 1. Problema

Al elegir otra plantilla el wizard **reemplaza** los mapeos del Paso 5 por `plantillas_configuracion.mapeos` (jsonb). No fusiona con el reconocimiento del Paso 2.

En DESARROLLO (consulta 2026-08-13) **ninguna** plantilla tiene destino `CATEGORIA` activo. Las Telepase **sí** listan la columna, pero quedó excluida (legado MVP: `CATEGORIA` en columnas ignoradas):

```json
{ "columnaOrigen": "CATEGORIA", "columnaDestino": null, "excluida": true }
```

Eso reproduce el error original: archivo con `CATEGORIA` → plantilla aplicada → `pasadas.categoria` null → Patrón A.

`configuraciones_plantilla` es el **pipeline** (Paso 3). El mapeo vive en **`plantillas_configuracion.mapeos`**, no hace falta un paso `COPIAR_COLUMNA` salvo que se quiera transformar el texto.

## 2. Alcance

### Dentro

- Activar mapeo `CATEGORIA → CATEGORIA` (`excluida: false`) en plantillas Telepase.
- Migración SQL idempotente (jsonb) en `ibarra-app/supabase/migrations/`.
- Apply en DESARROLLO.
- Checklist de prueba (wizard + SQL + no-regresión ConsumosResumen).

### Fuera

- No tocar ConsumosResumen / plantilla masiva (`MASIVOOO`): **no hay columna CATEGORIA** → Patrón A.
- No re-backfillear las 1750 filas (ya hecho).
- No disparar Recalcular otra vez **salvo** cargas nuevas post-fix o si QA lo pide.
- No cambiar `PASADA_COLUMNAS_OBLIGATORIAS` (CATEGORIA sigue opcional, RN-15).
- No `db reset --linked`.

## 3. Inventario DESARROLLO (2026-08-13)

| Plantilla | `mapeos` | Fila `CATEGORIA` hoy | Acción |
|---|---|---|---|
| `AUSA-8-2026` | 20 | excluida / destino null | **Activar** |
| `AUSA-V2` | 22 | excluida / destino null | **Activar** |
| `AUSA-V3` | 22 | excluida / destino null | **Activar** |
| `AUSOL-7-2026` | 21 | excluida / destino null | **Activar** |
| `AUBASA-7-2026` | 21 | excluida / destino null | **Activar** |
| `AU-OESTE-V1-08-26` | 21 | excluida / destino null | **Activar** |
| `CORRE-VIALES-V1` | 21 | excluida / destino null | **Activar** |
| `MASIVOOO` | 21 | no existe (Dominio/PRECIO) | **No tocar** |
| `ACCESO OESTE - Pasadas` | 0 | — | Fuera (mapeos vacíos; no Telepase CSV) |
| `Proveedor Demo - Pasadas` | 0 | — | Fuera (demo) |

SANTAFE no tiene plantilla nombrada; si aparece una, mismo criterio: CSV con `CATEGORIA` → activar.

## 4. Cómo editar (dos caminos; el SQL es el canónico para DESARROLLO)

### 4.1 UI (una plantilla, verificación humana)

1. Wizard Paso 1: CSV Telepase real (`scripts/downloads/{CONCESION}/pasadas_*.csv`) + empresa + plantilla.
2. Si salta a Factura: volver a Paso 5.
3. Destino `CATEGORIA` (opcional) ← origen `CATEGORIA`. No debe quedar excluida.
4. Guardar/actualizar plantilla (Paso 7 o builder) para persistir `p_mapeos`.

Sirve para smoke; **no** es el medio de aplicar las 7 plantillas en bloque.

### 4.2 Migración SQL (todas las Telepase)

Archivo nuevo (no editar migraciones ya aplicadas):

`ibarra-app/supabase/migrations/YYYYMMDDHHMMSS_peajes_plantillas_mapeo_categoria.sql`

Reglas:

- Idempotente.
- Solo filas jsonb con `columnaOrigen` en `CATEGORIA` / `CATEG` / `CLASE` (aliases Paso 2).
- Set `excluida = false`, `columnaDestino = 'CATEGORIA'`.
- Si no hay elemento de origen pero el nombre de plantilla está en la lista Telepase, **append** un objeto `{ columnaOrigen: "CATEGORIA", columnaDestino: "CATEGORIA", excluida: false }` (defensa; hoy las 7 ya tienen la fila excluida).
- **WHERE** por `nombre IN (...)` de la tabla §3 “Activar”. Nunca `MASIVOOO`.
- No reescribir `configuraciones_plantilla`.

Esqueleto:

```sql
-- Activar mapeo CATEGORIA en plantillas Telepase (Patrón B).
-- No tocar MASIVOOO ni plantillas sin columna de categoría.

UPDATE public.plantillas_configuracion p
SET mapeos = (
  SELECT jsonb_agg(
    CASE
      WHEN upper(trim(e->>'columnaOrigen')) IN ('CATEGORIA', 'CATEG', 'CLASE')
        THEN jsonb_build_object(
          'columnaOrigen', e->>'columnaOrigen',
          'columnaDestino', 'CATEGORIA',
          'excluida', false
        )
      ELSE e
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) WITH ORDINALITY AS t(e, ordinality)
)
WHERE p.nombre IN (
  'AUSA-8-2026',
  'AUSA-V2',
  'AUSA-V3',
  'AUSOL-7-2026',
  'AUBASA-7-2026',
  'AU-OESTE-V1-08-26',
  'CORRE-VIALES-V1'
);

-- Defensa: si alguna de esas plantillas no tenía fila CATEGORIA, agregarla.
UPDATE public.plantillas_configuracion p
SET mapeos = COALESCE(p.mapeos, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object(
    'columnaOrigen', 'CATEGORIA',
    'columnaDestino', 'CATEGORIA',
    'excluida', false
  )
)
WHERE p.nombre IN (
  'AUSA-8-2026', 'AUSA-V2', 'AUSA-V3',
  'AUSOL-7-2026', 'AUBASA-7-2026',
  'AU-OESTE-V1-08-26', 'CORRE-VIALES-V1'
)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) e
  WHERE e->>'columnaDestino' = 'CATEGORIA'
    AND COALESCE((e->>'excluida')::boolean, false) = false
);
```

Verificar en CLI local (`npx supabase db reset --local --no-seed` **no** borra DESARROLLO) antes del push.

## 5. Orden de apply en DESARROLLO

1. Confirmar proyecto linkeado = `kfffigvyvtzyczeiadxh`.
2. Snapshot (SQL Editor): `SELECT nombre, mapeos FROM plantillas_configuracion WHERE nombre IN (...)`.
3. `npx supabase db push --linked` **solo** de esta migración (F14 DDL ya está).
4. Query de control §6.1.
5. Smoke wizard §6.2 (una plantilla AUSA + un ConsumosResumen).
6. **No** Recalcular en bloque. Solo si se carga un documento **nuevo** post-fix y hay que refrescar niveles de ese peaje (`peajes_recalcular_tarifas`); respeta `confirmado_manual`.
7. Anotar evidencia en `docs/session-handoff.md` / `docs/claude-progress.md` (agente 05).

Rollback: restaurar jsonb del snapshot (paso 2). El UPDATE no toca `pasadas`.

## 6. Checklist de testing (pasar todo antes de dar por OK)

### 6.1 SQL / DESARROLLO

- [ ] Las 7 plantillas Telepase: exactamente **1** mapeo activo `columnaDestino = 'CATEGORIA'` y `excluida = false`.
- [ ] `MASIVOOO`: **0** mapeos a `CATEGORIA`.
- [ ] Demo / Acceso Oeste vacíos: sin cambio forzado.
- [ ] `pasadas`: ConsumosResumen sigue `categoria IS NULL` (1711); CSV backfill 1750 intacto.
- [ ] `tarifas_normalizadas` count no cambia por esta migración (solo jsonb de plantillas).

```sql
SELECT nombre,
  count(*) FILTER (
    WHERE e->>'columnaDestino' = 'CATEGORIA'
      AND COALESCE((e->>'excluida')::boolean, false) = false
  ) AS cat_activa
FROM public.plantillas_configuracion p
LEFT JOIN LATERAL jsonb_array_elements(COALESCE(p.mapeos, '[]'::jsonb)) e ON true
GROUP BY nombre
ORDER BY 1;
```

Esperado: Telepase `cat_activa = 1`; `MASIVOOO = 0`.

### 6.2 Wizard (regresión del bug)

- [ ] Cargar `pasadas_2026-07-23_5009A02044703.csv` (AUSA), elegir `AUSA-8-2026`.
- [ ] Paso 5: origen `CATEGORIA` → destino `CATEGORIA`, **no** excluida.
- [ ] Confirmar carga de un lote de prueba (o dry-run hasta Paso 5 si no se quiere duplicar RN-16): payload incluye `categoria` texto crudo (`5`/`6`/`7`/`9`).
- [ ] Repetir con `AUSOL-7-2026` + CSV AUSOL.
- [ ] Cargar `ConsumosResumen.xlsx` + `MASIVOOO`: **sin** destino CATEGORIA; Patrón A.

### 6.3 Motor / unitario (repo)

- [ ] `ng test --include="**/paso5-mapeo/**/*.spec.ts" --watch=false --browsers=ChromeHeadless`
- [ ] Specs de apply plantilla: restaurar mapeos con `CATEGORIA` no la pierde (`peajes-plantilla-apply` / wizard-state).
- [ ] Fixtures MVP/AU ya mapean `CATEGORIA` (`MVP_MAPEO_SUGERIDO` / `AU_MAPEO_SUGERIDO`) — no romper.

### 6.4 Post-carga (solo si se confirma un documento nuevo)

- [ ] `pasadas.categoria` del documento nuevo NOT NULL y coincide con el CSV.
- [ ] `peajes_normalizar_tarifas` corre (opción b); fallo de normalización no revierte la carga.
- [ ] En `/peajes/auditoria-tarifas` ese peaje: familias **Patrón B** para el nuevo lote (estación + categoría).
- [ ] Filas con `confirmado_manual = true` no se pisan si alguien Recalcula.

### 6.5 Criterio de OK

OK si 6.1 + 6.2 pasan. 6.3 en CI/local. 6.4 solo si QA autoriza una carga real.

**No OK** si al re-seleccionar `AUSA-8-2026` el Paso 5 vuelve a mostrar `CATEGORIA` excluida.

## 7. Dueños

| Paso | Agente |
|---|---|
| Migración SQL + push DESARROLLO | `01-backend-supabase` |
| Smoke wizard Paso 5 | `02-frontend-wizard-tablas` / QA |
| Checklist 6.1–6.5 + handoff | `05-integrador-qa` |

Necesidades cruzadas → `docs/session-handoff.md`.

## 8. Referencias

- Bug de restore: `PeajesPlantillaApplyService.aplicarAlEstado` pisa `state.setMapeos(plantilla.mapeos)`.
- Persistencia: `peajes_guardar_plantilla_importacion` / columna `plantillas_configuracion.mapeos`.
- Destino opcional: `PASADA_COLUMN_KEYS` incluye `CATEGORIA`; no está en `PASADA_COLUMNAS_OBLIGATORIAS`.
- Backfill ya hecho: `scripts/categorias_search/` + [APENDICE-B toolkit](../../../scripts/categorias_search/APENDICE-B-update-sql-supabase.md).
- Épica: [PLAN-auditoria-pasadas-patrones.md](./PLAN-auditoria-pasadas-patrones.md), [APENDICE-B-deteccion-categoria-y-mapeo.md](./APENDICE-B-deteccion-categoria-y-mapeo.md) §7.

---

> Última actualización: 2026-08-13
