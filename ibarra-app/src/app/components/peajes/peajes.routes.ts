import { Routes } from '@angular/router';
import { PeajesHomeComponent } from './peajes-home.component';

/**
 * Rutas hijas del módulo Peajes.
 * Agentes 02/03 no editan este archivo: solicitan merge al agente 05 vía session-handoff.
 * Puntos de extensión previstos:
 * - wizard → /peajes/wizard
 * - catalogos → /peajes/catalogos/...
 * - plantillas → /peajes/plantillas/...
 */
export const PEAJES_ROUTES: Routes = [
  {
    path: '',
    component: PeajesHomeComponent,
  },
];
