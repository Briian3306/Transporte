# Task 7 local parity report

Generated: 2026-09-08T16:55:55.261Z

| Metric | Count |
|---|---|
| legacy_links | 8406 |
| v2_links | 7533 |
| unmapped | 873 |
| current_pointer_mismatches | 0 |
| price_comparison_mismatches | 0 |
| null_current_pointers | 0 |
| lineage_1n_mismatches | 0 |
| lineage_id_mismatches | 0 |
| pointer_parent_mismatches | 0 |
| tarifas_without_staged_precio_last | 50 |
| sentido_id_collisions_remapped | 27 |
| tn_unique_key_lineage_skipped | 8 |

## Notes

Workbook: C:\Users\FRANCIS\Documents\progamacion\Transporte\ibarra-app\scripts\peajes-catalogo-audit\out\tarifario-last-cruzado.xlsx

tarifas loaded: 546; tarifa_importe loaded: 1282; staged PRECIO_LAST: 496.

sentido ID collisions remapped (Wave 0 id omits sentido): 27 (explained; VUELTA gets a new parent id, history stays on original).

TN unique-key lineage stubs skipped: 8 (explained; tarifas_normalizadas unique is peaje+estacion+categoria+importe and does not include PICO/NO_PICO).

pasadas counts reflect the local CLI database after db reset --no-seed plus this catalog load (empty pasadas unless separately seeded).

Did not overwrite auditoria-catalogo-20260904.xlsx.

## Unexplained mismatches (cutover blockers)

None.
