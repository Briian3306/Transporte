# Sistema de Checklists Ibarra - Angular

Sistema de gestión de checklists dinámicos desarrollado con Angular y Supabase.

## 🚀 Características

- ✅ Gestión de plantillas de checklist configurables
- ✅ Checklists dinámicos con validación en tiempo real
- ✅ Sistema de validaciones personalizables
- ✅ Interfaz responsive y moderna
- ✅ Integración con Supabase para persistencia de datos
- ✅ Barra de progreso en tiempo real
- ✅ Sistema de observaciones por item

## 📋 Requisitos Previos

- Node.js (versión 18 o superior)
- npm o yarn
- Cuenta de Supabase

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ibarra-app
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Copy `.env.example` and fill secrets (never commit real values):
   
   ```bash
   cp .env.example .env.development   # pnpm start  (DESARROLLO remote)
   cp .env.example .env.local         # pnpm dev    (Supabase CLI)
   cp .env.example .env.production    # pnpm build:prod / Netlify
   ```
   
   Required keys: `NG_APP_SUPABASE_URL`, `NG_APP_SUPABASE_KEY`, `NG_APP_API_URL`, `NG_APP_AUTH_TOKEN`.
   Scripts run `node scripts/sync-env.mjs` before serve/build.

4. **Configurar base de datos Supabase**
   
   Ejecuta los scripts SQL proporcionados en la guía de migración para crear las tablas necesarias.

## 🗄️ Estructura de Base de Datos

El sistema utiliza las siguientes tablas en Supabase:

- `checklist_templates` - Plantillas de checklist
- `vehiculos` - Información de vehículos
- `choferes` - Información de choferes
- `checklists` - Checklists completados
- `checklist_items_errors` - Errores por item
- `checklist_statistics` - Estadísticas diarias

## 🏗️ Estructura del Proyecto

```
src/
├── app/
│   ├── components/
│   │   ├── template-list/          # Lista de plantillas
│   │   └── checklist-dynamic/      # Checklist dinámico
│   ├── models/                     # Modelos TypeScript
│   ├── services/                   # Servicios de datos
│   └── environments/               # Variables de entorno
├── styles.css                     # Estilos globales
└── index.html
```

## 🚀 Desarrollo

1. **Iniciar servidor de desarrollo**
   ```bash
   npm start
   ```

2. **Abrir en el navegador**
   ```
   http://localhost:4200
   ```

## 📦 Build para Producción

```bash
npm run build
```

Los archivos compilados se generarán en la carpeta `dist/`.

## 🔧 Configuración de Supabase

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Obtén la URL y la clave anónima de tu proyecto

### 2. Configurar Base de Datos

Ejecuta los scripts SQL proporcionados en la guía de migración para crear las tablas necesarias.

### 3. Configurar RLS (Row Level Security)

Configura las políticas de seguridad según tus necesidades:

```sql
-- Ejemplo de política básica
CREATE POLICY "Allow all operations for authenticated users" ON checklist_templates
  FOR ALL USING (auth.role() = 'authenticated');
```

## 📱 Uso del Sistema

### 1. Gestión de Plantillas

- Accede a la sección "Plantillas" para ver todas las plantillas disponibles
- Crea nuevas plantillas con secciones e items personalizables
- Configura validaciones específicas para cada item

### 2. Completar Checklists

- Selecciona una plantilla para crear un nuevo checklist
- Completa la información general (fecha, chofer, vehículo)
- Responde cada item según su tipo de validación
- Agrega observaciones opcionales
- Guarda el checklist cuando esté completo

### 3. Tipos de Validación

- **Si/No**: Respuesta binaria
- **Si/No/NA**: Incluye opción "No Aplica"
- **Bueno/Regular/Malo**: Evaluación cualitativa
- **Valor Min/Max**: Validación numérica con rangos
- **Cantidad**: Validación de cantidades
- **Texto libre**: Respuesta de texto

## 🎨 Personalización

### Estilos

Los estilos se pueden personalizar editando:
- `src/styles.css` - Estilos globales
- `src/app/app.component.scss` - Estilos del layout principal
- Archivos `.scss` de cada componente

### Componentes

Los componentes están diseñados para ser reutilizables y personalizables:
- `TemplateListComponent` - Lista de plantillas
- `ChecklistDynamicComponent` - Checklist dinámico

## 🐛 Solución de Problemas

### Error de Conexión a Supabase

1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que la URL y la clave de Supabase sean correctas
3. Verifica que las políticas RLS permitan las operaciones necesarias

### Errores de Build

1. Asegúrate de que todas las dependencias estén instaladas
2. Verifica que no haya errores de TypeScript
3. Ejecuta `npm run build` para ver errores detallados

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico o preguntas, contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ para Ibarra**