# Templates — Backend

Copy the section that applies. Replace `{...}`. Omit non-applicable sections.

**Language:** all content written into `docs/backend/` from these templates must be in **Spanish**. Section headings stay as listed below for consistency.

---

## Universal template (each backend document)

```markdown
# {Título}

## Summary

{2-4 oraciones en español: qué documenta, alcance y módulo.}

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Functions](#functions)
- [Policies](#policies)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

{Problema de negocio que resuelve este artefacto backend.}

## Business Logic

{Flujo paso a paso, reglas de negocio, estados, side effects.}

## Relations

| Entidad / módulo | Relación |
|------------------|----------|
| {tabla o módulo} | {FK, RPC, evento} |

## Tables

| Tabla | Rol |
|-------|-----|
| `{nombre}` | {lectura / escritura / auditoría} |

## Functions

| Función | Tipo | Parámetros | Retorno | Descripción |
|---------|------|------------|---------|-------------|
| `{rpc_name}` | RPC / Edge | `{...}` | `{...}` | {una línea} |

### Detalle: `{nombre_funcion}`

**Ubicación:** `{ruta/archivo.sql}` o `{supabase/functions/nombre/index.ts}`

**Entrada / salida:** {tipos y ejemplos}

**Errores conocidos:** {códigos o mensajes}

## Policies

| Política | Tabla | Rol | Condición |
|----------|-------|-----|-----------|
| {nombre} | `{tabla}` | {authenticated / service_role} | {expresión resumida} |

## Validations

- {Validación en DB, trigger, check constraint o capa Edge}
- {Regla de negocio que rechaza la operación}

## Testing

> Documentar expectativas de verificación. **No ejecutar pruebas** en este skill; usar `backend-tester`.

| Tipo | Archivo / comando esperado | Escenario |
|------|---------------------------|-----------|
| `supabase_db_test` | `supabase/tests/database/{nombre}.test.sql` | {qué validar} |
| `rls_scenario` | — | {roles y acceso esperado} |
| `angular_spec` | `src/app/features/{modulo}/services/{servicio}.spec.ts` | {qué validar} |

**Estado:** pendiente | verificado

**Comando ejecutado:** — (completar con `backend-tester`)

**Resultado:** — (passed / failed)

**Evidencia:** — (`feature_list.json` → `evidence[]`)

## Notes

- Código fuente: `{ruta}`
- Doc relacionada: [{título}](./ruta.md)
- Handoff: invocar `backend-tester` para ejecutar la sección Testing

---

> Última actualización: {mes año}
```

---

## Template: `functions/index.md` (RPC catalog)

```markdown
# RPC Functions — Resumen

## Summary

Catálogo de funciones RPC Postgres usadas por la aplicación. Detalle en cada módulo.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Notes](#notes)

## Purpose

Índice rápido de RPC; evita duplicar lógica de negocio aquí.

## Business Logic

—

## Relations

—

## Tables

—

## Functions

| RPC | Módulo | Propósito | Detalle |
|-----|--------|-----------|---------|
| `{rpc_name}` | pedidos | {una línea} | [../pedidos/{doc}.md](../pedidos/{doc}.md) |

## Policies

—

## Validations

—

## Testing

—

## Notes

- Scripts: `supabase/functions/`, `sql/`, `docs/08-sql/`, `docs/08 - SQLs/`
- Verificación: sección **Testing** en cada doc de detalle del módulo
```

---

## Template: `functions/edge/index.md`

```markdown
# Edge Functions — Resumen

## Summary

Funciones Deno desplegadas en Supabase Edge.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Notes](#notes)

## Purpose

Punto de entrada HTTP / webhooks / exportaciones fuera de RPC SQL.

## Business Logic

—

## Relations

—

## Tables

—

## Functions

| Función | Ruta | Trigger | Auth | Detalle |
|---------|------|---------|------|---------|
| `{nombre}` | `supabase/functions/{nombre}/` | {HTTP / cron} | {JWT / anon} | [../api/{doc}.md](../api/{doc}.md) |

## Policies

—

## Validations

—

## Testing

—

## Notes

- Invocar `backend-tester` tras documentar contratos request/response y completar **Testing**
```

---

## Template: `index.md` (any folder)

```markdown
# Índice — {Nombre sección}

## Summary

Esta carpeta agrupa {tema}.

## Index

- [Documentos](#documentos)
- [Subcarpetas](#subcarpetas)

## Purpose

—

## Business Logic

—

## Relations

—

## Tables

—

## Functions

—

## Policies

—

## Validations

—

## Testing

—

## Notes

### Documentos

| Documento | Descripción |
|-----------|-------------|
| [{ARCHIVO}.md](./{ARCHIVO}.md) | {una línea} |

### Subcarpetas

| Carpeta | Descripción |
|---------|-------------|
| [{sub}/](./{sub}/) | {contenido} |
```
