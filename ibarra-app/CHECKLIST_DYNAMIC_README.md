# Sistema de Checklists Dinámicos - Ibarra App

## Descripción

Sistema completo de checklists dinámicos implementado en Angular con integración a Supabase. Permite crear, gestionar y ejecutar checklists de inspección vehicular con validación en tiempo real.

## Características Principales

### ✅ Funcionalidades Implementadas

1. **Plantillas Predefinidas**
   - Inspección Diaria (Secciones 1-4)
   - Inspección Parcial (Secciones 5-7) 
   - Inspección Completa (Todas las secciones)

2. **Sistema de Validación**
   - Validación en tiempo real
   - Tipos de validación: Sí/No/N/A, Bueno/Regular/Malo, Valores numéricos
   - Estados visuales: Error, Advertencia, Correcto, Pendiente

3. **Interfaz de Usuario**
   - Diseño responsive con Tailwind CSS
   - Botones táctiles optimizados para móviles
   - Modales para observaciones y descripciones detalladas
   - Barra de progreso en tiempo real

4. **Integración con Supabase**
   - Guardado automático de checklists
   - Carga de datos de logística
   - Gestión de plantillas personalizadas

5. **Funcionalidades Avanzadas**
   - Carga de datos desde sistema de logística
   - Observaciones por item
   - Descripciones detalladas
   - Filtrado y búsqueda
   - Exportación de datos

## Estructura del Proyecto

```
ibarra-app/src/app/
├── components/
│   ├── checklist-dynamic/          # Componente principal del checklist
│   │   ├── checklist-dynamic.component.ts
│   │   ├── checklist-dynamic.component.html
│   │   └── checklist-dynamic.component.scss
│   └── template-list/              # Lista de plantillas
├── models/
│   ├── checklist-template.model.ts # Modelos de plantillas
│   ├── checklist.model.ts         # Modelos de checklists
│   └── vehiculo.model.ts          # Modelos de vehículos
├── services/
│   ├── checklist-dynamic.service.ts # Servicio principal
│   └── supabase.service.ts        # Servicio de Supabase
└── app.routes.ts                  # Configuración de rutas
```

## Configuración

### 1. Variables de Entorno

Configurar en `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'TU_SUPABASE_URL',
  supabaseKey: 'TU_SUPABASE_ANON_KEY'
};
```

### 2. Base de Datos Supabase

Ejecutar el script SQL en Supabase:

```bash
# Usar el archivo supabase-setup-updated.sql
psql -h TU_HOST -U postgres -d postgres -f supabase-setup-updated.sql
```

### 3. Instalación de Dependencias

```bash
cd ibarra-app
npm install
```

### 4. Ejecutar la Aplicación

```bash
ng serve
```

## Uso del Sistema

### Navegación

1. **Página Principal** (`/templates`)
   - Muestra plantillas predefinidas y personalizadas
   - Botones para iniciar checklists

2. **Checklist Dinámico** (`/checklist/:templateId`)
   - Interfaz principal para completar checklists
   - Validación en tiempo real
   - Guardado automático

### Flujo de Trabajo

1. **Seleccionar Plantilla**
   - Desde la página principal
   - Plantillas predefinidas o personalizadas

2. **Completar Información**
   - Fecha y hora
   - Datos del chofer
   - Patentes del vehículo

3. **Cargar Datos** (Opcional)
   - Botón para cargar desde sistema de logística
   - Filtrado por chofer y patente

4. **Completar Items**
   - Seleccionar opciones según tipo de validación
   - Agregar observaciones por item
   - Ver descripciones detalladas

5. **Validar y Guardar**
   - Validación automática en tiempo real
   - Resumen de errores y advertencias
   - Guardado en Supabase

## Tipos de Validación

### 1. Sí/No/N/A
```typescript
{
  tipoValidacion: 'si_no_na',
  comportamiento: 'genera_error',
  esObligatorio: true,
  configuracion: { valoresError: ['no'] }
}
```

### 2. Bueno/Regular/Malo
```typescript
{
  tipoValidacion: 'bueno_regular_malo',
  comportamiento: 'genera_error',
  esObligatorio: true,
  configuracion: { valoresError: ['malo', 'regular'] }
}
```

### 3. Valores Numéricos
```typescript
{
  tipoValidacion: 'valor_min_max',
  comportamiento: 'genera_error',
  esObligatorio: true,
  configuracion: { 
    valorMinimo: 80, 
    valorMaximo: 120, 
    generarErrorFueraRango: true 
  }
}
```

## API del Servicio

### ChecklistDynamicService

#### Métodos Principales

```typescript
// Obtener plantillas
getPlantilla(tipo: string): ChecklistTemplate | null
getPlantillaCompleta(): ChecklistTemplate
getPlantillasDisponibles(): ChecklistTemplate[]

// Validación
validarItem(item: ChecklistItem, valor: string): ValidationResult
validarChecklist(template: ChecklistTemplate, respuestas: ChecklistResponse): ChecklistValidationSummary

// Progreso
calcularProgreso(template: ChecklistTemplate, respuestas: ChecklistResponse): ChecklistProgress

// Datos
cargarDatosLogistica(): Promise<UnidadLogistica[]>

// Guardado
guardarChecklist(template: ChecklistTemplate, formData: ChecklistFormData, respuestas: ChecklistResponse, observaciones: ChecklistObservation): Promise<Checklist>
```

## Personalización

### Agregar Nuevos Tipos de Validación

1. Actualizar el enum `ValidationType` en `checklist-template.model.ts`
2. Agregar lógica en `validarItem()` del servicio
3. Actualizar el template HTML para el nuevo tipo

### Agregar Nuevas Plantillas

1. Crear plantilla en `plantillasPredefinidas` del servicio
2. Agregar caso en `getPlantilla()`
3. Actualizar la interfaz de selección

## Troubleshooting

### Problemas Comunes

1. **Error de conexión a Supabase**
   - Verificar variables de entorno
   - Comprobar políticas de RLS

2. **Validaciones no funcionan**
   - Verificar configuración de items
   - Comprobar tipos de validación

3. **Datos no se cargan**
   - Verificar estructura de base de datos
   - Comprobar consultas SQL

### Logs de Debug

```typescript
// Habilitar logs detallados
console.log('Checklist data:', this.respuestas);
console.log('Validation result:', resultado);
console.log('Progress:', this.progreso);
```

## Próximas Mejoras

- [ ] Exportación a PDF
- [ ] Historial de checklists
- [ ] Dashboard de estadísticas
- [ ] Notificaciones push
- [ ] Modo offline
- [ ] Sincronización automática

## Soporte

Para soporte técnico o reportar bugs, contactar al equipo de desarrollo.

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2025
