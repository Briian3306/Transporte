# PRD — Module Automation Tool

## 1. Descripción

**Module Automation Tool** es un módulo web para automatizar la importación y procesamiento de archivos de pasadas de peajes.

El sistema permite cargar archivos Excel provenientes de diferentes proveedores, transformar sus datos, relacionarlos con una estructura estándar, asociarlos a facturas o notas de crédito y almacenarlos en Supabase.

El módulo estará integrado dentro de la aplicación existente de Transporte Ibarra bajo la ruta:

`/peajes`

---

# 2. Objetivo

Automatizar el proceso de carga de información de peajes para reducir tareas manuales y obtener datos estandarizados que puedan utilizarse posteriormente en Power BI.

El sistema deberá permitir:

* Importar archivos Excel.
* Transformar columnas.
* Mapear columnas del proveedor con columnas internas.
* Identificar patentes, pases, peajes y estaciones.
* Asociar pasadas con facturas o notas de crédito.
* Validar los datos antes de guardarlos.
* Reutilizar configuraciones mediante plantillas.
* Guardar los resultados en Supabase.

---

# 3. Usuario principal

## Analista

El usuario podrá:

* Cargar archivos.
* Configurar transformaciones.
* Relacionar columnas.
* Resolver estaciones y peajes.
* Completar información de facturación.
* Revisar errores.
* Confirmar la importación.

---

# 4. Flujo principal

El sistema utilizará un **wizard paso a paso**.

```text
1. Cargar archivo
       ↓
2. Previsualizar datos
       ↓
3. Transformar columnas
       ↓
4. Aplicar plantilla
       ↓
5. Mapear columnas
       ↓
6. Relacionar estaciones
       ↓
7. Completar factura
       ↓
8. Validar
       ↓
9. Revisar y guardar
```

El usuario podrá volver a pasos anteriores sin perder la configuración realizada.

---

# 5. Carga de archivos

El sistema deberá aceptar:

* `.xlsx`
* CSV compatibles

Después de cargar el archivo se mostrará:

* Nombre del archivo.
* Cantidad de registros.
* Columnas detectadas.
* Primeras 10 filas.
* Posibles errores.

Existirán dos modos de importación:

### Importación simple

El archivo corresponde a una única factura o documento.

### Importación masiva

Permite procesar varias facturas desde el mismo archivo.

Para utilizar este modo deberá existir la columna:

`FACTURA`

Cada número diferente de `FACTURA` será procesado como un documento independiente.

---

# 6. Transformación de datos

El usuario podrá aplicar transformaciones sobre las columnas.

Ejemplos:

* Eliminar espacios.
* Convertir texto a número.
* Convertir texto a fecha.
* Combinar fecha y hora.
* Normalizar patentes.
* Reemplazar valores.
* Convertir texto a mayúsculas.
* Concatenar columnas.

Las transformaciones deberán ejecutarse en el orden configurado.

Ejemplo:

```text
FECHA + HORA
      ↓
COMBINAR_FECHA_HORA
      ↓
FECHA_HORA
```

---

# 7. Plantillas

El usuario podrá guardar una configuración como **plantilla**.

Una plantilla podrá almacenar:

* Empresa.
* Columnas utilizadas.
* Transformaciones.
* Mapeos.
* Relaciones de estaciones.
* Reglas necesarias para importar el archivo.

Cuando una plantilla sea compatible con un nuevo archivo, el sistema podrá aplicar automáticamente la configuración.

```text
Archivo
   +
Plantilla
   ↓
Transformaciones automáticas
   ↓
Mapeo automático
   ↓
Reconocimiento de estaciones
```

Si existe algún problema, el sistema deberá detenerse en el paso correspondiente para que el usuario lo corrija.

---

# 8. Mapeo de columnas

Las columnas del archivo deberán relacionarse con la estructura interna.

Ejemplo:

| Archivo      | Sistema        |
| ------------ | -------------- |
| Dominio      | `PATENTE_ID`   |
| Dispositivo  | `PASE_ID`      |
| Fecha + Hora | `FECHA_HORA`   |
| Estación     | `ESTACION_ID`  |
| Tarifa       | `PRECIO`       |
| Importe      | `IMPORTE_NETO` |

El sistema no permitirá continuar cuando falten campos obligatorios.

---

# 9. Peajes y estaciones

Cada pasada estará relacionada con una estación.

```text
PASADA
   ↓
ESTACION
   ↓
PEAJE
```

Por lo tanto:

```text
PASADA.ESTACION_ID → ESTACION.ID
ESTACION.PEAJE_ID → PEAJE.ID
```

Cuando el archivo tenga una columna:

`Concesion`

se utilizará para identificar el peaje.

El flujo será:

```text
EMPRESA
   ↓
Concesion
   ↓
PEAJE
   ↓
ESTACIONES
```

El sistema deberá recomendar solamente estaciones relacionadas con ese peaje.

---

# 10. Facturas y notas de crédito

Cada grupo de pasadas deberá relacionarse con un documento.

Tipos soportados:

* `FC` → Factura
* `NC` → Nota de crédito

Información mínima:

| Campo        | Descripción         |
| ------------ | ------------------- |
| FACTURA      | Número de documento |
| TIPO         | FC / NC             |
| EMPRESA      | Empresa             |
| FECHA        | Fecha del documento |
| SUBTOTAL     | Importe sin IVA     |
| PERCEPCIONES | Percepciones        |
| IVA          | IVA                 |
| TOTAL        | Importe total       |

En una nota de crédito los importes deberán almacenarse con signo negativo.

---

# 11. Estructura de una pasada

Cada pasada tendrá:

| Campo          | Descripción         |
| -------------- | ------------------- |
| `PASADA_ID`    | Identificador único |
| `FECHA_HORA`   | Fecha y hora        |
| `PASE_ID`      | Pase o dispositivo  |
| `PATENTE_ID`   | Vehículo            |
| `ESTACION_ID`  | Estación            |
| `PRECIO`       | Tarifa              |
| `BONIFICACION` | Descuento           |
| `QUANTITY`     | Cantidad            |
| `IMPORTE_NETO` | Importe final       |

La fórmula general será:

```text
IMPORTE_NETO = PRECIO - BONIFICACION
```

Para una pasada individual:

```text
QUANTITY = 1
```

---

# 12. Validaciones

Antes de guardar, el sistema deberá validar:

* Campos obligatorios.
* Fecha y hora válidas.
* Patentes válidas.
* Estaciones relacionadas.
* Valores numéricos.
* Duplicados.
* Importes.
* Signos de FC y NC.
* Relación entre factura y pasadas.

Los errores deberán clasificarse como:

### Error

Impide continuar.

### Advertencia

Permite continuar después de revisar.

### Información

Solo comunica un resultado.

---

# 13. Prevención de duplicados

Una posible clave para identificar una pasada duplicada será:

```text
PASE_ID
+
FECHA_HORA
+
ESTACION_ID
+
PATENTE_ID
```

La hora deberá conservarse completa para evitar considerar como duplicadas dos pasadas realizadas el mismo día.

---

# 14. Validación contra factura

La suma de los importes de las pasadas deberá compararse contra el subtotal informado en el documento.

```text
Total calculado =
SUM(IMPORTE_NETO) - BONIFICACION_DOCUMENTO
```

El sistema podrá utilizar una tolerancia aproximada del:

```text
1 % del subtotal
```

Si la diferencia supera la tolerancia, deberá mostrarse un error o advertencia.

---

# 15. Importación masiva

Cuando existan varias facturas en un mismo archivo:

```text
FACTURA 001
 ├── Pasada
 ├── Pasada
 └── Pasada

FACTURA 002
 ├── Pasada
 └── Pasada
```

La interfaz mostrará cada factura en un panel independiente.

El usuario podrá:

* Revisar cada documento.
* Corregir información.
* Omitir documentos con errores.
* Importar solamente los documentos válidos.

Un error en una factura no deberá impedir guardar las demás.

---

# 16. Persistencia

La información se almacenará en Supabase/PostgreSQL.

Entidades principales:

```text
EMPRESA
   │
   ├── PEAJES
   │      └── ESTACIONES
   │             └── PASADAS
   │
   └── DOCUMENTOS
          └── PASADAS

PATENTES
   └── PASES
          └── PASADAS
```

Tablas principales:

* `empresas`
* `documentos`
* `patentes`
* `pases`
* `peajes`
* `estaciones`
* `pasadas`
* `plantillas_configuracion`

---

# 17. Requisitos principales del MVP

El MVP deberá permitir:

1. Cargar Excel.
2. Previsualizar datos.
3. Transformar columnas.
4. Mapear columnas.
5. Guardar y aplicar plantillas.
6. Identificar peajes y estaciones.
7. Registrar facturas y notas de crédito.
8. Validar pasadas.
9. Detectar duplicados.
10. Procesar varias facturas por archivo.
11. Guardar información en Supabase.
12. Preparar la información para Power BI.

---

# 18. Fuera del alcance inicial

No es necesario para el MVP:

* Leer automáticamente facturas PDF.
* Integrarse directamente con APIs de proveedores.
* Procesamiento programado.
* Aplicación móvil.
* Modificación masiva después de importar.
* Versionado avanzado de plantillas.

---

# 19. Criterio de éxito

El proceso será considerado exitoso cuando un usuario pueda:

```text
Archivo del proveedor
        ↓
Transformación
        ↓
Normalización
        ↓
Factura + Pasadas
        ↓
Validación
        ↓
Supabase
        ↓
Power BI
```

sin tener que modificar manualmente el archivo original para cada proveedor.

## Resultado esperado

Convertir archivos de peajes con diferentes formatos en una estructura estándar, confiable y reutilizable para análisis de costos y facturación.
