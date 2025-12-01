# Componente de Configuración de Templates de Checklist

## Descripción

El componente `TemplateConfigComponent` permite crear, editar y gestionar plantillas de checklist de manera dinámica. Está basado en el archivo HTML existente `configuracion-checklist.html` pero implementado como un componente Angular reutilizable.

## Características Principales

### 1. Gestión de Secciones
- **Agregar secciones**: Crear nuevas secciones con títulos personalizados
- **Eliminar secciones**: Remover secciones y todos sus ítems asociados
- **Seleccionar sección**: Activar una sección para editar sus ítems

### 2. Gestión de Ítems
- **Crear ítems**: Agregar nuevos ítems a las secciones
- **Editar ítems**: Modificar ítems existentes
- **Eliminar ítems**: Remover ítems específicos
- **Validación configurable**: Diferentes tipos de validación por ítem

### 3. Tipos de Validación Soportados
- **Sin validación**: Ítem informativo sin restricciones
- **Sí/No**: Validación binaria simple
- **Sí/No/N/A**: Validación ternaria con opción "No Aplica"
- **Valor Min/Max**: Validación numérica con rangos
- **Cantidad**: Validación de cantidades numéricas
- **Bueno/Regular/Malo**: Evaluación cualitativa
- **Personalizado**: Opciones definidas por el usuario

### 4. Configuración de Comportamiento
- **Generar error**: Marcar como error si no cumple validación
- **Solo advertencia**: Mostrar advertencia sin bloquear
- **Sin validación**: No aplicar restricciones

## Uso

### Navegación
```typescript
// Crear nueva plantilla
this.router.navigate(['/template-config']);

// Editar plantilla existente
this.router.navigate(['/template-config', templateId]);
```

### Servicios Utilizados
- `ChecklistTemplateService`: Para operaciones CRUD con Supabase
- `FormBuilder`: Para formularios reactivos
- `Router`: Para navegación entre componentes

## Estructura del Componente

### Archivos
- `template-config.component.ts`: Lógica del componente
- `template-config.component.html`: Template HTML
- `template-config.component.scss`: Estilos CSS

### Modelos Utilizados
- `ChecklistTemplate`: Estructura principal de la plantilla
- `ChecklistSection`: Secciones dentro de la plantilla
- `ChecklistItem`: Ítems individuales
- `ValidationConfig`: Configuración de validación

## Funcionalidades Implementadas

### ✅ Gestión de Secciones
- [x] Agregar sección
- [x] Eliminar sección
- [x] Seleccionar sección activa
- [x] Visualización de secciones

### ✅ Gestión de Ítems
- [x] Formulario de edición de ítems
- [x] Validación de formularios
- [x] Configuración de tipos de validación
- [x] Gestión de valores de error
- [x] Agregar/editar/eliminar ítems

### ✅ Gestión de Plantillas
- [x] Crear nueva plantilla
- [x] Cargar plantilla existente
- [x] Guardar plantilla
- [x] Modal de nueva plantilla
- [x] Descarga de respaldo JSON

### ✅ Integración con Backend
- [x] Conexión con Supabase
- [x] Operaciones CRUD
- [x] Manejo de errores
- [x] Estados de carga

## Configuración de Validación

### Valores que Generan Error
El componente permite seleccionar qué valores específicos deben generar errores:

```typescript
// Para Sí/No/N/A
valoresError: ['no', 'na']

// Para Bueno/Regular/Malo
valoresError: ['malo', 'regular']

// Para opciones personalizadas
valoresError: ['opcion1', 'opcion2']
```

### Configuración Min/Max
```typescript
configuracion: {
  valorMinimo: 30,
  valorMaximo: 40,
  generarErrorFueraRango: true
}
```

## Estilos y UI

### Clases CSS Principales
- `.validation-config`: Configuración de validación
- `.error-value-btn`: Botones de valores de error
- `.section-item`: Elementos de sección
- `.item-row`: Filas de ítems

### Responsive Design
- Grid adaptativo para diferentes tamaños de pantalla
- Formularios optimizados para móviles
- Modales centrados y responsivos

## Próximas Mejoras

### Funcionalidades Pendientes
- [ ] Drag & drop para reordenar ítems
- [ ] Importar/exportar plantillas
- [ ] Duplicar plantillas existentes
- [ ] Validación en tiempo real
- [ ] Preview de plantilla
- [ ] Historial de versiones

### Mejoras de UX
- [ ] Confirmaciones más elegantes
- [ ] Notificaciones toast
- [ ] Mejor feedback visual
- [ ] Atajos de teclado

## Dependencias

- Angular 17+
- Angular Forms (Reactive)
- Angular Router
- Tailwind CSS
- Supabase (a través del servicio)

## Ejemplo de Uso

```typescript
// En el componente padre
openTemplateConfig(template?: ChecklistTemplate): void {
  if (template) {
    this.router.navigate(['/template-config', template.id]);
  } else {
    this.router.navigate(['/template-config']);
  }
}
```

## Notas de Implementación

1. **Formularios Reactivos**: Se utiliza `FormBuilder` para manejo robusto de formularios
2. **Validación**: Validación tanto del lado cliente como del servidor
3. **Estado**: Gestión de estado local con variables de instancia
4. **Navegación**: Integración completa con Angular Router
5. **Servicios**: Separación clara de responsabilidades con servicios dedicados

El componente está listo para uso en producción y puede ser extendido según las necesidades específicas del proyecto.
