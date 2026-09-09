# AUBASA — plantilla FECHA_HORA (HHMMSS + ELIMINAR_IVA)

Fecha: 2026-08-11  
Proyecto: DESARROLLO `kfffigvyvtzyczeiadxh`  
Archivos: `scripts/downloads/AUBASA/pasadas_2026-07-15_5364164.csv` (+ `5364165`)  
Plantilla: **AUBASA-7-2026** (`2dd50d7a-356e-42f4-979b-a383cff54a59` en DESARROLLO, empresa AUBASA)
Fixture/tests: `plantillas/mocks/aubasa.fixture.ts`, `plantillas/motor.spec.ts`

## Problema observado

Carga previa guardó `fecha_hora` con **−1 día** (hora HHMMSS correcta en UTC wall-clock). En Power BI / UI local ART el mismo instante se ve **−3 h**, lo que parece un segundo bug de hora; no lo es.

Ejemplo AG309CO / estación `0001` (DOCK SUD):

| | Valor |
|--|--------|
| CSV | `2026-07-03;114254` |
| Excel `HORA_TRANSFORMADA` | `11:42:54` |
| Esperado | **`2026-07-03 11:42:54`** |
| DB (carga vieja) | `2026-07-02 11:42:54+00` → UI ART `2/7 08:42:54` |

## Decisión de algoritmo

No hay `TRANSFORMAR_HORA`. Usar:

`FORMATEAR_FECHA_HORA` + `formato_hora: HHMMSS` + columnas `[FECHA, HORA]`

Equivale a la fórmula Excel:

`=ENTERO(B2/10000)/24+ENTERO(RESIDUO(B2;10000)/100)/1440+RESIDUO(B2;100)/86400`

Más **`ELIMINAR_IVA`** (÷ 1.21) tras `CALCULAR_IMPORTE_NETO`. Factura de referencia: subtotal `270129.08`, descuento cabecera `2318.63`.

Preferir el CSV **original** (sin columna `HORA_TRANSFORMADA`). El archivo `…_testing.csv` solo sirve como oráculo de hora en tests.

## Pipeline AUBASA-7-2026

| orden | origen | destino | algoritmo |
|------:|--------|---------|-----------|
| 10 | FECHA | FECHA_HORA | FORMATEAR_FECHA_HORA · HHMMSS |
| 20–40 | PATENTE | PATENTE_ID | BORRAR_ESPACIOS → ELIMINAR_GUIONES → CONVERTIR_MAYUSCULAS |
| 50 | DISPOSITIVO | PASE_ID | COPIAR_COLUMNA |
| 60–70 | TARIFA / BONIFICACION | PRECIO / BONIFICACION | CONVERTIR_NUMERO |
| 80 | IMPORTE_NETO | IMPORTE_NETO | CALCULAR_IMPORTE_NETO |
| 90 | IMPORTE_NETO | IMPORTE_NETO | ELIMINAR_IVA |
| 100 | QUANTITY | QUANTITY | ASIGNAR_VALOR = 1 |

Código canónico de prueba: `buildAubasaPlantillaConfigs()` en `src/app/components/peajes/plantillas/mocks/aubasa.fixture.ts`.

## Tests

```powershell
cd ibarra-app
npx ng test --no-watch --browsers=ChromeHeadless --include=**/plantillas/motor.spec.ts
```

Casos: `114254` → `2026-07-03 11:42:54`; `1337` → `00:13:37`; Date UTC midnight sin −1 día; `IMPORTE_NETO = round(13466.55/1.21, 2)`.

## Borrar cargas viejas (antes de re-subir)

Counts esperados previos: `5364164` ≈ 202 pasadas; `5364165` ≈ 31 pasadas.

### Preview

```sql
SELECT file_upload_name, count(*) AS pasadas, count(DISTINCT documento_id) AS docs
FROM pasadas
WHERE file_upload_name IN (
  'pasadas_2026-07-15_5364164.csv',
  'pasadas_2026-07-15_5364165.csv'
)
GROUP BY 1
ORDER BY 1;

SELECT DISTINCT d.id, d.factura, d.fecha_factura, p.file_upload_name
FROM pasadas p
JOIN documentos d ON d.id = p.documento_id
WHERE p.file_upload_name IN (
  'pasadas_2026-07-15_5364164.csv',
  'pasadas_2026-07-15_5364165.csv'
);
```

### Apply (DESARROLLO)

Orden: `pasadas` → `registros_carga_peajes` (auditoría) → `documentos`.  
Sin borrar auditoría, falla `registros_carga_peajes_documento_id_fkey`.

```sql
BEGIN;

CREATE TEMP TABLE tmp_aubasa_docs ON COMMIT DROP AS
SELECT DISTINCT documento_id AS id
FROM pasadas
WHERE file_upload_name IN (
  'pasadas_2026-07-15_5364164.csv',
  'pasadas_2026-07-15_5364165.csv'
);

DELETE FROM pasadas
WHERE file_upload_name IN (
  'pasadas_2026-07-15_5364164.csv',
  'pasadas_2026-07-15_5364165.csv'
);

DELETE FROM registros_carga_peajes r
USING tmp_aubasa_docs t
WHERE r.documento_id = t.id;

DELETE FROM documentos d
USING tmp_aubasa_docs t
WHERE d.id = t.id
  AND NOT EXISTS (SELECT 1 FROM pasadas p WHERE p.documento_id = d.id);

SELECT file_upload_name, count(*)
FROM pasadas
WHERE file_upload_name IN (
  'pasadas_2026-07-15_5364164.csv',
  'pasadas_2026-07-15_5364165.csv'
)
GROUP BY 1;
-- expect 0 rows

COMMIT;
-- ROLLBACK;
```

## Pasos producción (wizard)

1. Ejecutar el DELETE de arriba en DESARROLLO (evita RN-16).
2. `/peajes/wizard` → empresa **AUBASA** → plantilla **AUBASA-7-2026**.
3. Subir `pasadas_2026-07-15_5364164.csv` (y luego `5364165` si aplica).
4. Paso 3: preview AG309CO → `FECHA_HORA = 2026-07-03 11:42:54`; importe sin IVA.
5. Paso 6: `0001` → DOCK SUD (catálogo).
6. Paso 7: subtotal `270129.08`, bonificación de cabecera `2318.63`.
7. Confirmar. Verificar con:

```sql
SELECT pt.patente, e.nombre,
       (p.fecha_hora AT TIME ZONE 'UTC')::text AS fecha_hora_utc, p.precio, p.importe_neto
FROM pasadas p
JOIN patentes pt ON pt.id = p.patente_id
LEFT JOIN estaciones e ON e.id = p.estacion_id
WHERE p.file_upload_name = 'pasadas_2026-07-15_5364164.csv'
  AND pt.patente = 'AG309CO'
  AND (p.fecha_hora AT TIME ZONE 'UTC')::time = time '11:42:54';
-- expect fecha_hora_utc = 2026-07-03 11:42:54
```

No comparar contra columnas Power BI en horario ART.
