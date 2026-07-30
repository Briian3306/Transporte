import { Routes } from '@angular/router';
import { PeajesWizardComponent } from './peajes-wizard.component';
import {
  PEAJES_CARGA_SERVICE,
  PEAJES_CATALOGO_SERVICE,
} from '../models';
import { PeajesCatalogoMockService } from './mocks/peajes-catalogo.mock';
import { PeajesCargaMockService } from './mocks/peajes-carga.mock';

/**
 * Fragmento de rutas del wizard — mergear en peajes.routes.ts (agente 05).
 * Path esperado: /peajes/wizard
 */
export const PEAJES_WIZARD_ROUTES: Routes = [
  {
    path: 'wizard',
    component: PeajesWizardComponent,
    providers: [
      { provide: PEAJES_CATALOGO_SERVICE, useClass: PeajesCatalogoMockService },
      { provide: PEAJES_CARGA_SERVICE, useClass: PeajesCargaMockService },
    ],
  },
];
