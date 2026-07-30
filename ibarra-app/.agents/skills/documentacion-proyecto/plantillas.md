# Plantillas de documentación

Copiar la plantilla que corresponda. Reemplazar placeholders `{...}`. Mantener secciones vacías con "—" o eliminarlas si no aplican.

---

## Plantilla universal (base)

```markdown
# {Título del documento}

## Resumen

{2-4 oraciones: qué documenta este archivo, propósito y alcance.}

## Índice

- [Resumen](#resumen)
- [Funcionalidad](#funcionalidad)
- [Detalle](#detalle)
- [Ejemplos](#ejemplos)
- [Referencias](#referencias)

---

## Funcionalidad

{Descripción operativa: qué problema resuelve, comportamiento principal, integraciones.}

### Entradas

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| {input} | {tipo} | Sí/No | {descripción} |

### Salidas / eventos

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| {output} | {tipo} | {descripción} |

---

## Detalle

{Secciones específicas según tipo: arquitectura, casos de test, columnas SQL, etc.}

---

## Ejemplos

```{lenguaje}
// Ejemplo mínimo funcional
```

---

## Referencias

- Código fuente: `{ruta/archivo.ts}`
- Documentación relacionada: [{otro doc}](./ruta.md)

---

> Última actualización: {mes año}
```

---

## Plantilla: Tests (`01-tests`)

```markdown
# Tests — {Nombre del servicio o feature}

## Resumen

Documentación de los tests {unitarios|de integración} de `{ClaseService}` ubicado en `{ruta}`. Cubre {N} casos que validan {breve lista}.

## Índice

- [Resumen](#resumen)
- [Funcionalidad](#funcionalidad)
- [Archivo bajo prueba](#archivo-bajo-prueba)
- [Casos de prueba](#casos-de-prueba)
- [Ejecución](#ejecución)
- [Mocks y dependencias](#mocks-y-dependencias)
- [Referencias](#referencias)

---

## Funcionalidad

Los tests verifican que `{Servicio}` cumple con:

1. {Responsabilidad 1}
2. {Responsabilidad 2}

---

## Archivo bajo prueba

| Propiedad | Valor |
|-----------|-------|
| Ruta | `src/app/features/{dominio}/services/{servicio}.spec.ts` |
| Servicio | `{Servicio}` |
| Tipo de test | Unitario |

---

## Casos de prueba

| # | Método | Entrada | Salida esperada | Estado |
|---|--------|---------|-----------------|--------|
| 1 | `loadItems()` | `{ usuarioId: 1 }` | Array con pedidos del usuario | ✅ |
| 2 | `createItem()` | `{ ...payload }` | Pedido creado con id | ✅ |

### Detalle por caso

#### TEST 1: `{nombreDescriptivo}`

**Objetivo**: {qué valida}

**Entrada**:
```typescript
{entrada}
```

**Salida esperada**:
```typescript
{salida}
```

---

## Ejecución

```bash
# Todos los tests del dominio
ng test --include=**/{servicio}.spec.ts

# Un test específico (si aplica)
ng test --include=**/{servicio}.spec.ts --grep="{patrón}"
```

---

## Mocks y dependencias

| Dependencia | Mock | Motivo |
|-------------|------|--------|
| `HttpClient` | `HttpClientTestingModule` | Aislar llamadas HTTP |
| `{OtroServicio}` | `jasmine.createSpyObj` | {motivo} |

---

## Referencias

- [Índice de tests del dominio](./INDEX.md)
- [TESTING_GUIDE.md](../TESTING_GUIDE.md)

---

> Última actualización: {mes año}
```

---

## Plantilla: Componente (`06-components`)

```markdown
# Guía — {NombreComponente}

## Resumen

`{NombreComponente}` (`{app-selector}`) es un componente {standalone} en `src/app/shared/{carpeta}/` que {propósito en una frase}.

## Índice

- [Resumen](#resumen)
- [Funcionalidad](#funcionalidad)
- [API del componente](#api-del-componente)
- [Ejemplos de uso](#ejemplos-de-uso)
- [Notas y buenas prácticas](#notas-y-buenas-prácticas)
- [Referencias](#referencias)

---

## Funcionalidad

{Descripción del comportamiento, cuándo usarlo vs alternativas en shared.}

---

## API del componente

### Inputs

| Input | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `{nombre}` | `{tipo}` | `{default}` | {descripción} |

### Outputs

| Output | Tipo | Descripción |
|--------|------|-------------|
| `{nombre}` | `{tipo}` | {descripción} |

---

## Ejemplos de uso

### TypeScript

```typescript
import { {NombreComponente} } from 'src/app/shared/{carpeta}/{archivo}.component';

@Component({
  standalone: true,
  imports: [{NombreComponente}],
  // ...
})
export class MiFeatureComponent {}
```

### Template

```html
<{app-selector}
  [{input}]="{valor}"
  ({output})="{manejador}($event)"
/>
```

---

## Notas y buenas prácticas

- {Nota 1}
- {Nota 2}

---

## Referencias

- Código: `src/app/shared/{carpeta}/{archivo}.component.ts`
- Skill de UI: `frontend-design-angular`

---

> Última actualización: {mes año}
```

---

## Plantilla: Tabla (`06-tablas`)

```markdown
# Guía — {NombreTabla}

## Resumen

`{app-selector}` documenta el uso de la tabla {genérica|big-data|dominio} para {caso de uso}. {Volumen de datos esperado y modo de carga}.

## Índice

- [Resumen](#resumen)
- [Funcionalidad](#funcionalidad)
- [Cuándo usar esta tabla](#cuándo-usar-esta-tabla)
- [Configuración](#configuración)
- [Eventos](#eventos)
- [Ejemplo completo](#ejemplo-completo)
- [Referencias](#referencias)

---

## Funcionalidad

{Qué muestra, cómo filtra, pagina, selecciona o exporta.}

---

## Cuándo usar esta tabla

| Escenario | Usar | Alternativa |
|-----------|------|-------------|
| &lt; 500 filas en memoria | `table-generic` | — |
| Lazy loading / servidor | `table-generic-ng-big-data` | — |
| {Caso dominio} | `{esta tabla}` | `{otra}` |

---

## Configuración

### Columnas

```typescript
columns = [
  { field: '{campo}', header: '{encabezado}', filterable: true },
];
```

### Inputs principales

| Input | Tipo | Descripción |
|-------|------|-------------|
| `data` | `{tipo}` | {descripción} |
| `lazy` | `boolean` | {descripción} |

---

## Eventos

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `onLazyLoad` | `{ first, rows, ... }` | Cambio de página o filtro (modo lazy) |

---

## Ejemplo completo

{HTML + TS del consumidor en un feature real o ficticio mínimo.}

---

## Referencias

- Componente: `src/app/shared/tables/{carpeta}/`
- README interno: `src/app/shared/tables/{carpeta}/README.md`

---

> Última actualización: {mes año}
```

---

## Plantilla: SQL (`08-sql`)

```markdown
# SQL — {Descripción breve}

## Resumen

Script `{numero}_{descripcion}.sql` que {crea|modifica|elimina} {objeto} en la base de datos para soportar {feature}.

## Índice

- [Resumen](#resumen)
- [Funcionalidad](#funcionalidad)
- [Objetos afectados](#objetos-afectados)
- [Script](#script)
- [Migración](#migración)
- [Referencias](#referencias)

---

## Funcionalidad

{Qué cambio de esquema o datos introduce y por qué.}

---

## Objetos afectados

| Objeto | Tipo | Acción |
|--------|------|--------|
| `{tabla}` | Tabla | CREATE / ALTER |

### Columnas ({tabla})

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `{col}` | `{tipo}` | No | {descripción} |

---

## Script

Ver archivo: [152_table_condiciones_pago.sql](./152_table_condiciones_pago.sql)

```sql
-- Fragmento relevante o script completo
```

---

## Migración

1. {Paso 1 — backup}
2. {Paso 2 — ejecutar script}
3. {Paso 3 — verificación}

---

## Referencias

- Feature relacionada: `{ruta en src/app/features/}`
- PRD: [PRD-OrdenCompraIbarra.md](../PRD-OrdenCompraIbarra.md)

---

> Última actualización: {mes año}
```

---

## Plantilla: INDEX.md (cualquier carpeta)

```markdown
# Índice — {Nombre de la sección}

## Resumen

Esta carpeta agrupa la documentación de {tema}: {lista breve}.

## Índice

- [Documentos](#documentos)
- [Subcarpetas](#subcarpetas)

---

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [{ARCHIVO}.md](./{ARCHIVO}.md) | {una línea} |

---

## Subcarpetas

| Carpeta | Descripción |
|---------|-------------|
| [{subcarpeta}/](./{subcarpeta}/) | {contenido} |

---

> Última actualización: {mes año}
```
