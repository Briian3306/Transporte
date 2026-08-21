# Auditoría de estaciones (F16)

Bandeja `/peajes/auditoria-estaciones`: tabla padre (estación), detalle con códigos, **Asignar estado** (validar / descartar / corregir) y **Ver casos** (pasadas con esa `estacion_id`, mismo diálogo que tarifas).

Paso 6 restaura `relacionesEstacion` por clave canónica (`0001` = `1`). La auditoría no escribe el wizard; una corrección confirmada actualiza catálogo y, si se elige, las pasadas del preview.

Hallazgos: `['3','5']` aislado no alarma; `1,2,3,5` con perfil secuencial marca hueco `4`.
