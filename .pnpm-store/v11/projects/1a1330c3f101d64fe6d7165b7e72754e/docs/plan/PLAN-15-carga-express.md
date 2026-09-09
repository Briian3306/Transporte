# Vista Express del Asistente de carga de Peajes

Feature `F15-1`: vista de carga para usuarios finales usando empresa y plantilla existentes.

## Flujo

```text
Carga → Estaciones → Factura → Validación condicional → Revisión
```

La ruta `/peajes/carga-express` reutiliza el estado y los componentes de los pasos existentes.
No muestra preview, transformaciones, configuración de plantillas ni mapeo manual. El Paso 8
solo se muestra cuando la validación tiene errores o la diferencia contra factura excede la
tolerancia. El wizard administrativo `/peajes/wizard` no cambia.

## Checklist de implementación

- [x] Shell standalone `PeajesCargaExpressComponent`.
- [x] Reutilización de Pasos 1, 6, 7, 8 y 9.
- [x] Empresa, plantilla y archivo obligatorios.
- [x] Aplicación automática de plantilla.
- [x] Salto automático cuando todas las estaciones están reconocidas.
- [x] Paso 6 visible para recomendaciones o estaciones no resueltas.
- [x] Validación condicional antes de Revisión.
- [x] Ruta `/peajes/carga-express` con `peajes:read`.
- [x] Tarjeta `Carga rápida` en la página del módulo.
- [x] Ejemplo MVP oculto únicamente en Express.
- [ ] Ejecutar suite Angular focalizada con ChromeHeadless sin bloqueos preexistentes.
- [x] Registrar evidencia parcial en `feature_list.json` y `docs/claude-progress.md`.

## Validaciones

```powershell
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
ng test --include="**/peajes/wizard/carga-express/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
ng test --include="**/peajes/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
ng build --configuration=development
git diff --check
```

## Criterios de aceptación

- [ ] El usuario autorizado carga un archivo con empresa y plantilla.
- [ ] No ve transformaciones, mapeo ni configuración.
- [ ] El reconocimiento completo de estaciones evita interacción adicional.
- [ ] Las recomendaciones requieren confirmación en Paso 6.
- [ ] Los errores de validación se muestran antes de permitir confirmar.
- [ ] Una carga válida llega a Revisión y puede confirmarse.

## Evidencia actual

- `npx tsc --noEmit -p tsconfig.app.json`: PASS.
- `npx tsc --noEmit -p tsconfig.spec.json`: PASS.
- `ng build --configuration=development`: bundle generado correctamente en `dist/ibarra-app`; queda warning NG8107 preexistente en Paso 9.
- Test focalizado: el bundle compila, pero Karma no carga por exports faltantes en specs preexistentes de `peajes-home.component` y `permission.guard`.
