export const PLANTILLAS_ROUTE_PATHS = {
  home: 'plantillas',
  nueva: 'plantillas/nueva',
  editar: 'plantillas/:id',
  aplicar: 'plantillas/aplicar',
  algoritmos: 'plantillas/algoritmos',
  algoritmoNuevo: 'plantillas/algoritmos/nuevo',
  algoritmoEditar: 'plantillas/algoritmos/:id',
} as const;

/**
 * Rutas propuestas para merge por agente 05 (NO editar peajes.routes.ts aquí).
 *
 * import { PLANTILLAS_ROUTES } from './plantillas/plantillas.routes';
 * ...spread into PEAJES_ROUTES
 */
export const PLANTILLAS_ROUTES_DECLARATION = `
  { path: 'plantillas', loadComponent: () => import('./plantillas/plantillas-home.component').then(m => m.PlantillasHomeComponent) },
  { path: 'plantillas/nueva', loadComponent: () => import('./plantillas/plantilla-builder.component').then(m => m.PlantillaBuilderComponent) },
  { path: 'plantillas/:id', loadComponent: () => import('./plantillas/plantilla-builder.component').then(m => m.PlantillaBuilderComponent) },
  { path: 'plantillas-aplicar', loadComponent: () => import('./plantillas/aplicar-plantilla.component').then(m => m.AplicarPlantillaComponent) },
  { path: 'plantillas/algoritmos', loadComponent: () => import('./plantillas/algoritmo-builder.component').then(m => m.AlgoritmoBuilderComponent) },
`;
