# Frontend — Paso 6 y auditoría de estaciones

Complemento de [PLAN_auditoria-reconocimiento-estaciones.md](./PLAN_auditoria-reconocimiento-estaciones.md).

Los tests de Paso 6 cubren la causa informada: tras guardar una relación, destruir/recrear el paso debe conservarla y permitir continuar. Cubren `0001`/`1` hacia `67486ca3-6e88-49a8-b628-7f41e946da5a`; `3`/`0003` hacia `60014adb-62f4-4ad9-86a0-50bd36efd1e3`; y los casos que sí deben reabrir la selección (sin empresa, empresa errónea o Concesión incompatible). Los UUID son solo fixtures.

La auditoría utiliza tabla del patrón Peajes, filtros server-side, carga/error/vacío, detalle expandible y texto en español. Incluye pestañas/filtros de estado: Pendientes, Validados, Descartados, Requieren corrección y Corregidos. `['3','5']` aislado se muestra como contexto válido; el badge de revisión aparece solo cuando el perfil numérico del peaje detecta un hueco o inversión, por ejemplo `1,2,3,5` → falta candidata `4`.

En el detalle el auditor agrega observación y puede validar, descartar o marcar para corregir. Una corrección muestra primero el impacto y exige elegir/confirmar: “solo futuros” (catálogo/alias) o “futuros + movimientos históricos” (solo los movimientos del preview). La auditoría no escribe ni navega el estado de Paso 6; las cargas futuras consumen el catálogo/alias normal ya corregido. El integrador, no 02, conecta ruta, tarjeta y permisos al final.
