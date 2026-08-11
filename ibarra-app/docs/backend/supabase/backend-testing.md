# Backend testing — Peajes

## Summary

Estrategia de verificación SQL (pgTAP) y evidencia en `feature_list.json`. La ejecución corresponde a `backend-tester` / Agente 01–05; este documento fija qué correr.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Notes](#notes)

## Purpose

Alinear comandos de prueba con features F01/F06/F13 y evitar usar DESARROLLO como sustituto de tests.

## Business Logic

### Comandos base

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

### Suites relevantes

| Archivo | Alcance |
|---------|---------|
| `supabase/tests/peajes_f01_test.sql` | RPC carga, NC, tolerancia, duplicados |
| `supabase/tests/peajes_f06_catalogos_plantillas_test.sql` | Catálogos / plantillas |
| `supabase/tests/peajes_ausol_estaciones_aliases_test.sql` | Aliases estaciones |

### Evidencia

Registrar comando + resultado en `feature_list.json` → `evidence[]` y en `docs/claude-progress.md`.

## Notes

- RLS MVP: policies `*_authenticated_all` (PRD §5.2).
- Si la suite global falla por seed AUSOL ajeno, documentar el fallo no bloqueante vs el archivo peajes bajo prueba.

---

> Última actualización: agosto 2026
