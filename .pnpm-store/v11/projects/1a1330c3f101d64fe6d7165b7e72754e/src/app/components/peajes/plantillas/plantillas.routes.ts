import { Routes } from '@angular/router';
import { PlantillasHomeComponent } from './plantillas-home.component';
import { PEAJES_PLANTILLAS_PROVIDERS } from '../peajes.providers';

export const PLANTILLAS_ROUTE_PATHS = {
  home: 'plantillas',
} as const;

/**
 * Rutas de plantillas — fusionadas en peajes.routes.ts (agente 05).
 * Builder / aplicar / algoritmos viven como tabs en PlantillasHomeComponent.
 */
export const PEAJES_PLANTILLAS_ROUTES: Routes = [
  {
    path: 'plantillas',
    component: PlantillasHomeComponent,
    providers: PEAJES_PLANTILLAS_PROVIDERS,
  },
];

/** @deprecated Usar PEAJES_PLANTILLAS_ROUTES */
export const PLANTILLAS_ROUTES_DECLARATION = PEAJES_PLANTILLAS_ROUTES;
