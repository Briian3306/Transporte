# Task 7 local parity report

Generated: 2026-10-06T17:21:11.509Z

| Metric | Count |
|---|---|
| legacy_links | 8406 |
| v2_links | 8325 |
| unmapped | 81 |
| current_pointer_mismatches | 0 |
| price_comparison_mismatches | 0 |
| null_current_pointers | 27 |
| expected_null_current_pointers | 27 |
| unexpected_null_current_pointers | 0 |
| lineage_1n_mismatches | 0 |
| lineage_id_mismatches | 0 |
| pointer_parent_mismatches | 0 |
| tarifas_without_staged_precio_last | 95 |
| sentido_id_collisions_remapped | 27 |
| tn_unique_key_lineage_skipped | 8 |

## Notes

Workbook: C:\Users\FRANCIS\Documents\progamacion\Transporte\ibarra-app\scripts\peajes-catalogo-audit\out\tarifario-last-cruzado.xlsx

tarifas loaded: 546; tarifa_importe loaded: 1255; staged PRECIO_LAST: 469.

sentido ID collisions remapped: 27; unresolved directionless histories: 27. Their remapped rows intentionally retain NULL current pointers because the source has no direction-specific amount. These are reported for manual review and excluded from local seed blockers; no Cruzado amount is cloned across directions.

TN unique-key lineage stubs skipped: 8 (explained; tarifas_normalizadas unique is peaje+estacion+categoria+importe and does not include PICO/NO_PICO).

pasadas counts reflect the local CLI database after db reset --no-seed plus this catalog load (empty pasadas unless separately seeded).

Did not overwrite auditoria-catalogo-20260904.xlsx.

Known source-data cases requiring review (not local seed failures):
- directional_history_collisions=27

## Unexplained mismatches (cutover blockers)

None.
