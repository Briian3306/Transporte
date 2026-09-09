# Verification Pasadas ↔ Files — Reference

## ConsumosResumen column map

| Excel / CSV | DB / join |
|-------------|-----------|
| `Dominio` | `patentes.patente` |
| `Tag Nº` | `pases.pase` |
| `FACTURA` | `documentos.factura` |
| `Estación` | `estaciones.nombre` (fuzzy; names may differ slightly) |
| `Fecha` | `pasadas.fecha_hora` (timestamptz, compare UTC wall-clock) |
| `Importe Final` / `Importe Original` | `pasadas.precio` (optional) |
| (load metadata) | `pasadas.file_upload_name` |

## Why Δ ≈ 48s is common

Excel serial fractional seconds vs Postgres storage often differ by under one minute. Default threshold **4 minutes** ignores that noise.

## Why false +180 minute diffs appear

If `Date.parse('2026-06-26 18:37:39')` runs in ART without forcing `Z`, the engine treats the string as **local** time. Compared to a true UTC wall-clock from the Excel serial, every row looks ~3 hours off. Always force UTC when parsing comparison strings.

## Sample read-only counts

```sql
SELECT file_upload_name, count(*)
FROM pasadas
WHERE file_upload_name ILIKE '%ConsumosResumen%'
GROUP BY 1
ORDER BY 2 DESC;
```

## Spot-check one patente

```sql
SELECT p.fecha_hora, pt.patente, pa.pase, d.factura, e.nombre
FROM pasadas p
JOIN patentes pt ON pt.id = p.patente_id
JOIN pases pa ON pa.id = p.pase_id
JOIN documentos d ON d.id = p.documento_id
JOIN estaciones e ON e.id = p.estacion_id
WHERE pt.patente = '<PATENTE>'
  AND p.file_upload_name = '<FILE>'
ORDER BY p.fecha_hora;
```
