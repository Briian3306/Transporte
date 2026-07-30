# Índice — Componentes Peajes

## Resumen

Documentación de UI y servicios del módulo Peajes implementados en Fase 1 (F02, F03 `passing`; servicios F01 listos). El home y las rutas hijas fusionadas siguen pendientes del Agente 05.

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [wizard.md](./wizard.md) | Asistente de carga (pasos 1–9), estado y Excel |
| [catalogos.md](./catalogos.md) | CRUD UI peajes / estaciones / patentes / pases |
| [plantillas-y-algoritmos.md](./plantillas-y-algoritmos.md) | Motor Builder/Strategy + UI plantillas |
| [servicios-y-providers.md](./servicios-y-providers.md) | Contratos, mocks actuales y swap a Supabase |

## Verificación UI (evidencia Fase 1)

```text
ng build --configuration=development → OK
ng test … peajes/wizard + peajes/catalogos → 12 SUCCESS
npx tsx src/app/components/peajes/plantillas/motor.verify.ts → PASS (§21 motor)
```

---

> Última actualización: julio 2026
