# AUSOL/AUSA — `fecha_hora` −1 día (hora correcta)

Fecha: 2026-08-10  
Proyecto: DESARROLLO `kfffigvyvtzyczeiadxh`  
Skill: `verification-pasadas-files` (revisión read-only)  
Estado: **corrección aplicada en DESARROLLO** (2026-08-10): 185 pasadas (`493556`=162 + `493557`=23) con `fecha_hora + interval '1 day'`; algoritmo/plantillas ya corregidos

## Resumen

Tras cargar `pasadas_2026-07-16_493556.csv` y `pasadas_2026-07-16_493557.csv` (carpeta Telepase AUSOL / UI Peajes-Ausa), todas las `pasadas.fecha_hora` quedaron **un día antes** que el CSV. La **hora** (HH:mm:ss), patente, estación e importe coinciden.

Causa: celdas `FECHA` date-only (Excel/SheetJS → `Date` en UTC midnight) formateadas con getters **locales** en ART (UTC−3) → calendario −1 día; luego `HORA` se aplica bien. Plantillas AUSA/AUSOL en DESARROLLO agravaban el caso (`COMBINAR_COLUMNAS` sin `formato_hora`, o `FORMATEAR_FECHA_HORA` con `DD/MM/YYYY` pese a CSV ISO).

## Evidencia spot-check

| Campo | CSV | DB |
|-------|-----|-----|
| id | — | `1851b71d-1cab-42a1-8164-f06ca0beefcb` |
| Patente | AH033DL | AH033DL |
| Estación | CAMPANA DECALADA | CAMPANA DECALADA |
| Pase | 93423682 | 93423682 |
| Precio | 3976.59 | 3976.59 |
| Datetime | **2026-07-13 14:13:49** | Antes: `2026-07-12 14:13:49+00` → **después del UPDATE: `2026-07-13 14:13:49+00`** |
| Δ | | Corregido (+1 día); hora sin cambio |

Segunda fila AH033DL (CAMPANA): CSV `2026-07-13 05:02:40` → DB `2026-07-12 05:02:40`.

### Histogramas (CSV vs DB)

**`pasadas_2026-07-16_493556.csv`** (162 filas): conteos por día del CSV desplazados −1 en DB  
(ej. CSV `2026-07-01`→24 = DB `2026-06-30`→24; CSV `2026-07-13`→10 = DB `2026-07-12`→10).

**`pasadas_2026-07-16_493557.csv`** (23 filas): mismo patrón  
(ej. CSV `2026-07-13`→6 = DB `2026-07-12`→6).

### Query de verificación (read-only)

```sql
-- Spot-check
SELECT p.id, pt.patente, e.nombre AS estacion,
       (p.fecha_hora AT TIME ZONE 'UTC')::text AS fecha_hora_utc,
       p.precio, p.file_upload_name
FROM pasadas p
JOIN patentes pt ON pt.id = p.patente_id
LEFT JOIN estaciones e ON e.id = p.estacion_id
WHERE p.id = '1851b71d-1cab-42a1-8164-f06ca0beefcb';

-- Histograma DB
SELECT to_char(p.fecha_hora AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS fecha_utc, count(*) AS n
FROM pasadas p
WHERE p.file_upload_name IN (
  'pasadas_2026-07-16_493556.csv',
  'pasadas_2026-07-16_493557.csv'
)
GROUP BY 1
ORDER BY 1;
```

## Fix preventivo (código + plantillas)

### Algoritmo

Archivos:

- `src/app/components/peajes/wizard/services/peajes-fecha.util.ts`  
  - `isUtcDateOnly` / `formatUtcDateOnly`  
  - `normalizarCeldaExcel`: date-only UTC midnight → `yyyy-MM-dd 00:00:00` (UTC), no local
- `src/app/components/peajes/plantillas/motor/strategies/estrategias-atomicas.ts`  
  - `FORMATEAR_FECHA_HORA` / `normalizarFechaEntrada`: Date y serial Excel → día UTC  
  - recupera strings ya shiftados `… 21|22|23:00:00`  
  - `COMBINAR_COLUMNAS` infiere `YYYY-MM-DD HH:MM:SS` cuando FECHA es ISO (ya no default ciego `DD/MM/YYYY`)

Fixtures: `ausol.fixture.ts`, `acceso-oeste.fixture.ts` documentan `formato_hora: 'YYYY-MM-DD HH:MM:SS'`.

### Plantillas DESARROLLO (config)

| Plantilla | id | Antes (paso FECHA) | Después |
|-----------|-----|--------------------|---------|
| AUSOL-7-2026 | `7c42ac64-…` | `FORMATEAR_FECHA_HORA` + `DD/MM/YYYY HH:MM:SS` | `YYYY-MM-DD HH:MM:SS` |
| AUSA-8-2026 | `efec4fd3-…` | `COMBINAR_COLUMNAS` sin formato | `FORMATEAR_FECHA_HORA` + `YYYY-MM-DD HH:MM:SS` |
| AUSA-V2 | `0b3b704f-…` | `COMBINAR_COLUMNAS` sin formato | `FORMATEAR_FECHA_HORA` + `YYYY-MM-DD HH:MM:SS` |
| ACCESO OESTE | `7e2d90d8-…` | ya OK | sin cambio |

```sql
-- Preview plantillas afectadas
SELECT p.nombre, pc.id, pc.configuracion
FROM plantillas_configuracion p
JOIN configuraciones_plantilla pc ON pc.plantilla_id = p.id
WHERE pc.orden = 10
  AND p.nombre IN ('AUSOL-7-2026', 'AUSA-8-2026', 'AUSA-V2');

-- Apply (idempotente)
UPDATE configuraciones_plantilla pc
SET configuracion = jsonb_strip_nulls(
  COALESCE(pc.configuracion, '{}'::jsonb)
  || jsonb_build_object(
    'algoritmo_codigo', 'FORMATEAR_FECHA_HORA',
    'columnas_entrada', '["FECHA","HORA"]'::jsonb,
    'formato_hora', 'YYYY-MM-DD HH:MM:SS',
    'habilitado', true
  )
)
FROM plantillas_configuracion p
WHERE pc.plantilla_id = p.id
  AND pc.orden = 10
  AND pc.columna_destino = 'FECHA_HORA'
  AND p.nombre IN ('AUSOL-7-2026', 'AUSA-8-2026', 'AUSA-V2');
```

## Fix correctivo de datos (aplicado 2026-08-10 en DESARROLLO)

Ejecutado: `UPDATE pasadas SET fecha_hora = fecha_hora + interval '1 day'` para `493556` (162) + `493557` (23) = **185** filas.  
Post-check: histograma `493556` alinea con CSV (`2026-07-01`→24 … `2026-07-13`→10 … `2026-07-15`→4); spot-check AH033DL → `2026-07-13`.

### 1) Preview (histórico)

```sql
SELECT
  p.id,
  pt.patente,
  e.nombre AS estacion,
  (p.fecha_hora AT TIME ZONE 'UTC')::text AS actual_utc,
  ((p.fecha_hora + interval '1 day') AT TIME ZONE 'UTC')::text AS corregida_utc,
  p.file_upload_name
FROM pasadas p
JOIN patentes pt ON pt.id = p.patente_id
LEFT JOIN estaciones e ON e.id = p.estacion_id
WHERE p.file_upload_name IN (
  'pasadas_2026-07-16_493556.csv',
  'pasadas_2026-07-16_493557.csv'
)
ORDER BY p.file_upload_name, p.fecha_hora;

SELECT file_upload_name, count(*) AS n
FROM pasadas
WHERE file_upload_name IN (
  'pasadas_2026-07-16_493556.csv',
  'pasadas_2026-07-16_493557.csv'
)
GROUP BY 1;
-- Esperado: 162 + 23 = 185
```

### 2) Apply (+1 day)

```sql
BEGIN;

UPDATE pasadas
SET fecha_hora = fecha_hora + interval '1 day'
WHERE file_upload_name IN (
  'pasadas_2026-07-16_493556.csv',
  'pasadas_2026-07-16_493557.csv'
);

-- Sanity: spot-check debe quedar 2026-07-13 14:13:49
SELECT id, (fecha_hora AT TIME ZONE 'UTC')::text
FROM pasadas
WHERE id = '1851b71d-1cab-42a1-8164-f06ca0beefcb';

-- COMMIT;  -- solo tras validar
-- ROLLBACK;
```

### 3) Post-check vs CSV

Re-correr skill `verification-pasadas-files` con threshold 4 min: mismatches esperados = 0 para esos archivos.

## Fuera de alcance

- Re-import wizard / borrar cargas
- Corregir otros `file_upload_name` sin evidencia de histograma −1 día
- `db push` / repair de historial de migraciones

## Referencias

- Skill: `ibarra-app/.agents/skills/verification-pasadas-files/`
- Módulo: `docs/modulos/peajes.md`
- Fecha util: `peajes-fecha.util.ts`
- Motor: `estrategias-atomicas.ts` (`FORMATEAR_FECHA_HORA`, `COMBINAR_COLUMNAS`)
