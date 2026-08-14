# Definiciones de categorias que se van dando

## Task

Una task es un trabajo técnico concreto, ejecutable y asignable a una persona.

Debe ser lo suficientemente pequeña como para poder entenderse rápido, estimarse, ejecutarse en poco tiempo y probarse al finalizar.

La pregunta correcta es: ¿Qué trabajo técnico específico hay que hacer?

### Ejemplos
- Crear worker de envío
- Implementar serializer
- Configurar Firebase
- Crear endpoint API
- Agregar retry logic
- Crear template base HTML
- Implementar validación de tokens

### StoryPoints 

Las tasks deben tener story points de forma obligatoria.

## Epic

Una épica representa una iniciativa grande, un módulo completo o un objetivo importante del producto. No es una tarea técnica. No es un ticket pequeño. No es algo para resolver en una tarde.

La pregunta correcta es: ¿Qué problema de negocio o capacidad importante estamos resolviendo?

No: ¿Qué archivo o función vamos a tocar?

### Ejemplos correctos

- Módulo de Notificaciones
- Sistema de Control de Acceso
- Integración con MercadoPago
- Dashboard Operativo
- Módulo de Facturación
- Automatización de Mails

### Ejemplos incorrectos

- Crear endpoint
- Cambiar texto del botón
- Corregir bug de login
- Ajustar template HTML

### StoryPoints

Las épicas no deberían tener story points. La razón es simple: son demasiado grandes, tienen demasiada incertidumbre y no representan una unidad ejecutable.
La épica se mide a través de las features y tasks que contiene.

## StoryPoints

Los story points representan complejidad, esfuerzo relativo, incertidumbre y riesgo técnico. No representan horas exactas, días exactos, productividad de una persona ni tiempo calendario puro.

### Escala

| Story Points  | Interpretación                         |
|:--------------|:---------------------------------------|
| 1             | Muy simple                             |   
| 2             | Simple                                 |   
| 3             | Trabajo normal                         |   
| 5             | Complejidad media                      |   
| 8             | Complejo                               |   
| 13            | Muy complejo                           |   
| 21            | Excesivo, probablemente hay que dividir|   

Si una task vale 13 o más, lo más probable es que esté mal dividida. No significa que sea imposible, pero sí que conviene bajarla de tamaño.

### Estimación

La estimación debe hacerse comparando tareas entre sí, no pensando en horas.

- **Complejidad técnica**: ¿La solución es sencilla o requiere arquitectura adicional?
- **Incertidumbre**: ¿Sabemos exactamente cómo resolverlo o hay partes desconocidas?
- **Dependencias**: ¿Depende de otros equipos, módulos, API externas o decisiones previas?
- **Riesgo**: ¿Puede romper algo que ya esta aplicado? ¿Hay impacto alto si falla?